const NOTE_FLASH_MS = 250;

/**
 * HUD discret du mode jeu : position dans le morceau, ancre active, pastille d'état MIDI,
 * dernière note reçue, compteur d'erreurs. Purement affichage — aucune logique de synchro ici
 * (voir view-play.js).
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
      '<span class="hud-last-note">en attente de notes…</span>' +
      '<span class="hud-errors">0 erreur</span>';

    this._positionEl = container.querySelector('.hud-position');
    this._anchorEl = container.querySelector('.hud-anchor');
    this._midiDotEl = container.querySelector('.hud-midi-dot');
    this._lastNoteEl = container.querySelector('.hud-last-note');
    this._errorsEl = container.querySelector('.hud-errors');
    this._flashTimer = null;
  }

  /**
   * Confirmation visuelle qu'une note vient d'être reçue par le clavier, indépendamment du
   * suivi (même en pause) — sans ça, rien ne prouve à l'écran que l'app écoute vraiment.
   * @param {string} label
   */
  flashNote(label) {
    this._lastNoteEl.textContent = label;
    this._lastNoteEl.classList.remove('flash');
    void this._lastNoteEl.offsetWidth; // relance l'animation même si la même note est répétée
    this._lastNoteEl.classList.add('flash');
    clearTimeout(this._flashTimer);
    this._flashTimer = setTimeout(() => this._lastNoteEl.classList.remove('flash'), NOTE_FLASH_MS);
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
