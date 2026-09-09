/**
 * @typedef {Object} Settings
 * @property {number}       lead             pré-roll de l'ancre, en événements
 * @property {number}       lookahead        fenêtre de recherche avant du matcher
 * @property {number}       lookbehind       fenêtre de recherche arrière du matcher
 * @property {number}       chordWindowMs    fenêtre de regroupement en accords (parseReference)
 * @property {boolean}      octaveAgnostic   tolère les erreurs d'octave
 * @property {boolean}      strictChords     true = toutes les notes d'un accord requises
 * @property {number}       scrollSuspendMs  délai avant réarmement de l'auto-scroll après un scroll manuel
 * @property {number|null}  defaultZoom      échelle initiale du PDF ; null = ajustement auto à la largeur
 */

/** @type {Settings} */
export const DEFAULT_SETTINGS = {
  lead: 4,
  lookahead: 8,
  lookbehind: 4,
  chordWindowMs: 40,
  octaveAgnostic: false,
  strictChords: false,
  scrollSuspendMs: 4000,
  defaultZoom: null,
};

/**
 * Fusionne DEFAULT_SETTINGS <- réglages globaux <- surcharge du morceau. À chaque niveau,
 * seules les clés définies (ni `undefined` ni `null` ni chaîne vide) l'emportent sur le
 * niveau précédent — un champ laissé vide dans un formulaire de surcharge signifie
 * « hérite du niveau au-dessus », pas « remets à zéro ».
 * @param {Partial<Settings>} [global]
 * @param {Partial<Settings>} [piece]
 * @returns {Settings}
 */
export function resolveSettings(global, piece) {
  return { ...DEFAULT_SETTINGS, ...clean(global), ...clean(piece) };
}

function clean(obj) {
  if (!obj) return {};
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  );
}
