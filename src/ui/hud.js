/**
 * HUD discret du mode jeu : position dans le morceau, ancre active, pastille d'état MIDI,
 * compteur d'erreurs. Purement affichage — aucune logique de synchro ici (voir view-play.js).
 */
export class Hud {
  /** @param {HTMLElement} container */
  constructor(container) {
    this.container = container;
    container.classList.add('hud');
    container.innerHTML =
      '<span class="hud-position">0/0</span>' +
      '<span class="hud-anchor">—</span>' +
      '<span class="hud-midi-dot" data-status="idle" title="idle"></span>' +
      '<span class="hud-errors">0 erreur</span>';

    this._positionEl = container.querySelector('.hud-position');
    this._anchorEl = container.querySelector('.hud-anchor');
    this._midiDotEl = container.querySelector('.hud-midi-dot');
    this._errorsEl = container.querySelector('.hud-errors');
  }

  /** @param {number} cursor @param {number} total */
  setPosition(cursor, total) {
    this._positionEl.textContent = `${Math.min(cursor, total)}/${total}`;
  }

  /** @param {string | null} label */
  setActiveAnchor(label) {
    this._anchorEl.textContent = label || '—';
  }

  /** @param {'idle'|'requesting'|'ready'|'denied'|'unsupported'} status */
  setMidiStatus(status) {
    this._midiDotEl.dataset.status = status;
    this._midiDotEl.title = status;
  }

  /** @param {number} count */
  setErrorCount(count) {
    this._errorsEl.textContent = `${count} erreur${count === 1 ? '' : 's'}`;
  }
}
