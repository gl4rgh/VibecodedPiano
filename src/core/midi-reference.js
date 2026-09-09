import { Midi } from '@tonejs/midi';

const DEFAULT_CHORD_WINDOW_MS = 40;
// "Canal 10" en notation humaine/GM (1-based) = canal 9 en notation MIDI brute (0-based).
const PERCUSSION_CHANNEL = 9;

/**
 * @typedef {Object} RefEvent
 * @property {number}   index    position dans la séquence (0-based)
 * @property {number}   ticks    ticks MIDI du début du groupe
 * @property {number}   time     secondes (au tempo du fichier)
 * @property {number[]} pitches  numéros MIDI triés croissants, dédoublonnés
 */

/**
 * Parse un MIDI de référence : fusionne les notes de toutes les pistes (hors percussions),
 * les trie par ticks puis pitch, et les regroupe en RefEvent (accords) selon chordWindowMs.
 * Voir plan.md §5 et §6.
 * @param {ArrayBuffer} buf
 * @param {{chordWindowMs?:number}} [opts]
 * @returns {{ events: RefEvent[], ppq:number, durationSec:number, trackCount:number }}
 */
export function parseReference(buf, opts = {}) {
  const chordWindowMs = opts.chordWindowMs ?? DEFAULT_CHORD_WINDOW_MS;
  const midi = new Midi(buf);

  const notes = midi.tracks
    .filter((track) => track.channel !== PERCUSSION_CHANNEL)
    .flatMap((track) => track.notes);
  notes.sort((a, b) => a.ticks - b.ticks || a.midi - b.midi);

  return {
    events: groupIntoEvents(notes, chordWindowMs),
    ppq: midi.header.ppq,
    durationSec: midi.duration,
    trackCount: midi.tracks.length,
  };
}

/**
 * @param {{ ticks:number, time:number, midi:number }[]} notes  triées par ticks puis midi
 * @param {number} chordWindowMs
 * @returns {RefEvent[]}
 */
function groupIntoEvents(notes, chordWindowMs) {
  const windowSec = chordWindowMs / 1000;
  const events = [];
  let group = null;

  for (const note of notes) {
    if (group && note.time - group.time <= windowSec) {
      group.pitchSet.add(note.midi);
    } else {
      if (group) events.push(toRefEvent(group, events.length));
      group = { ticks: note.ticks, time: note.time, pitchSet: new Set([note.midi]) };
    }
  }
  if (group) events.push(toRefEvent(group, events.length));

  return events;
}

function toRefEvent(group, index) {
  return {
    index,
    ticks: group.ticks,
    time: group.time,
    pitches: [...group.pitchSet].sort((a, b) => a - b),
  };
}
