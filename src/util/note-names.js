const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Convertit un numéro de note MIDI en nom (convention standard : 60 -> "C4").
 * @param {number} pitch  0..127
 * @returns {string}
 */
export function noteName(pitch) {
  const name = NAMES[pitch % 12];
  const octave = Math.floor(pitch / 12) - 1;
  return `${name}${octave}`;
}
