const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;

/**
 * @typedef {Object} InputInfo
 * @property {string} id
 * @property {string} name
 * @property {string} manufacturer
 * @property {string} state
 */

/**
 * Accès Web MIDI en entrée : connexion, liste des ports, sélection, hot-plug.
 * Émet (CustomEvent) : 'noteon' {pitch,velocity,channel,time}, 'noteoff' {pitch,channel,time},
 * 'statechange' {inputs}, 'error' {message}. Voir plan.md §5 pour le contrat complet.
 */
export class MidiInput extends EventTarget {
  constructor() {
    super();
    /** @type {MIDIAccess|null} */
    this._access = null;
    this._selectedId = null;
    this._status = 'idle';
    this._onMidiMessage = this._onMidiMessage.bind(this);
    this._onStateChange = this._onStateChange.bind(this);
  }

  /** @returns {'idle'|'requesting'|'ready'|'denied'|'unsupported'} */
  get status() {
    return this._status;
  }

  /** Demande l'accès Web MIDI. À appeler depuis un geste utilisateur (piège plan.md §8.6). */
  async connect() {
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      this._status = 'unsupported';
      this._emitError("Web MIDI n'est pas supporté par ce navigateur.");
      return;
    }

    this._status = 'requesting';
    try {
      this._access = await navigator.requestMIDIAccess({ sysex: false });
    } catch (err) {
      this._status = 'denied';
      this._emitError(err?.message || "Accès MIDI refusé.");
      return;
    }

    this._status = 'ready';
    this._access.onstatechange = this._onStateChange;
    this._attachAllInputs();
    this._emitStateChange();
  }

  /** @returns {InputInfo[]} */
  listInputs() {
    if (!this._access) return [];
    return Array.from(this._access.inputs.values(), toInputInfo);
  }

  /** @param {string|null} id  null = écouter tous les ports */
  selectInput(id) {
    this._selectedId = id || null;
  }

  disconnect() {
    if (this._access) {
      this._access.onstatechange = null;
      for (const input of this._access.inputs.values()) {
        input.onmidimessage = null;
      }
    }
    this._access = null;
    this._selectedId = null;
    this._status = 'idle';
  }

  _attachAllInputs() {
    if (!this._access) return;
    for (const input of this._access.inputs.values()) {
      input.onmidimessage = this._onMidiMessage;
    }
  }

  _onStateChange() {
    // Rebranche les handlers (un port qui revient peut être un nouvel objet MIDIInput
    // selon les navigateurs) — permet une reconnexion à chaud sans recharger la page.
    this._attachAllInputs();
    this._emitStateChange();
  }

  _emitStateChange() {
    this.dispatchEvent(new CustomEvent('statechange', { detail: { inputs: this.listInputs() } }));
  }

  _emitError(message) {
    this.dispatchEvent(new CustomEvent('error', { detail: { message } }));
  }

  _onMidiMessage(event) {
    if (this._selectedId && event.target.id !== this._selectedId) return;

    const statusByte = event.data[0];
    const command = statusByte & 0xf0;
    // Ignore tout ce qui n'est pas note-on/note-off : horloge (0xF8), sysex, CC, etc.
    // (les messages système temps réel n'ont pas le bit 0x80 posé, donc jamais 0x80/0x90 ici.)
    if (command !== NOTE_ON && command !== NOTE_OFF) return;

    const channel = statusByte & 0x0f;
    const pitch = event.data[1];
    const velocity = event.data[2];

    // Piège plan.md §8.1 : note-on vélocité 0 = note-off (le CDP-360 l'utilise).
    if (command === NOTE_ON && velocity > 0) {
      this.dispatchEvent(new CustomEvent('noteon', {
        detail: { pitch, velocity, channel, time: event.timeStamp },
      }));
    } else {
      this.dispatchEvent(new CustomEvent('noteoff', {
        detail: { pitch, channel, time: event.timeStamp },
      }));
    }
  }
}

/** @param {MIDIInput} input @returns {InputInfo} */
function toInputInfo(input) {
  return {
    id: input.id,
    name: input.name || '',
    manufacturer: input.manufacturer || '',
    state: input.state,
  };
}
