import { PdfViewer } from '../pdf/pdf-viewer.js';
import { MidiTimeline } from './midi-timeline.js';
import { MidiInput } from '../core/midi-input.js';
import { parseReference } from '../core/midi-reference.js';
import { getPiece, updatePiece, getGlobalSettings } from '../core/store.js';
import { sortAnchors, upsertAnchor, removeAnchor, exportJson, importJson, sha256Hex } from '../core/anchors.js';
import { noteName } from '../util/note-names.js';
import { resolveSettings } from '../core/settings.js';
import { AudioPreview } from '../util/audio-preview.js';

const NOTE_FLASH_MS = 250;

const AUTOSAVE_DEBOUNCE_MS = 500;
const CAPTURE_LOOKAHEAD = 8;

/**
 * Vue « Éditeur d'ancrages » : PDF + timeline MIDI côte à côte. Trois façons de poser une
 * ancre (plan.md §7/P4) :
 *   1. sélectionner un événement dans la timeline puis cliquer sur le PDF ;
 *   2. mode capture : jouer les premières notes du passage au clavier, puis cliquer sur le PDF ;
 *   3. bouton « ancre au début de chaque page » (eventIndex estimé, à ajuster).
 * Autosave (debounce 500 ms), export/import JSON.
 *
 * Le mode capture utilise un positionnement de curseur minimal (cas « match »/« skip » de
 * l'algorithme §6.2 uniquement) pour rester pratique en édition, sans réutiliser
 * core/matcher.js — le vrai Matcher (avec reject/rewind) est le sujet de P5.
 *
 * @param {HTMLElement} container
 * @returns {{ open: (id:string) => Promise<void>, close: () => void, setNoteScheme: (scheme:string) => void }}
 */
