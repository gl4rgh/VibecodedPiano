import { noteName } from '../util/note-names.js';

const ROW_HEIGHT = 28; // px — hauteur fixe, nécessaire pour calculer la fenêtre visible
const OVERSCAN = 8; // lignes de marge de chaque côté de la zone visible

/**
 * Liste virtualisée des RefEvent d'un morceau : seules les lignes visibles (± overscan)
 * existent dans le DOM. Un morceau peut faire plusieurs milliers d'événements — rendu par
 * fenêtre, pas d'innerHTML massif (plan.md §7/P3).
 */
export class MidiTimeline {
  /** @param {HTMLElement} container */
  constructor(container) {
    this.container = container;
    this.container.classList.add('midi-timeline');

    this._events = [];
    this._currentIndex = -1;
    this._rows = new Map(); // index -> HTMLElement
    this._raf = null;

    this._spacer = document.createElement('div');
    this._spacer.className = 'midi-timeline-spacer';
    this.container.appendChild(this._spacer);

    this._onScroll = this._onScroll.bind(this);
    this.container.addEventListener('scroll', this._onScroll, { passive: true });
  }

  /** @param {import('../core/midi-reference.js').RefEvent[]} events */
  setEvents(events) {
    this._events = events;
    this._currentIndex = -1;
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

  destroy() {
    this.container.removeEventListener('scroll', this._onScroll);
    if (this._raf) cancelAnimationFrame(this._raf);
    this.container.innerHTML = '';
    this._rows.clear();
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
      this._spacer.appendChild(el);
      this._rows.set(i, el);
    }
  }

  _buildRow(event) {
    const el = document.createElement('div');
    el.className = 'midi-timeline-row';
    const names = event.pitches.map(noteName).join(' ');
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
