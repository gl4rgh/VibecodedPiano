const NAMES_EN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NAMES_SOLFEGE = ['Do', 'Do#', 'Ré', 'Ré#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];

/**
 * Convertit un numéro de note MIDI en nom (convention standard : l'octave change à C/Do).
 * @param {number} pitch  0..127
 * @param {'en'|'solfege'} [scheme='en']
 * @returns {string}
 */
export function noteName(pitch, scheme = 'en') {
  const names = scheme === 'solfege' ? NAMES_SOLFEGE : NAMES_EN;
  const name = names[pitch % 12];
  const octave = Math.floor(pitch / 12) - 1;
  return `${name}${octave}`;
}
