import { Midi } from '@tonejs/midi';

/** @typedef {'idle'|'recording'|'paused'|'stopped'} RecorderState */

/**
 * Enregistreur de morceau, entièrement côté app (voir fonctions.md Phase B) : capture des paires
 * noteOn/noteOff et les convertit en fichier `.mid` exportable (@tonejs/midi). Ne dépend pas de
 * `MidiInput` directement — c'est l'appelant (Étape B2, UI) qui relaie ses events `noteon`/
 * `noteoff` vers `noteOn()`/`noteOff()` ; garde le recorder testable sans navigateur/EventTarget.
 *
 * Contrairement à l'enregistreur interne du piano (pas de pause, voir datamining/README.md §7),
 * la pause est gérée en excluant le temps écoulé en pause du minutage des notes, plutôt que de
 * laisser un "trou" silencieux dans le fichier exporté.
 */
export class Recorder {
  /** @param {{ now?: () => number }} [opts] horloge injectable pour les tests */
  constructor({ now = () => performance.now() } = {}) {
    this._now = now;
    this._state = /** @type {RecorderState} */ ('idle');
    this._events = [];
    this._openNotes = new Map();
    this._startedAt = 0;
    this._pausedAt = 0;
    this._pausedDurationMs = 0;
  }

  /** @returns {RecorderState} */
  get state() {
    return this._state;
  }

  start() {
    this._events = [];
    this._openNotes.clear();
    this._pausedDurationMs = 0;
    this._startedAt = this._now();
    this._state = 'recording';
  }

  pause() {
    if (this._state !== 'recording') return;
    this._pausedAt = this._now();
    this._state = 'paused';
  }

  resume() {
    if (this._state !== 'paused') return;
    this._pausedDurationMs += this._now() - this._pausedAt;
    this._state = 'recording';
  }

  /** Clôt les notes encore tenues à l'instant du stop plutôt que de les perdre. */
  stop() {
    if (this._state === 'idle' || this._state === 'stopped') return;
    const time = this._elapsedSec();
    for (const [pitch, open] of this._openNotes) {
      this._pushNote(pitch, open, time);
    }
    this._openNotes.clear();
    this._state = 'stopped';
  }

  /** @param {number} pitch 0-127 @param {number} velocity 0-127 */
  noteOn(pitch, velocity) {
    if (this._state !== 'recording') return;
    this._openNotes.set(pitch, { time: this._elapsedSec(), velocity });
  }

  /** @param {number} pitch 0-127 */
  noteOff(pitch) {
    if (this._state !== 'recording' && this._state !== 'paused') return;
    const open = this._openNotes.get(pitch);
    if (!open) return;
    this._openNotes.delete(pitch);
    this._pushNote(pitch, open, this._elapsedSec());
  }

  _pushNote(pitch, open, endTime) {
    this._events.push({
      pitch,
      velocity: open.velocity,
      time: open.time,
      duration: Math.max(endTime - open.time, 0.001),
    });
  }

  _elapsedSec() {
    const now = this._now();
    const pausedMs = this._pausedDurationMs + (this._state === 'paused' ? now - this._pausedAt : 0);
    return (now - this._startedAt - pausedMs) / 1000;
  }

  /** @returns {Midi} converti depuis les notes capturées, prêt pour `.toArray()` */
  toMidi() {
    const midi = new Midi();
    const track = midi.addTrack();
    for (const { pitch, velocity, time, duration } of this._events) {
      track.addNote({ midi: pitch, time, duration, velocity: velocity / 127 });
    }
    return midi;
  }
}
