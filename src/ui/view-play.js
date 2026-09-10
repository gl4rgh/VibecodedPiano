import { PdfViewer } from '../pdf/pdf-viewer.js';
import { MidiInput } from '../core/midi-input.js';
import { Matcher } from '../core/matcher.js';
import { parseReference } from '../core/midi-reference.js';
import { getPiece, getGlobalSettings } from '../core/store.js';
import { sortAnchors, resolveActiveAnchor } from '../core/anchors.js';
import { Hud } from './hud.js';
import { ScreenWakeLock } from '../util/wake-lock.js';
import { noteName } from '../util/note-names.js';
import { resolveSettings } from '../core/settings.js';

const ICON_PAUSE =
  '<svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor"><path d="M200,32H160a16,16,0,0,0-16,16V208a16,16,0,0,0,16,16h40a16,16,0,0,0,16-16V48A16,16,0,0,0,200,32Zm0,176H160V48h40ZM96,32H56A16,16,0,0,0,40,48V208a16,16,0,0,0,16,16H96a16,16,0,0,0,16-16V48A16,16,0,0,0,96,32Zm0,176H56V48H96Z"/></svg>';
const ICON_PLAY =
  '<svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor"><path d="M232.4,114.49,88.32,26.35a16,16,0,0,0-16.2-.3A15.86,15.86,0,0,0,64,39.87V216.13A15.94,15.94,0,0,0,80,232a16.07,16.07,0,0,0,8.36-2.35L232.4,141.51a15.81,15.81,0,0,0,0-27ZM80,215.94V40l143.83,88Z"/></svg>';

const ZOOM_STEP = 0.1;

/**
 * Vue « Mode jeu » : plein écran, PDF seul + HUD discret en surimpression. Câblage
 * noteon -> matcher.onNoteOn -> resolveActiveAnchor -> viewer.scrollToAnchor.
 * @param {HTMLElement} container
 * @returns {{ open: (id:string) => Promise<void>, close: () => void, setNoteScheme: (scheme:string) => void }}
 */
