/**
 * Pré-écoute WebAudio du MIDI de référence : synthèse simple par oscillateur,
 * pour se repérer à l'oreille en posant des ancres — pas un rendu fidèle du morceau (les
 * RefEvent n'ont pas de durée par note, seulement un instant de départ ; la durée jouée est
 * dérivée de l'écart avec l'événement suivant).
 */
export class AudioPreview {
  constructor() {
    this._ctx = null;
    this._nodes = [];
    this._timers = [];
  }

  get playing() {
    return this._ctx !== null;
  }

  /**
   * @param {import('../core/midi-reference.js').RefEvent[]} events
   * @param {number} fromIndex index de départ (inclus)
   * @param {{ onEventStart?: (index:number) => void, onEnd?: () => void }} [callbacks]
   */
  play(events, fromIndex, { onEventStart, onEnd } = {}) {
    this.stop();
    if (events.length === 0 || fromIndex >= events.length) return;

    this._ctx = new AudioContext();
    const startAt = this._ctx.currentTime + 0.05;
    const startTime = events[fromIndex].time;

    for (let i = fromIndex; i < events.length; i++) {
      const event = events[i];
      const offset = event.time - startTime;
      const nextTime = events[i + 1]?.time ?? event.time + 1;
      const duration = Math.min(Math.max(nextTime - event.time - 0.02, 0.12), 1);

      for (const pitch of event.pitches) {
        const osc = this._ctx.createOscillator();
        const gain = this._ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 440 * 2 ** ((pitch - 69) / 12);
        gain.gain.setValueAtTime(0.0001, startAt + offset);
        gain.gain.exponentialRampToValueAtTime(0.2, startAt + offset + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, startAt + offset + duration);
        osc.connect(gain).connect(this._ctx.destination);
        osc.start(startAt + offset);
        osc.stop(startAt + offset + duration + 0.02);
        this._nodes.push(osc);
      }

      if (onEventStart) {
        this._timers.push(setTimeout(() => onEventStart(i), offset * 1000));
      }
    }

    const totalMs = ((events[events.length - 1].time - startTime) + 1.2) * 1000;
    this._timers.push(setTimeout(() => this.stop(onEnd), totalMs));
  }

  /** @param {() => void} [onEnd] */
  stop(onEnd) {
    for (const osc of this._nodes) {
      try {
        osc.stop();
      } catch {
        // déjà arrêté (fin naturelle de la note) : rien à faire.
      }
    }
    this._nodes = [];
    for (const timer of this._timers) clearTimeout(timer);
    this._timers = [];
    if (this._ctx) {
      this._ctx.close();
      this._ctx = null;
      onEnd?.();
    }
  }
}
