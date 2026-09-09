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
 * est totalement ignoré. Ce fichier et ses tests doivent être fiables avant tout câblage UI :
 * un bug de synchro est difficile à diagnostiquer une fois branché à l'affichage.
 *
 * `strictChords` (défaut false) : à false, jouer UNE SEULE note d'un accord suffit à faire
 * avancer le curseur au-delà de cet événement — tolère les accords incomplets ou joués en
 * arpège. Limite connue et acceptée : si une autre note du même accord est jouée juste après
 * cette avance, elle est réévaluée contre l'événement suivant ; si elle ne s'y trouve pas, une
 * recherche arrière (`rewind`) la retrouve dans l'accord qu'on vient de quitter, puis la même
 * règle de complétion immédiate renvoie aussitôt le curseur à sa position — net : aucune
 * dérive (`advanced` reste `false`), seul le `kind` rapporté pour cet appel est `'rewind'` au
 * lieu de `'match'`. À `true`, toutes les notes de l'accord doivent être jouées avant d'avancer.
 *
 * La recherche d'une note absente de l'événement courant se fait en avant ET en arrière, et
 * retient la correspondance la plus proche du curseur plutôt que de toujours privilégier
 * l'avant : chercher systématiquement en avant d'abord, une note en retard (leniency d'accord
 * ci-dessus) qui réapparaît plus loin dans le morceau faisait sauter le curseur à cette
 * occurrence lointaine au lieu de la corriger juste derrière — reproduit sur une gamme mains
 * ensemble où les deux mains partagent les mêmes hauteurs à plusieurs octaves. Voir `_findNearest`.
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

    // Cas 2/3 : recherche avant ET arrière, on retient la correspondance la PLUS PROCHE du
    // curseur (pas systématiquement l'avant — voir _findNearest ci-dessous).
    const found = this._findNearest(pitch);
    if (found) {
      this._jumpTo(found.index, pitch);
      if (found.kind === 'skip') this._stats.skipped++;
      else this._stats.rewinds++;
      return { kind: found.kind, cursor: this._cursor, advanced: this._cursor !== cursorBefore };
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

  /**
   * Cherche `pitch` en avant ET en arrière, retourne la correspondance la plus proche du
   * curseur (égalité tranchée en faveur de l'avant, pour privilégier la progression). Toujours
   * chercher l'avant avant l'arrière casse dès qu'une hauteur rejouée en retard (leniency
   * d'accord, cf. doc de la classe) réapparaît PLUS LOIN dans le morceau — un simple décalage
   * de main peut alors faire sauter le curseur à cette occurrence lointaine au lieu de la
   * corriger juste derrière. Confirmé sur un exercice de gammes mains ensemble, où les deux
   * mains partagent les mêmes hauteurs à plusieurs octaves.
   * @param {number} pitch
   * @returns {{ index:number, kind:'skip'|'rewind' } | null}
   */
  _findNearest(pitch) {
    const ahead = this._findAhead(pitch);
    const behind = this._findBehind(pitch);
    if (ahead === -1 && behind === -1) return null;
    if (ahead === -1) return { index: behind, kind: 'rewind' };
    if (behind === -1) return { index: ahead, kind: 'skip' };
    const aheadDist = ahead - this._cursor;
    const behindDist = this._cursor - behind;
    return aheadDist <= behindDist ? { index: ahead, kind: 'skip' } : { index: behind, kind: 'rewind' };
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
