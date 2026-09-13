/** Lecture WebAudio d'une séquence de notes déjà résolues — synthèse par oscillateur, pas un rendu fidèle du piano. */
export class MidiPlayback {
  constructor() {
    this._ctx = null;
    this._nodes = [];
    this._timer = null;
  }

  get playing() {
    return this._ctx !== null;
  }

  /**
   * @param {{ midi:number, time:number, duration:number, velocity:number }[]} notes
   * @param {{ onEnd?: () => void }} [callbacks]
   */
  play(notes, { onEnd } = {}) {
    this.stop();
    if (notes.length === 0) return;

    this._ctx = new AudioContext();
    const startAt = this._ctx.currentTime + 0.05;

    for (const note of notes) {
      const osc = this._ctx.createOscillator();
      const gain = this._ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 440 * 2 ** ((note.midi - 69) / 12);
      const peak = Math.max(note.velocity, 0.05) * 0.3;
      gain.gain.setValueAtTime(0.0001, startAt + note.time);
      gain.gain.exponentialRampToValueAtTime(peak, startAt + note.time + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + note.time + note.duration);
      osc.connect(gain).connect(this._ctx.destination);
      osc.start(startAt + note.time);
      osc.stop(startAt + note.time + note.duration + 0.02);
      this._nodes.push(osc);
    }

    const totalMs = (Math.max(...notes.map((n) => n.time + n.duration)) + 0.3) * 1000;
    this._timer = setTimeout(() => this.stop(onEnd), totalMs);
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
    clearTimeout(this._timer);
    this._timer = null;
    if (this._ctx) {
      this._ctx.close();
      this._ctx = null;
      onEnd?.();
    }
  }
}
