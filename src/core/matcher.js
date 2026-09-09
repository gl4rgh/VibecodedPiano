const DEFAULT_LOOKAHEAD = 8;
const DEFAULT_LOOKBEHIND = 4;

/**
 * @typedef {Object} MatcherOptions
 * @property {number}  [lookahead=8]        fenêtre de recherche avant
 * @property {number}  [lookbehind=4]       fenêtre de recherche arrière (reprises)
 * @property {boolean} [octaveAgnostic=false]
 * @property {boolean} [strictChords=false] true = tous les pitches d'un accord requis
 */

/**
 * @typedef {Object} MatchResult
 * @property {'match'|'skip'|'rewind'|'reject'} kind
 * @property {number} cursor      curseur APRÈS traitement
 * @property {boolean} advanced   le curseur a-t-il changé
 */

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Suit la position dans un morceau à partir de la seule suite de hauteurs jouées — le timing
 * est totalement ignoré. Voir plan.md §6 pour l'algorithme complet (4 cas de `onNoteOn`) et
 * §11 : ce fichier et ses tests doivent être corrects avant tout câblage UI, un bug de sync est
 * difficile à diagnostiquer une fois branché à l'affichage.
 *
 * `strictChords` (défaut false) : à false, jouer UNE SEULE note d'un accord suffit à faire
 * avancer le curseur au-delà de cet événement — tolère les accords incomplets ou joués en
 * arpège (plan.md §9). Limite connue et acceptée : si une autre note du même accord est jouée
 * juste après cette avance, elle est réévaluée contre l'événement suivant ; si elle ne s'y
 * trouve pas, une recherche arrière (`rewind`) la retrouve dans l'accord qu'on vient de
 * quitter, puis la même règle de complétion immédiate renvoie aussitôt le curseur à sa
 * position — net : aucune dérive (`advanced` reste `false`), seul le `kind` rapporté pour cet
 * appel est `'rewind'` au lieu de `'match'`. À `true`, toutes les notes de l'accord doivent
 * être jouées avant d'avancer (cas 1 de l'algorithme, au pied de la lettre).
 */
export class Matcher {
  /**
   * @param {import('./midi-reference.js').RefEvent[]} events
   * @param {MatcherOptions} [opts]
   */
  constructor(events, opts = {}) {
    this._events = events;
    this._lookahead = opts.lookahead ?? DEFAULT_LOOKAHEAD;
    this._lookbehind = opts.lookbehind ?? DEFAULT_LOOKBEHIND;
    this._octaveAgnostic = opts.octaveAgnostic ?? false;
    this._strictChords = opts.strictChords ?? false;
    this.reset();
  }

  reset() {
    this._cursor = 0;
    this._pending = this._pitchSetAt(0);
    this._stats = { matched: 0, skipped: 0, rejected: 0, rewinds: 0 };
  }

  /** @param {number} index */
  seekToEvent(index) {
    this._cursor = clamp(index, 0, this._events.length);
    this._pending = this._pitchSetAt(this._cursor);
  }

  /** @returns {number} index de l'événement en cours */
  get cursor() {
    return this._cursor;
  }

  /** @returns {number} cursor / events.length, dans [0,1] */
  get progress() {
    return this._events.length === 0 ? 0 : Math.min(this._cursor / this._events.length, 1);
  }

  get stats() {
    return { ...this._stats };
  }

  /**
   * @param {number} pitch
   * @returns {MatchResult}
   */
  onNoteOn(pitch) {
    const cursorBefore = this._cursor;

    if (this._events.length === 0) {
      this._stats.rejected++;
      return { kind: 'reject', cursor: this._cursor, advanced: false };
    }

    // Cas 1 : la note appartient à l'événement courant (pending).
    if (this._removeMatch(this._pending, pitch)) {
      this._resolveIfComplete();
      this._stats.matched++;
      return { kind: 'match', cursor: this._cursor, advanced: this._cursor !== cursorBefore };
    }

    // Cas 2 : recherche en avant — note omise, accord roulé, saut.
    const ahead = this._findAhead(pitch);
    if (ahead !== -1) {
      this._jumpTo(ahead, pitch);
      this._stats.skipped++;
      return { kind: 'skip', cursor: this._cursor, advanced: this._cursor !== cursorBefore };
    }

    // Cas 3 : recherche en arrière — reprise d'un passage.
    const behind = this._findBehind(pitch);
    if (behind !== -1) {
      this._jumpTo(behind, pitch);
      this._stats.rewinds++;
      return { kind: 'rewind', cursor: this._cursor, advanced: this._cursor !== cursorBefore };
    }

    // Cas 4 : aucune correspondance — fausse note, résonance de pédale, etc. Le curseur ne bouge pas.
    this._stats.rejected++;
    return { kind: 'reject', cursor: this._cursor, advanced: false };
  }

  _pitchSetAt(index) {
    return new Set(this._events[index]?.pitches ?? []);
  }

  _matches(a, b) {
    return this._octaveAgnostic ? a % 12 === b % 12 : a === b;
  }

  /** Retire de `set` une entrée correspondant à `pitch` (selon octaveAgnostic). */
  _removeMatch(set, pitch) {
    for (const entry of set) {
      if (this._matches(entry, pitch)) {
        set.delete(entry);
        return true;
      }
    }
    return false;
  }

  /** Avance le curseur si l'événement courant est entièrement joué, ou immédiatement si
   * strictChords est false (une seule note d'un accord suffit, voir doc de la classe). */
  _resolveIfComplete() {
    if (this._pending.size === 0 || !this._strictChords) {
      this._cursor = Math.min(this._cursor + 1, this._events.length);
      this._pending = this._pitchSetAt(this._cursor);
    }
  }

  _findAhead(pitch) {
    const start = this._cursor + 1;
    const end = Math.min(this._events.length - 1, this._cursor + this._lookahead);
    for (let i = start; i <= end; i++) {
      if (this._events[i].pitches.some((p) => this._matches(p, pitch))) return i;
    }
    return -1;
  }

  _findBehind(pitch) {
    const start = Math.max(0, this._cursor - this._lookbehind);
    for (let i = this._cursor - 1; i >= start; i--) {
      if (this._events[i].pitches.some((p) => this._matches(p, pitch))) return i;
    }
    return -1;
  }

  _jumpTo(index, pitch) {
    this._cursor = index;
    this._pending = this._pitchSetAt(index);
    this._removeMatch(this._pending, pitch);
    this._resolveIfComplete();
  }
}
