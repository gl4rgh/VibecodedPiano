import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseReference } from '../src/core/midi-reference.js';

const FIXTURES_DIR = fileURLToPath(new URL('./fixtures', import.meta.url));

async function loadFixture(name) {
  const buf = await readFile(`${FIXTURES_DIR}/${name}`);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

describe('parseReference', () => {
  it('parse une mélodie monophonique en une note par RefEvent', async () => {
    const buf = await loadFixture('mono.mid');
    const { events, trackCount } = parseReference(buf);

    expect(trackCount).toBe(1);
    expect(events).toHaveLength(5);
    expect(events.map((e) => e.pitches)).toEqual([[60], [62], [64], [65], [67]]);
    // index croissant et cohérent avec la position dans la séquence
    expect(events.map((e) => e.index)).toEqual([0, 1, 2, 3, 4]);
  });

  it('fusionne les pistes et regroupe en accords, en excluant le canal percussion', async () => {
    const buf = await loadFixture('chords.mid');
    const { events, trackCount } = parseReference(buf);

    expect(trackCount).toBe(3); // 2 pistes mélodiques + 1 piste percussion (exclue du parsing)
    // La basse (main gauche, +5ms) est fusionnée avec l'accord (main droite) dans le même
    // groupe : par défaut chordWindowMs=40ms. La note de percussion (canal 10) est absente.
    expect(events).toHaveLength(2);
    expect(events[0].pitches).toEqual([48, 60, 64, 67]);
    expect(events[1].pitches).toEqual([50, 62, 65, 69]);
  });

  it('dédoublonne un pitch joué à l\'unisson par deux pistes dans la même fenêtre', async () => {
    // Deux pistes jouent la même note (unisson) au même instant : ne doit apparaître qu'une
    // fois dans le RefEvent.
    const { Midi } = await import('@tonejs/midi');
    const midi = new Midi();
    const trackA = midi.addTrack();
    trackA.addNote({ midi: 60, time: 0, duration: 0.5, velocity: 0.8 });
    trackA.addNote({ midi: 64, time: 0, duration: 0.5, velocity: 0.8 });
    const trackB = midi.addTrack();
    trackB.addNote({ midi: 60, time: 0, duration: 0.5, velocity: 0.6 }); // doublon de trackA

    const { events } = parseReference(midi.toArray().buffer);

    expect(events).toHaveLength(1);
    expect(events[0].pitches).toEqual([60, 64]);
  });

  it('un chordWindowMs plus petit que le "roulé" sépare la basse en son propre événement', async () => {
    const buf = await loadFixture('chords.mid');
    // La basse est décalée de 5ms par rapport à l'accord de main droite : avec une fenêtre
    // de 2ms, elle ne doit plus fusionner avec l'accord.
    const { events } = parseReference(buf, { chordWindowMs: 2 });

    expect(events).toHaveLength(4);
    expect(events[0].pitches).toEqual([60, 64, 67]);
    expect(events[1].pitches).toEqual([48]);
    expect(events[2].pitches).toEqual([62, 65, 69]);
    expect(events[3].pitches).toEqual([50]);
  });

  it('retourne une séquence vide pour un MIDI sans note', async () => {
    // Fichier vide : header + une seule piste sans notes, encodé à la main pour ce test.
    const { Midi } = await import('@tonejs/midi');
    const midi = new Midi();
    midi.addTrack();
    const buf = midi.toArray().buffer;

    const { events } = parseReference(buf);
    expect(events).toEqual([]);
  });

  it('expose ppq et durationSec cohérents avec le fichier', async () => {
    const buf = await loadFixture('mono.mid');
    const { ppq, durationSec } = parseReference(buf);

    expect(ppq).toBeGreaterThan(0);
    // Dernière note à t=2.0s, durée 0.4s -> fin de piste >= 2.4s
    expect(durationSec).toBeGreaterThanOrEqual(2.4);
  });
});
