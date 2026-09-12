/**
 * Types de Reverb/Chorus pilotables en MIDI sur le CASIO CDP-S360/EP-S330 (SysEx Universal Real
 * Time, tables 13.6/13.7 du MIDI Implementation — voir datamining/README.md §2, ligne 29-30).
 *
 * `value` = octet brut à envoyer dans le SysEx Reverb/Chorus Type (F0 7F 7F 04 05 ...).
 * Attention : ce ne sont PAS les mêmes listes que le menu FUNCTION du piano (11 réglages Reverb /
 * 5 Chorus, incluant "Off") — seules ces 6 valeurs par effet sont documentées comme réceptibles
 * en MIDI, donc c'est la seule liste qu'on peut faire agir depuis l'app.
 */

/** @type {{ value: number, name: string }[]} */
export const REVERB_TYPES = [
  { value: 0x00, name: 'Small Room' },
  { value: 0x01, name: 'Medium Room' },
  { value: 0x02, name: 'Large Room' },
  { value: 0x03, name: 'Medium Hall' },
  { value: 0x04, name: 'Large Hall' },
  { value: 0x08, name: 'Plate' },
];

/** @type {{ value: number, name: string }[]} */
export const CHORUS_TYPES = [
  { value: 0x00, name: 'Chorus 1' },
  { value: 0x01, name: 'Chorus 2' },
  { value: 0x02, name: 'Chorus 3' },
  { value: 0x03, name: 'Chorus 4' },
  { value: 0x04, name: 'FB Chorus' },
  { value: 0x05, name: 'Flanger' },
];
