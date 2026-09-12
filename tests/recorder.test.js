import { describe, it, expect } from 'vitest';
import { Recorder } from '../src/core/recorder.js';

/** Horloge factice pilotable par le test : `clock.t = ms` puis `now()` la lit. */
function makeClock(startAt = 0) {
  const clock = { t: startAt };
  return { clock, now: () => clock.t };
}

describe('Recorder', () => {
  it('idle au départ, ne capture rien avant start()', () => {
    const { now } = makeClock();
    const recorder = new Recorder({ now });
    expect(recorder.state).toBe('idle');
    recorder.noteOn(60, 100);
    recorder.noteOff(60);
    expect(recorder.toMidi().tracks[0].notes).toHaveLength(0);
  });

  it('capture une note simple avec le bon temps et la bonne durée', () => {
    const { clock, now } = makeClock();
    const recorder = new Recorder({ now });
    recorder.start();
    clock.t = 0;
    recorder.noteOn(60, 100);
    clock.t = 500;
    recorder.noteOff(60);

    const notes = recorder.toMidi().tracks[0].notes;
    expect(notes).toHaveLength(1);
    expect(notes[0].midi).toBe(60);
    expect(notes[0].time).toBeCloseTo(0);
    expect(notes[0].duration).toBeCloseTo(0.5);
    expect(notes[0].velocity).toBeCloseTo(100 / 127);
  });

  it('exclut le temps de pause du minutage (pas de "trou" dans le fichier)', () => {
    const { clock, now } = makeClock();
    const recorder = new Recorder({ now });

    recorder.start(); // t=0
    recorder.noteOn(60, 100);
    clock.t = 500;
    recorder.noteOff(60); // note 1: [0, 0.5]

    clock.t = 600;
    recorder.noteOn(64, 90); // ouverte à 0.6s de morceau
    clock.t = 800;
    recorder.pause(); // 0.8s de morceau écoulées, pause démarre
    expect(recorder.state).toBe('paused');

    clock.t = 2800; // 2s de pause réelle, qui ne doivent pas compter
    recorder.noteOff(64); // relâchée pendant la pause -> doit quand même se clore correctement

    recorder.resume();
    expect(recorder.state).toBe('recording');
    recorder.noteOn(67, 80); // ouverte à 0.8s de morceau (juste après la pause)
    clock.t = 3100; // 300ms de jeu supplémentaires
    recorder.stop(); // ferme la note encore tenue

    expect(recorder.state).toBe('stopped');
    const notes = recorder.toMidi().tracks[0].notes;
    expect(notes).toHaveLength(3);

    expect(notes[0]).toMatchObject({ midi: 60 });
    expect(notes[0].time).toBeCloseTo(0);
    expect(notes[0].duration).toBeCloseTo(0.5);

    expect(notes[1]).toMatchObject({ midi: 64 });
    expect(notes[1].time).toBeCloseTo(0.6);
    expect(notes[1].duration).toBeCloseTo(0.2); // tenue 0.6 -> 0.8, la pause de 2s n'y est pas

    expect(notes[2]).toMatchObject({ midi: 67 });
    expect(notes[2].time).toBeCloseTo(0.8);
    expect(notes[2].duration).toBeCloseTo(0.3); // fermée par stop(), pas perdue
  });

  it('ignore un noteOff sans noteOn correspondant', () => {
    const { now } = makeClock();
    const recorder = new Recorder({ now });
    recorder.start();
    recorder.noteOff(72); // jamais ouverte
    recorder.stop();
    expect(recorder.toMidi().tracks[0].notes).toHaveLength(0);
  });

  it('gère les accords (notes qui se chevauchent)', () => {
    const { clock, now } = makeClock();
    const recorder = new Recorder({ now });
    recorder.start();
    recorder.noteOn(60, 100);
    recorder.noteOn(64, 100);
    recorder.noteOn(67, 100);
    clock.t = 1000;
    recorder.noteOff(64);
    clock.t = 1200;
    recorder.noteOff(60);
    recorder.noteOff(67);

    const notes = recorder.toMidi().tracks[0].notes;
    expect(notes.map((n) => n.midi).sort()).toEqual([60, 64, 67]);
    expect(notes.find((n) => n.midi === 64).duration).toBeCloseTo(1.0);
    expect(notes.find((n) => n.midi === 60).duration).toBeCloseTo(1.2);
  });

  it('produit un fichier .mid exportable (toArray non vide)', () => {
    const { clock, now } = makeClock();
    const recorder = new Recorder({ now });
    recorder.start();
    recorder.noteOn(60, 100);
    clock.t = 400;
    recorder.stop();

    const bytes = recorder.toMidi().toArray();
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('pause()/resume() ne font rien hors de leur état attendu', () => {
    const { now } = makeClock();
    const recorder = new Recorder({ now });
    recorder.pause(); // idle -> no-op
    expect(recorder.state).toBe('idle');
    recorder.resume(); // idle -> no-op
    expect(recorder.state).toBe('idle');

    recorder.start();
    recorder.resume(); // recording -> no-op (pas en pause)
    expect(recorder.state).toBe('recording');
  });

  it('repartir avec start() réinitialise une capture précédente', () => {
    const { clock, now } = makeClock();
    const recorder = new Recorder({ now });
    recorder.start();
    recorder.noteOn(60, 100);
    clock.t = 200;
    recorder.stop();
    expect(recorder.toMidi().tracks[0].notes).toHaveLength(1);

    clock.t = 1000;
    recorder.start();
    expect(recorder.toMidi().tracks[0].notes).toHaveLength(0);
  });
});
