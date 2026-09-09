import { PdfViewer } from '../pdf/pdf-viewer.js';
import { MidiInput } from '../core/midi-input.js';
import { Matcher } from '../core/matcher.js';
import { parseReference } from '../core/midi-reference.js';
import { getPiece } from '../core/store.js';
import { sortAnchors, resolveActiveAnchor } from '../core/anchors.js';
import { Hud } from './hud.js';
import { ScreenWakeLock } from '../util/wake-lock.js';

const DEFAULT_LEAD = 4;

/**
 * Vue « Mode jeu » : plein écran, PDF seul + HUD discret en surimpression. Câblage
 * noteon -> matcher.onNoteOn -> resolveActiveAnchor -> viewer.scrollToAnchor (plan.md §6.4).
 * @param {HTMLElement} container
 * @returns {{ open: (id:string) => Promise<void>, close: () => void }}
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
  const connectMidiBtn = container.querySelector('#play-connect-midi');

  const pdfViewer = new PdfViewer(pdfContainer);
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
    pauseBtn.textContent = paused ? 'Reprendre' : 'Pause';
  });

  recenterBtn.addEventListener('click', () => jumpToCursor({ force: true }));

  /** Note-on -> avance du matcher -> ancre active -> scroll (§6.4). Ignoré pendant la pause. */
  function onNoteOn(pitch) {
    if (!matcher || paused) return;
    matcher.onNoteOn(pitch);
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
    return piece?.settings?.lead ?? DEFAULT_LEAD;
  }

  function refreshHud() {
    if (!matcher) return;
    hud.setPosition(matcher.cursor, refEvents.length);
    hud.setErrorCount(matcher.stats.rejected);
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
    pauseBtn.textContent = 'Pause';

    const midiBuf = await piece.midiBlob.arrayBuffer();
    refEvents = parseReference(midiBuf).events;

    const matcherOpts = {
      lookahead: piece.settings?.lookahead,
      lookbehind: piece.settings?.lookbehind,
      octaveAgnostic: piece.settings?.octaveAgnostic,
      strictChords: piece.settings?.strictChords,
    };
    matcher = new Matcher(refEvents, matcherOpts);

    await pdfViewer.load(piece.pdfBlob);
    hud.setMidiStatus(midiInput.status);
    refreshHud();
    jumpToCursor({ force: true });

    await wakeLock.enable();
  }

  async function close() {
    await wakeLock.disable();
  }

  return { open, close };
}
