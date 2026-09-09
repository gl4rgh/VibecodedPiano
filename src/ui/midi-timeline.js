import { noteName } from '../util/note-names.js';

const ROW_HEIGHT = 28; // px — hauteur fixe, nécessaire pour calculer la fenêtre visible
const OVERSCAN = 8; // lignes de marge de chaque côté de la zone visible

/**
 * Liste virtualisée des RefEvent d'un morceau : seules les lignes visibles (± overscan)
 * existent dans le DOM. Un morceau peut faire plusieurs milliers d'événements — rendu par
 * fenêtre, pas d'innerHTML massif.
 *
 * Émet un CustomEvent 'select' (detail: { index }) au clic sur une ligne — utilisé par
 * l'éditeur d'ancres pour le mode « sélectionner un événement puis cliquer sur le PDF ».
 */
export class MidiTimeline extends EventTarget {
  /**
   * @param {HTMLElement} container
   * @param {{ noteScheme?: 'en'|'solfege' }} [opts]
   */
  constructor(container, opts = {}) {
    super();
    this.container = container;
    this.container.classList.add('midi-timeline');

    this._events = [];
    this._currentIndex = -1;
    this._selectedIndex = -1;
    this._noteScheme = opts.noteScheme ?? 'en';
    this._rows = new Map(); // index -> HTMLElement
    this._raf = null;

    this._spacer = document.createElement('div');
    this._spacer.className = 'midi-timeline-spacer';
    this.container.appendChild(this._spacer);

    this._onScroll = this._onScroll.bind(this);
    this._onClick = this._onClick.bind(this);
    this.container.addEventListener('scroll', this._onScroll, { passive: true });
    this.container.addEventListener('click', this._onClick);
  }

  /** @param {import('../core/midi-reference.js').RefEvent[]} events */
  setEvents(events) {
    this._events = events;
    this._currentIndex = -1;
    this._selectedIndex = -1;
    this._spacer.style.height = `${events.length * ROW_HEIGHT}px`;
    this._spacer.innerHTML = '';
    this._rows.clear();
    this._renderWindow();
  }

  /** Surligne l'événement courant (curseur du matcher). */
  setCurrentIndex(index) {
    this._rows.get(this._currentIndex)?.classList.remove('current');
    this._currentIndex = index;
    this._rows.get(index)?.classList.add('current');
  }

  /** Surligne l'événement sélectionné dans l'éditeur d'ancres, distinct du curseur du matcher. */
  setSelectedIndex(index) {
    this._rows.get(this._selectedIndex)?.classList.remove('selected');
    this._selectedIndex = index;
    this._rows.get(index)?.classList.add('selected');
    this._ensureVisible(index);
  }

  _ensureVisible(index) {
    if (index == null || index < 0 || index >= this._events.length) return;
    const top = index * ROW_HEIGHT;
    const bottom = top + ROW_HEIGHT;
    if (top < this.container.scrollTop || bottom > this.container.scrollTop + this.container.clientHeight) {
      this.container.scrollTop = top - this.container.clientHeight / 2;
    }
  }

  /** @param {'en'|'solfege'} scheme */
  setNoteScheme(scheme) {
    if (scheme === this._noteScheme) return;
    this._noteScheme = scheme;
    for (const el of this._rows.values()) el.remove();
    this._rows.clear();
    this._renderWindow();
  }

  destroy() {
    this.container.removeEventListener('scroll', this._onScroll);
    this.container.removeEventListener('click', this._onClick);
    if (this._raf) cancelAnimationFrame(this._raf);
    this.container.innerHTML = '';
    this._rows.clear();
  }

  _onClick(e) {
    const row = e.target.closest('.midi-timeline-row');
    if (!row) return;
    for (const [index, el] of this._rows) {
      if (el === row) {
        this.dispatchEvent(new CustomEvent('select', { detail: { index } }));
        return;
      }
    }
  }

  _onScroll() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = null;
      this._renderWindow();
    });
  }

  _renderWindow() {
    if (this._events.length === 0) return;

    const scrollTop = this.container.scrollTop;
    const viewportHeight = this.container.clientHeight;
    const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
    const last = Math.min(
      this._events.length - 1,
      Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN,
    );

    for (const [index, el] of this._rows) {
      if (index < first || index > last) {
        el.remove();
        this._rows.delete(index);
      }
    }

    for (let i = first; i <= last; i++) {
      if (this._rows.has(i)) continue;
      const el = this._buildRow(this._events[i]);
      el.style.top = `${i * ROW_HEIGHT}px`;
      if (i === this._currentIndex) el.classList.add('current');
      if (i === this._selectedIndex) el.classList.add('selected');
      this._spacer.appendChild(el);
      this._rows.set(i, el);
    }
  }

  _buildRow(event) {
    const el = document.createElement('div');
    el.className = 'midi-timeline-row';
    const names = event.pitches.map((p) => noteName(p, this._noteScheme)).join(' ');
    el.innerHTML =
      `<span class="midi-timeline-index">${event.index}</span>` +
      `<span class="midi-timeline-time">${formatTime(event.time)}</span>` +
      `<span class="midi-timeline-notes">${names}</span>`;
    return el;
  }
}

/** @param {number} seconds @returns {string} mm:ss */
function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}