export function mountEditorView(container) {
  const pdfContainer = container.querySelector('#editor-pdf-container');
  const titleEl = container.querySelector('#editor-title');
  const autosaveEl = container.querySelector('#editor-autosave');
  const backBtn = container.querySelector('#editor-back');
  const zoomOutBtn = container.querySelector('#editor-zoom-out');
  const zoomInBtn = container.querySelector('#editor-zoom-in');
  const modeSelectBtn = container.querySelector('#editor-mode-select');
  const modeCaptureBtn = container.querySelector('#editor-mode-capture');
  const anchorPagesBtn = container.querySelector('#editor-anchor-pages');
  const modeStatusEl = container.querySelector('#editor-mode-status');
  const timelineContainer = container.querySelector('#editor-timeline-container');
  const previewPlayBtn = container.querySelector('#editor-preview-play');
  const anchorListEl = container.querySelector('#editor-anchor-list');
  const connectMidiBtn = container.querySelector('#editor-connect-midi');
  const midiPortSelect = container.querySelector('#editor-midi-port-select');
  const midiStatusEl = container.querySelector('#editor-midi-status');
  const lastNoteEl = container.querySelector('#editor-midi-last-note');
  const exportBtn = container.querySelector('#editor-export');
  const importTriggerBtn = container.querySelector('#editor-import-trigger');
  const importInput = container.querySelector('#editor-import-input');

  const settingsInputs = {
    lead: container.querySelector('#piece-setting-lead'),
    lookahead: container.querySelector('#piece-setting-lookahead'),
    lookbehind: container.querySelector('#piece-setting-lookbehind'),
    chordWindowMs: container.querySelector('#piece-setting-chordwindow'),
    scrollSuspendMs: container.querySelector('#piece-setting-scrollsuspend'),
    defaultZoom: container.querySelector('#piece-setting-defaultzoom'),
    octaveAgnostic: container.querySelector('#piece-setting-octaveagnostic'),
    strictChords: container.querySelector('#piece-setting-strictchords'),
  };

  const pdfViewer = new PdfViewer(pdfContainer);
  const midiTimeline = new MidiTimeline(timelineContainer);
  const midiInput = new MidiInput();
  const audioPreview = new AudioPreview();

  /** @type {import('../core/store.js').Piece | null} */
  let piece = null;
  let refEvents = [];
  let mode = null; // 'select' | 'capture' | null
  let selectedEventIndex = -1;
  let captureCursor = -1;
  let capturePending = new Set();
  let saveTimer = null;
  let noteScheme = 'en';
  let noteFlashTimer = null;

  // --- Placement d'ancre : clic sur le PDF -------------------------------------------------
  pdfContainer.addEventListener('click', (e) => {
    if (!piece || mode == null) return;
    const hit = pdfViewer.hitTest(e.clientX, e.clientY);
    if (!hit) return;

    const eventIndex = mode === 'capture' ? captureCursor : selectedEventIndex;
    if (eventIndex < 0) {
      setModeStatus("Choisis d'abord un événement (clic sur la timeline, ou joue une note en mode capture).");
      return;
    }

    const label = prompt("Libellé de l'ancre", `Événement ${eventIndex}`);
    if (label === null) return; // annulé

    addAnchor({ eventIndex, page: hit.page, yRatio: hit.yRatio, label: label || `Événement ${eventIndex}` });
  });

  // --- Mode 1 : sélection dans la timeline --------------------------------------------------
  midiTimeline.addEventListener('select', (e) => {
    selectedEventIndex = e.detail.index;
    midiTimeline.setSelectedIndex(selectedEventIndex);
    if (mode === 'select') {
      setModeStatus(`Événement ${selectedEventIndex} sélectionné — clique sur le PDF pour poser l'ancre.`);
    }
  });

  // --- Pré-écoute WebAudio (plan.md §8/P8) : se repérer à l'oreille en posant des ancres -----
  previewPlayBtn.addEventListener('click', () => {
    if (audioPreview.playing) {
      audioPreview.stop();
      resetPreviewButton();
      return;
    }
    if (refEvents.length === 0) return;
    const fromIndex = selectedEventIndex >= 0 ? selectedEventIndex : 0;
    previewPlayBtn.textContent = '■ Arrêter';
    audioPreview.play(refEvents, fromIndex, {
      onEventStart: (i) => midiTimeline.setCurrentIndex(i),
      onEnd: resetPreviewButton,
    });
  });

  function resetPreviewButton() {
    previewPlayBtn.textContent = '▶ Pré-écouter';
    midiTimeline.setCurrentIndex(-1);
  }

  modeSelectBtn.addEventListener('click', () => setMode(mode === 'select' ? null : 'select'));
  modeCaptureBtn.addEventListener('click', () => setMode(mode === 'capture' ? null : 'capture'));

  // --- Mode 3 : une ancre au début de chaque page ------------------------------------------
  anchorPagesBtn.addEventListener('click', () => {
    if (!piece) return;
    if (
      !confirm(
        'Générer une ancre au début de chaque page ? Les eventIndex sont une estimation ' +
          '(répartition régulière) à corriger ensuite dans la liste.',
      )
    ) {
      return;
    }
    // Complète les ancres existantes (ne les écrase pas) : une par page, à eventIndex estimé
    // par répartition régulière sur la séquence.
    let anchors = piece.anchors;
    for (let page = 1; page <= piece.pageCount; page++) {
      const ratio = piece.pageCount > 1 ? (page - 1) / piece.pageCount : 0;
      const eventIndex = Math.round(ratio * Math.max(refEvents.length - 1, 0));
      anchors = upsertAnchor(anchors, {
        id: crypto.randomUUID(),
        eventIndex,
        page,
        yRatio: 0,
        label: `Page ${page}`,
      });
    }
    piece = { ...piece, anchors };
    renderAnchorList();
    scheduleSave();
  });

  // --- MIDI : connexion, choix du port, retour visuel sur chaque note reçue -----------------
  midiInput.addEventListener('noteon', (e) => {
    showNoteFeedback(e.detail.pitch, e.detail.velocity);
    if (mode !== 'capture' || refEvents.length === 0) return;
    onCaptureNoteOn(e.detail.pitch);
  });
  midiInput.addEventListener('statechange', (e) => renderMidiPorts(e.detail.inputs));
  midiInput.addEventListener('error', (e) => console.error('[editor] MIDI', e.detail.message));

  connectMidiBtn.addEventListener('click', async () => {
    connectMidiBtn.disabled = true;
    setMidiStatus('requesting');
    await midiInput.connect();
    setMidiStatus(midiInput.status);
    connectMidiBtn.disabled = false;
  });

  midiPortSelect.addEventListener('change', () => {
    midiInput.selectInput(midiPortSelect.value || null);
  });

  function renderMidiPorts(inputs) {
    const previousValue = midiPortSelect.value;
    midiPortSelect.innerHTML = '<option value="">Tous les ports</option>';
    for (const input of inputs) {
      const option = document.createElement('option');
      option.value = input.id;
      option.textContent = `${input.name} (${input.state})`;
      midiPortSelect.appendChild(option);
    }
    midiPortSelect.value = previousValue;
  }

  /** Confirmation visuelle immédiate qu'une touche a été détectée, quel que soit le mode actif. */
  function showNoteFeedback(pitch, velocity) {
    lastNoteEl.textContent = `${noteName(pitch, noteScheme)} (vel=${velocity})`;
    lastNoteEl.classList.remove('flash');
    // Forcer un reflow pour rejouer l'animation même sur la même note répétée.
    void lastNoteEl.offsetWidth;
    lastNoteEl.classList.add('flash');
    clearTimeout(noteFlashTimer);
    noteFlashTimer = setTimeout(() => lastNoteEl.classList.remove('flash'), NOTE_FLASH_MS);
  }

  function onCaptureNoteOn(pitch) {
    if (captureCursor === -1) resetCaptureCursor(0);

    if (capturePending.has(pitch)) {
      capturePending.delete(pitch);
      if (capturePending.size === 0) advanceCapture();
    } else {
      const found = findAhead(pitch, captureCursor, CAPTURE_LOOKAHEAD);
      if (found !== -1) {
        resetCaptureCursor(found);
        capturePending.delete(pitch);
        if (capturePending.size === 0) advanceCapture();
      }
      // Note non trouvée dans la fenêtre : ignorée, le curseur ne bouge pas.
    }
    midiTimeline.setCurrentIndex(captureCursor);
    setModeStatus(`Capture : événement ${captureCursor} — clique sur le PDF pour poser l'ancre.`);
  }

  function findAhead(pitch, from, lookahead) {
    const end = Math.min(refEvents.length - 1, from + lookahead);
    for (let i = from; i <= end; i++) {
      if (refEvents[i].pitches.includes(pitch)) return i;
    }
    return -1;
  }

  function resetCaptureCursor(index) {
    captureCursor = index;
    capturePending = new Set(refEvents[index]?.pitches ?? []);
  }

  function advanceCapture() {
    captureCursor = Math.min(captureCursor + 1, refEvents.length - 1);
    capturePending = new Set(refEvents[captureCursor]?.pitches ?? []);
  }

  // --- Liste des ancres -----------------------------------------------------------------------
  function renderAnchorList() {
    anchorListEl.innerHTML = '';
    if (!piece || piece.anchors.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'editor-anchor-empty';
      empty.textContent = 'Aucune ancre pour le moment.';
      anchorListEl.appendChild(empty);
      return;
    }

    for (const anchor of sortAnchors(piece.anchors)) {
      const li = document.createElement('li');
      li.className = 'editor-anchor-row';

      const jumpBtn = document.createElement('button');
      jumpBtn.type = 'button';
      jumpBtn.className = 'editor-anchor-jump';
      jumpBtn.textContent = `#${anchor.eventIndex}`;
      jumpBtn.title = 'Aller à cette ancre';
      jumpBtn.addEventListener('click', () => {
        pdfViewer.scrollToAnchor(anchor.page, anchor.yRatio);
        midiTimeline.setSelectedIndex(anchor.eventIndex);
        selectedEventIndex = anchor.eventIndex;
      });

      const labelInput = document.createElement('input');
      labelInput.type = 'text';
      labelInput.className = 'editor-anchor-label';
      labelInput.value = anchor.label;
      labelInput.addEventListener('change', () => updateAnchor(anchor.id, { label: labelInput.value }));

      const pageInfo = document.createElement('span');
      pageInfo.className = 'editor-anchor-page';
      pageInfo.textContent = `p.${anchor.page}`;

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'editor-anchor-delete';
      deleteBtn.textContent = '✕';
      deleteBtn.setAttribute('aria-label', "Supprimer l'ancre");
      deleteBtn.addEventListener('click', () => {
        piece = { ...piece, anchors: removeAnchor(piece.anchors, anchor.id) };
        renderAnchorList();
        scheduleSave();
      });

      li.append(jumpBtn, labelInput, pageInfo, deleteBtn);
      anchorListEl.appendChild(li);
    }
  }

  function addAnchor({ eventIndex, page, yRatio, label }) {
    const anchor = { id: crypto.randomUUID(), eventIndex, page, yRatio, label };
    piece = { ...piece, anchors: upsertAnchor(piece.anchors, anchor) };
    renderAnchorList();
    scheduleSave();
  }

  function updateAnchor(id, patch) {
    const existing = piece.anchors.find((a) => a.id === id);
    if (!existing) return;
    piece = { ...piece, anchors: upsertAnchor(piece.anchors, { ...existing, ...patch }) };
    scheduleSave();
  }

  // --- Autosave (debounce 500 ms) --------------------------------------------------------------
  function scheduleSave() {
    setAutosaveStatus('Modifications en attente…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      if (!piece) return;
      await updatePiece(piece.id, { anchors: piece.anchors, settings: piece.settings });
      setAutosaveStatus('Enregistré');
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  // --- Réglages du morceau (surcharge des réglages globaux, plan.md §7/P6) ---------------------
  function loadPieceSettingsForm() {
    const raw = piece.settings ?? {};
    settingsInputs.lead.value = raw.lead ?? '';
    settingsInputs.lookahead.value = raw.lookahead ?? '';
    settingsInputs.lookbehind.value = raw.lookbehind ?? '';
    settingsInputs.chordWindowMs.value = raw.chordWindowMs ?? '';
    settingsInputs.scrollSuspendMs.value = raw.scrollSuspendMs ?? '';
    settingsInputs.defaultZoom.value = raw.defaultZoom ?? '';
    settingsInputs.octaveAgnostic.value = raw.octaveAgnostic === undefined ? '' : String(raw.octaveAgnostic);
    settingsInputs.strictChords.value = raw.strictChords === undefined ? '' : String(raw.strictChords);
  }

  async function savePieceSettingsField(key, rawValue, { numeric } = {}) {
    if (!piece) return;
    let value;
    if (rawValue === '') {
      value = undefined; // hérite du réglage global
    } else if (numeric) {
      value = Number(rawValue);
    } else {
      value = rawValue === 'true';
    }

    // Changer chordWindowMs redécoupe les événements : les eventIndex des ancres existantes
    // peuvent ne plus correspondre au même endroit du morceau.
    if (key === 'chordWindowMs' && piece.anchors.length > 0) {
      if (
        !confirm(
          "Changer la fenêtre d'accord redécoupe les événements MIDI : les ancres déjà posées " +
            'peuvent se retrouver décalées. Continuer ?',
        )
      ) {
        loadPieceSettingsForm();
        return;
      }
    }

    piece = { ...piece, settings: { ...piece.settings, [key]: value } };
    scheduleSave();

    if (key === 'chordWindowMs') {
      await reparseReference();
    }
    if (key === 'scrollSuspendMs' || key === 'defaultZoom') {
      applyViewerSettings();
    }
  }

  settingsInputs.lead.addEventListener('change', () => savePieceSettingsField('lead', settingsInputs.lead.value, { numeric: true }));
  settingsInputs.lookahead.addEventListener('change', () => savePieceSettingsField('lookahead', settingsInputs.lookahead.value, { numeric: true }));
  settingsInputs.lookbehind.addEventListener('change', () => savePieceSettingsField('lookbehind', settingsInputs.lookbehind.value, { numeric: true }));
  settingsInputs.chordWindowMs.addEventListener('change', () => savePieceSettingsField('chordWindowMs', settingsInputs.chordWindowMs.value, { numeric: true }));
  settingsInputs.scrollSuspendMs.addEventListener('change', () => savePieceSettingsField('scrollSuspendMs', settingsInputs.scrollSuspendMs.value, { numeric: true }));
  settingsInputs.defaultZoom.addEventListener('change', () => savePieceSettingsField('defaultZoom', settingsInputs.defaultZoom.value, { numeric: true }));
  settingsInputs.octaveAgnostic.addEventListener('change', () => savePieceSettingsField('octaveAgnostic', settingsInputs.octaveAgnostic.value));
  settingsInputs.strictChords.addEventListener('change', () => savePieceSettingsField('strictChords', settingsInputs.strictChords.value));

  /** Réapplique le chordWindowMs résolu et reconstruit la timeline (utilisé aussi à l'ouverture). */
  async function reparseReference() {
    const resolved = resolveSettings(await getGlobalSettings(), piece.settings);
    const midiBuf = await piece.midiBlob.arrayBuffer();
    refEvents = parseReference(midiBuf, { chordWindowMs: resolved.chordWindowMs }).events;
    midiTimeline.setEvents(refEvents);
  }

  /** Réapplique scrollSuspendMs résolu au viewer PDF (sans recharger le PDF ; defaultZoom
   * n'est consulté qu'au chargement, voir open()). */
  async function applyViewerSettings() {
    const resolved = resolveSettings(await getGlobalSettings(), piece.settings);
    pdfViewer.configure({ userScrollingTimeoutMs: resolved.scrollSuspendMs });
  }

  // --- Export / import JSON ----------------------------------------------------------------------
  exportBtn.addEventListener('click', async () => {
    if (!piece) return;
    const json = await exportJson(piece);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${piece.title.replace(/[^\w-]+/g, '_')}.ancres.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  importTriggerBtn.addEventListener('click', () => importInput.click());
  importInput.addEventListener('change', async () => {
    const file = importInput.files?.[0];
    importInput.value = '';
    if (!file || !piece) return;

    try {
      const text = await file.text();
      const expectedSha = await sha256Hex(piece.midiBlob);
      const { anchors, warnings } = importJson(text, expectedSha);
      if (warnings.length > 0 && !confirm(`${warnings.join('\n')}\n\nImporter quand même ?`)) return;

      piece = { ...piece, anchors };
      renderAnchorList();
      scheduleSave();
    } catch (err) {
      alert(`Import échoué : ${err.message}`);
    }
  });

  // --- État des modes / statuts --------------------------------------------------------------------
  function setMode(next) {
    mode = next;
    modeSelectBtn.classList.toggle('active', mode === 'select');
    modeCaptureBtn.classList.toggle('active', mode === 'capture');
    if (mode === 'select') {
      setModeStatus('Sélectionne un événement dans la timeline, puis clique sur le PDF.');
    } else if (mode === 'capture') {
      resetCaptureCursor(selectedEventIndex >= 0 ? selectedEventIndex : 0);
      midiTimeline.setCurrentIndex(captureCursor);
      setModeStatus('Joue les premières notes du passage sur le clavier, puis clique sur le PDF.');
    } else {
      setModeStatus('');
    }
  }

  function setModeStatus(text) {
    modeStatusEl.textContent = text;
  }

  function setMidiStatus(status) {
    midiStatusEl.textContent = status;
    midiStatusEl.dataset.status = status;
  }

  function setAutosaveStatus(text) {
    autosaveEl.textContent = text;
  }

  backBtn.addEventListener('click', () => {
    location.hash = '#/library';
  });
  zoomOutBtn.addEventListener('click', () => pdfViewer.setZoom(pdfViewer.scale - 0.2));
  zoomInBtn.addEventListener('click', () => pdfViewer.setZoom(pdfViewer.scale + 0.2));

  // --- Ouverture / fermeture --------------------------------------------------------------------
  async function open(id) {
    if (!id) return;
    audioPreview.stop();
    resetPreviewButton();
    const loaded = await getPiece(id);
    if (!loaded) {
      alert('Morceau introuvable.');
      location.hash = '#/library';
      return;
    }
    piece = loaded;
    titleEl.textContent = piece.title;
    setAutosaveStatus('');
    mode = null;
    selectedEventIndex = -1;
    captureCursor = -1;
    capturePending = new Set();
    loadPieceSettingsForm();

    const resolved = resolveSettings(await getGlobalSettings(), piece.settings);

    try {
      const midiBuf = await piece.midiBlob.arrayBuffer();
      refEvents = parseReference(midiBuf, { chordWindowMs: resolved.chordWindowMs }).events;
    } catch (err) {
      alert(`MIDI illisible : ${err.message}`);
      location.hash = '#/library';
      return;
    }
    if (refEvents.length === 0) {
      alert("Ce MIDI ne contient aucune note utilisable — l'éditeur ne pourra pas poser d'ancres utiles.");
    }
    midiTimeline.setEvents(refEvents);

    pdfViewer.configure({ userScrollingTimeoutMs: resolved.scrollSuspendMs, defaultZoom: resolved.defaultZoom });
    try {
      await pdfViewer.load(piece.pdfBlob);
    } catch (err) {
      alert(`PDF illisible : ${err.message}`);
      location.hash = '#/library';
      return;
    }

    renderAnchorList();
    setMode(null);
  }

  function close() {
    audioPreview.stop();
    resetPreviewButton();
    // Sinon rien à libérer : pdfViewer/midiTimeline/midiInput sont réutilisés à la prochaine ouverture.
  }

  function setNoteScheme(scheme) {
    noteScheme = scheme;
    midiTimeline.setNoteScheme(scheme);
  }

  return { open, close, setNoteScheme };
}