export function mountPlayView(container) {
  const pdfContainer = container.querySelector('#play-pdf-container');
  const hudContainer = container.querySelector('#play-hud');
  const backBtn = container.querySelector('#play-back');
  const resetBtn = container.querySelector('#play-reset');
  const prevAnchorBtn = container.querySelector('#play-prev-anchor');
  const nextAnchorBtn = container.querySelector('#play-next-anchor');
  const pauseBtn = container.querySelector('#play-pause');
  const recenterBtn = container.querySelector('#play-recenter');
  const zoomOutBtn = container.querySelector('#play-zoom-out');
  const zoomInBtn = container.querySelector('#play-zoom-in');
  const zoomSlider = container.querySelector('#play-zoom-slider');
  const connectMidiBtn = container.querySelector('#play-connect-midi');
  const diagnosticBtn = container.querySelector('#play-diagnostic');
  const diagnosticPanelEl = container.querySelector('#play-diagnostic-panel');

  const pdfViewer = new PdfViewer(pdfContainer, {
    onZoomChange: (scale) => {
      zoomSlider.value = scale;
    },
  });
  const hud = new Hud(hudContainer);
  const midiInput = new MidiInput();
  const wakeLock = new ScreenWakeLock();

  /** @type {import('../core/store.js').Piece | null} */
  let piece = null;
  let refEvents = [];
  let anchors = [];
  /** @type {Matcher | null} */
  let matcher = null;
  let paused = false;
  let lastAppliedAnchorId = null;
  let noteScheme = 'en';
  let resolvedSettings = null;
  let diagnosticOn = false;

  midiInput.addEventListener('noteon', (e) => onNoteOn(e.detail.pitch));
  midiInput.addEventListener('statechange', () => hud.setMidiStatus(midiInput.status));
  midiInput.addEventListener('error', (e) => console.error('[play] MIDI', e.detail.message));

  connectMidiBtn.addEventListener('click', async () => {
    connectMidiBtn.disabled = true;
    hud.setMidiStatus('requesting');
    await midiInput.connect();
    hud.setMidiStatus(midiInput.status);
    connectMidiBtn.disabled = false;
  });

  backBtn.addEventListener('click', () => {
    location.hash = '#/library';
  });

  resetBtn.addEventListener('click', () => {
    if (!matcher) return;
    matcher.reset();
    lastAppliedAnchorId = null;
    refreshHud();
    jumpToCursor({ force: true });
  });

  prevAnchorBtn.addEventListener('click', () => goToAnchorOffset(-1));
  nextAnchorBtn.addEventListener('click', () => goToAnchorOffset(1));

  pauseBtn.addEventListener('click', () => {
    paused = !paused;
    pauseBtn.classList.toggle('active', paused);
    pauseBtn.innerHTML = paused
      ? `${ICON_PLAY}<span class="btn-label">Reprendre</span>`
      : `${ICON_PAUSE}<span class="btn-label">Pause</span>`;
  });

  recenterBtn.addEventListener('click', () => jumpToCursor({ force: true }));

  zoomOutBtn.addEventListener('click', () => {
    pdfViewer.setZoom(pdfViewer.scale - ZOOM_STEP);
  });
  zoomInBtn.addEventListener('click', () => {
    pdfViewer.setZoom(pdfViewer.scale + ZOOM_STEP);
  });
  zoomSlider.addEventListener('input', () => {
    pdfViewer.setZoom(parseFloat(zoomSlider.value));
  });

  // --- Mode diagnostic : affiche kind/stats en temps réel pour régler lookahead sur un vrai
  // morceau, sans encombrer le HUD normal ("discret" par défaut). ---------------------------
  diagnosticBtn.addEventListener('click', () => {
    diagnosticOn = !diagnosticOn;
    diagnosticBtn.classList.toggle('active', diagnosticOn);
    diagnosticPanelEl.hidden = !diagnosticOn;
    if (diagnosticOn) updateDiagnostic(null);
  });

  function updateDiagnostic(kind) {
    if (!diagnosticOn || !matcher) return;
    const { matched, skipped, rewinds, rejected } = matcher.stats;
    diagnosticPanelEl.textContent =
      `dernier : ${kind ?? '—'} · match ${matched} · skip ${skipped} · ` +
      `rewind ${rewinds} · reject ${rejected}`;
    diagnosticPanelEl.dataset.kind = kind ?? '';
  }

  /**
   * Note-on -> avance du matcher -> ancre active -> scroll. Le flash de la dernière
   * note reçue s'affiche TOUJOURS, même en pause : ça prouve que l'app entend le clavier même
   * quand le suivi lui-même est volontairement suspendu.
   */
  function onNoteOn(pitch) {
    hud.flashNote(noteName(pitch, noteScheme));
    if (!matcher || paused) return;
    const result = matcher.onNoteOn(pitch);
    updateDiagnostic(result.kind);
    refreshHud();
    jumpToCursor({ force: false });
  }

  /** Applique l'ancre active courante si elle a changé, sans re-scroller sur chaque note. */
  function jumpToCursor({ force }) {
    const anchor = resolveActiveAnchor(anchors, matcher.cursor, defaultLead());
    const changed = (anchor?.id ?? null) !== lastAppliedAnchorId;
    if (!changed && !force) return;
    lastAppliedAnchorId = anchor?.id ?? null;
    if (anchor && (force || !pdfViewer.userScrolling)) {
      pdfViewer.scrollToAnchor(anchor.page, anchor.yRatio, { smooth: true });
    }
    hud.setActiveAnchor(anchor?.label ?? null);
  }

  function goToAnchorOffset(offset) {
    if (!matcher || anchors.length === 0) return;
    const active = resolveActiveAnchor(anchors, matcher.cursor, defaultLead());
    const currentIndex = active ? anchors.findIndex((a) => a.id === active.id) : -1;
    const targetIndex =
      currentIndex === -1 ? 0 : Math.min(anchors.length - 1, Math.max(0, currentIndex + offset));
    const target = anchors[targetIndex];
    if (!target) return;

    matcher.seekToEvent(target.eventIndex);
    lastAppliedAnchorId = target.id;
    pdfViewer.scrollToAnchor(target.page, target.yRatio, { smooth: true });
    hud.setActiveAnchor(target.label);
    refreshHud();
  }

  function defaultLead() {
    return resolvedSettings?.lead ?? 4;
  }

  function refreshHud() {
    if (!matcher) return;
    hud.setPosition(matcher.cursor, refEvents.length);
    hud.setErrorCount(matcher.stats.rejected);
    const pending = refEvents[matcher.cursor]?.pitches ?? [];
    hud.setExpected(pending.map((p) => noteName(p, noteScheme)));
  }

  async function open(id) {
    if (!id) return;
    const loaded = await getPiece(id);
    if (!loaded) {
      alert('Morceau introuvable.');
      location.hash = '#/library';
      return;
    }
    piece = loaded;
    anchors = sortAnchors(piece.anchors);
    lastAppliedAnchorId = null;
    paused = false;
    pauseBtn.classList.remove('active');
    pauseBtn.innerHTML = `${ICON_PAUSE}<span class="btn-label">Pause</span>`;
    diagnosticPanelEl.hidden = !diagnosticOn;

    resolvedSettings = resolveSettings(await getGlobalSettings(), piece.settings);

    try {
      const midiBuf = await piece.midiBlob.arrayBuffer();
      refEvents = parseReference(midiBuf, { chordWindowMs: resolvedSettings.chordWindowMs }).events;
    } catch (err) {
      alert(`MIDI illisible : ${err.message}`);
      location.hash = '#/library';
      return;
    }

    matcher = new Matcher(refEvents, {
      lookahead: resolvedSettings.lookahead,
      lookbehind: resolvedSettings.lookbehind,
      octaveAgnostic: resolvedSettings.octaveAgnostic,
      strictChords: resolvedSettings.strictChords,
    });

    pdfViewer.configure({
      userScrollingTimeoutMs: resolvedSettings.scrollSuspendMs,
      defaultZoom: resolvedSettings.defaultZoom,
    });
    try {
      await pdfViewer.load(piece.pdfBlob);
    } catch (err) {
      alert(`PDF illisible : ${err.message}`);
      location.hash = '#/library';
      return;
    }

    hud.setMidiStatus(midiInput.status);
    refreshHud();
    updateDiagnostic(null);
    jumpToCursor({ force: true });

    await wakeLock.enable();
  }

  async function close() {
    await wakeLock.disable();
  }

  function setNoteScheme(scheme) {
    noteScheme = scheme;
    refreshHud();
  }

  return { open, close, setNoteScheme };
}
