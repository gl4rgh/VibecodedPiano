import { PdfViewer } from './pdf/pdf-viewer.js';
import { MidiInput } from './core/midi-input.js';
import { parseReference } from './core/midi-reference.js';
import { MidiTimeline } from './ui/midi-timeline.js';
import { noteName } from './util/note-names.js';

const views = {
  library: document.getElementById('view-library'),
  editor: document.getElementById('view-editor'),
  play: document.getElementById('view-play'),
};

/**
 * Découpe le hash courant en { name, params }.
 * '#/library'      -> { name: 'library', params: [] }
 * '#/editor/abc'   -> { name: 'editor', params: ['abc'] }
 * ''                -> { name: 'library', params: [] }  (route par défaut)
 * @returns {{ name: string, params: string[] }}
 */
function parseRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [name, ...params] = hash.split('/').filter(Boolean);
  return { name: name && views[name] ? name : 'library', params };
}

function render() {
  const { name } = parseRoute();
  for (const [viewName, el] of Object.entries(views)) {
    el.hidden = viewName !== name;
  }
}

window.addEventListener('hashchange', render);
render();

// --- Test manuel P1 : import PDF direct dans la bibliothèque, sans base IndexedDB.
// Sera remplacé par ui/view-library.js en P4.
const pdfContainer = document.getElementById('pdf-container');
const pdfFileInput = document.getElementById('pdf-file-input');
const pdfZoomOut = document.getElementById('pdf-zoom-out');
const pdfZoomIn = document.getElementById('pdf-zoom-in');

if (pdfContainer && pdfFileInput) {
  const pdfViewer = new PdfViewer(pdfContainer);

  pdfFileInput.addEventListener('change', async () => {
    const file = pdfFileInput.files?.[0];
    if (!file) return;
    const { pageCount } = await pdfViewer.load(file);
    console.log(`[PDF] chargé : ${pageCount} pages`);
  });

  pdfZoomOut?.addEventListener('click', () => pdfViewer.setZoom(pdfViewer.scale - 0.2));
  pdfZoomIn?.addEventListener('click', () => pdfViewer.setZoom(pdfViewer.scale + 0.2));

  // Exposé pour vérification manuelle en console : pdfViewer.scrollToAnchor(3, 0.5)
  window.__pdfViewer = pdfViewer;
}

// --- Test manuel P2 : panneau debug MIDI. Sera remplacé par ui/hud.js en P5.
const MAX_MIDI_LOG_ENTRIES = 16;
const midiConnectBtn = document.getElementById('midi-connect');
const midiPortSelect = document.getElementById('midi-port-select');
const midiStatusEl = document.getElementById('midi-status');
const midiLogEl = document.getElementById('midi-log');

if (midiConnectBtn && midiPortSelect && midiStatusEl && midiLogEl) {
  const midiInput = new MidiInput();

  const setStatus = (status) => {
    midiStatusEl.textContent = status;
    midiStatusEl.dataset.status = status;
  };

  const renderPorts = (inputs) => {
    const previousValue = midiPortSelect.value;
    midiPortSelect.innerHTML = '<option value="">Tous les ports</option>';
    for (const input of inputs) {
      const option = document.createElement('option');
      option.value = input.id;
      option.textContent = `${input.name} (${input.state})`;
      midiPortSelect.appendChild(option);
    }
    midiPortSelect.value = previousValue;
  };

  const logEvent = (kind, detail) => {
    const label = kind === 'noteon'
      ? `note-on ${detail.pitch} (${noteName(detail.pitch)}) vel=${detail.velocity} ch=${detail.channel + 1}`
      : `note-off ${detail.pitch} (${noteName(detail.pitch)}) ch=${detail.channel + 1}`;
    console.log(`[MIDI] ${label}`);

    const li = document.createElement('li');
    li.textContent = label;
    midiLogEl.prepend(li);
    while (midiLogEl.children.length > MAX_MIDI_LOG_ENTRIES) {
      midiLogEl.lastChild.remove();
    }
  };

  midiInput.addEventListener('noteon', (e) => logEvent('noteon', e.detail));
  midiInput.addEventListener('noteoff', (e) => logEvent('noteoff', e.detail));
  midiInput.addEventListener('statechange', (e) => renderPorts(e.detail.inputs));
  midiInput.addEventListener('error', (e) => console.error('[MIDI]', e.detail.message));

  midiPortSelect.addEventListener('change', () => {
    midiInput.selectInput(midiPortSelect.value || null);
  });

  midiConnectBtn.addEventListener('click', async () => {
    midiConnectBtn.disabled = true;
    setStatus('requesting');
    await midiInput.connect();
    setStatus(midiInput.status);
    midiConnectBtn.disabled = false;
  });

  // Exposé pour vérification manuelle en console.
  window.__midiInput = midiInput;
}

// --- Test manuel P3 : parsing MIDI de référence + timeline. Sera remplacé par
// ui/view-editor.js en P4.
const midiRefFileInput = document.getElementById('midi-ref-file-input');
const midiRefSummary = document.getElementById('midi-ref-summary');
const midiTimelineContainer = document.getElementById('midi-timeline-container');

if (midiRefFileInput && midiRefSummary && midiTimelineContainer) {
  const timeline = new MidiTimeline(midiTimelineContainer);

  midiRefFileInput.addEventListener('change', async () => {
    const file = midiRefFileInput.files?.[0];
    if (!file) return;
    const buf = await file.arrayBuffer();
    const { events, ppq, durationSec, trackCount } = parseReference(buf);
    midiRefSummary.textContent =
      `${events.length} événements · ${trackCount} pistes · ppq=${ppq} · ` +
      `durée=${durationSec.toFixed(1)}s`;
    console.log(`[MIDI ref] ${midiRefSummary.textContent}`);
    timeline.setEvents(events);
  });

  // Exposé pour vérification manuelle en console.
  window.__midiTimeline = timeline;
}
