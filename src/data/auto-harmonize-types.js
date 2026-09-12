/**
 * Les 12 types d'Auto Harmonize du CASIO CDP-S360/EP-S330 (Function 13 "AHarType").
 * Source : manuel utilisateur p.EN-36 — voir datamining/README.md §3.
 * Lecture seule : pas de commande MIDI receive documentée pour ce réglage, on ne peut que
 * l'afficher pour que l'utilisateur le règle à la main sur le piano.
 */

/**
 * @typedef {Object} AutoHarmonizeType
 * @property {number} number  1-12, celui affiché/réglé sur le piano
 * @property {string} name
 * @property {string} description
 */

/** @type {AutoHarmonizeType[]} */
export const AUTO_HARMONIZE_TYPES = [
  { number: 1, name: 'Duet 1', description: 'Harmonie resserrée (2-4 degrés) à 1 note sous la mélodie' },
  { number: 2, name: 'Duet 2', description: 'Harmonie ouverte (4-6 degrés) à 1 note sous la mélodie' },
  { number: 3, name: 'Country', description: 'Harmonie style country' },
  { number: 4, name: 'Octave', description: "Ajoute la note à l'octave inférieure" },
  { number: 5, name: '5th', description: 'Ajoute la quinte' },
  { number: 6, name: '3-Way Open', description: 'Harmonie ouverte à 2 notes (3 notes au total)' },
  { number: 7, name: '3-Way Close', description: 'Harmonie resserrée à 2 notes (3 notes au total)' },
  { number: 8, name: 'Strings', description: 'Harmonie optimisée cordes' },
  { number: 9, name: '4-Way Open', description: 'Harmonie ouverte à 3 notes (4 notes au total)' },
  { number: 10, name: '4-Way Close', description: 'Harmonie resserrée à 3 notes (4 notes au total)' },
  { number: 11, name: 'Block', description: 'Accords en blocs' },
  { number: 12, name: 'Big Band', description: 'Harmonie style big band' },
];
