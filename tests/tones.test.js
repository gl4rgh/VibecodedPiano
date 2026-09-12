import { describe, it, expect } from 'vitest';
import { TONES, TONE_CATEGORIES } from '../src/data/tones.js';

describe('TONES', () => {
  it('contient les 700 sons du CDP-S360', () => {
    expect(TONES).toHaveLength(700);
  });

  it('numéros de 1 à 700 sans doublon', () => {
    const numbers = TONES.map((t) => t.number);
    expect(new Set(numbers).size).toBe(700);
    expect(Math.min(...numbers)).toBe(1);
    expect(Math.max(...numbers)).toBe(700);
  });

  it('recoupe des exemples connus du manuel utilisateur', () => {
    const byNumber = (n) => TONES.find((t) => t.number === n);
    expect(byNumber(32)).toMatchObject({ name: 'ELEC.PIANO 1', programChange: 4, bankSelectMSB: 1 });
    expect(byNumber(226)).toMatchObject({ name: 'STRINGS', programChange: 48, bankSelectMSB: 3 });
    expect(byNumber(312)).toMatchObject({ name: 'FLUTE 1', programChange: 73, bankSelectMSB: 1 });
    expect(byNumber(60)).toMatchObject({ name: 'VIBRAPHONE 1', programChange: 11, bankSelectMSB: 1 });
  });

  it('la catégorie GM TONES suit l\'ordre General MIDI standard (Program Change 0-127)', () => {
    const gm = TONES.filter((t) => t.category === 'GM TONES');
    expect(gm).toHaveLength(128);
    expect(gm.map((t) => t.programChange)).toEqual(Array.from({ length: 128 }, (_, i) => i));
    expect(gm.every((t) => t.bankSelectMSB === 0)).toBe(true);
  });
});

describe('TONE_CATEGORIES', () => {
  it('couvre les 18 catégories sans perdre de son', () => {
    expect(TONE_CATEGORIES).toHaveLength(18);
    const total = TONE_CATEGORIES.reduce((sum, c) => sum + c.tones.length, 0);
    expect(total).toBe(700);
  });

  it('respecte l\'ordre d\'affichage du piano (Piano en premier, Drum Set en dernier)', () => {
    expect(TONE_CATEGORIES[0].name).toBe('PIANO');
    expect(TONE_CATEGORIES.at(-1).name).toBe('DRUM SET');
  });
});
