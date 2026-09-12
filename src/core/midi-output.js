const CONTROL_CHANGE = 0xb0;
const PROGRAM_CHANGE = 0xc0;
const BANK_SELECT_MSB = 0x00;
const SYSEX_START = 0xf0;
const SYSEX_END = 0xf7;

/**
 * @typedef {Object} OutputInfo
 * @property {string} id
 * @property {string} name
 * @property {string} manufacturer
 * @property {string} state
 */

/**
 * Accès Web MIDI en sortie : connexion, liste des ports, sélection, envoi de messages
 * (Program Change, Control Change, SysEx). Symétrique de MidiInput (core/midi-input.js).
 * Émet (CustomEvent) : 'statechange' {outputs}, 'error' {message}.
 *
 * Demande sysex:true dès la connexion : Reverb/Chorus Type et Master Tuning (CDP-S360) passent
 * par du SysEx Universal Real Time, redemander la permission plus tard casserait l'UX.
 */
export class MidiOutput extends EventTarget {
  constructor() {
    super();
    /** @type {MIDIAccess|null} */
    this._access = null;
    this._selectedId = null;
    this._status = 'idle';
    this._onStateChange = this._onStateChange.bind(this);
  }

  /** @returns {'idle'|'requesting'|'ready'|'denied'|'unsupported'} */
  get status() {
    return this._status;
  }

  /** Demande l'accès Web MIDI. À appeler depuis un geste utilisateur : certains navigateurs
   * refusent silencieusement la permission sinon. */
  async connect() {
    if (typeof navigator === 'undefined' || !navigator.requestMIDIAccess) {
      this._status = 'unsupported';
      this._emitError("Web MIDI n'est pas supporté par ce navigateur.");
      return;
    }

    this._status = 'requesting';
    try {
      this._access = await navigator.requestMIDIAccess({ sysex: true });
    } catch (err) {
      this._status = 'denied';
      this._emitError(err?.message || "Accès MIDI refusé.");
      return;
    }

    this._status = 'ready';
    this._access.onstatechange = this._onStateChange;
    this._emitStateChange();
  }

  /** @returns {OutputInfo[]} */
  listOutputs() {
    if (!this._access) return [];
    return Array.from(this._access.outputs.values(), toOutputInfo);
  }

  /** @param {string|null} id */
  selectOutput(id) {
    this._selectedId = id || null;
  }

  /** @returns {MIDIOutput|null} */
  get selectedOutput() {
    if (!this._access || !this._selectedId) return null;
    return this._access.outputs.get(this._selectedId) || null;
  }

  disconnect() {
    if (this._access) {
      this._access.onstatechange = null;
    }
    this._access = null;
    this._selectedId = null;
    this._status = 'idle';
  }

  _onStateChange() {
    this._emitStateChange();
  }

  _emitStateChange() {
    this.dispatchEvent(new CustomEvent('statechange', { detail: { outputs: this.listOutputs() } }));
  }

  _emitError(message) {
    this.dispatchEvent(new CustomEvent('error', { detail: { message } }));
  }

  /** Envoie des octets bruts au port sélectionné. @param {number[]} bytes */
  send(bytes) {
    const output = this.selectedOutput;
    if (!output) {
      this._emitError('Aucun port MIDI de sortie sélectionné.');
      return;
    }
    output.send(bytes);
  }

  /** @param {number} channel 0-15 @param {number} program 0-127 */
  programChange(channel, program) {
    this.send([PROGRAM_CHANGE | (channel & 0x0f), program & 0x7f]);
  }

  /** @param {number} channel 0-15 @param {number} msb 0-127 */
  bankSelectMSB(channel, msb) {
    this.controlChange(channel, BANK_SELECT_MSB, msb);
  }

  /** @param {number} channel 0-15 @param {number} cc 0-127 @param {number} value 0-127 */
  controlChange(channel, cc, value) {
    this.send([CONTROL_CHANGE | (channel & 0x0f), cc & 0x7f, value & 0x7f]);
  }

  /** SysEx : encadre automatiquement de F0/F7.
   * @param {number[]} bytes contenu entre F0 et F7 (ID constructeur/universal + data), sans les
   * délimiteurs eux-mêmes. */
  sysex(bytes) {
    this.send([SYSEX_START, ...bytes, SYSEX_END]);
  }
}

/** @param {MIDIOutput} output @returns {OutputInfo} */
function toOutputInfo(output) {
  return {
    id: output.id,
    name: output.name || '',
    manufacturer: output.manufacturer || '',
    state: output.state,
  };
}
