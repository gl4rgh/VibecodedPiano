import { describe, it, expect } from 'vitest';
import { ARPEGGIATOR_TYPES } from '../src/data/arpeggiator-types.js';
import { AUTO_HARMONIZE_TYPES } from '../src/data/auto-harmonize-types.js';
import { REVERB_TYPES, CHORUS_TYPES } from '../src/data/effects.js';

describe('ARPEGGIATOR_TYPES', () => {
  it('contient les 100 types, numérotés 1 à 100 sans doublon', () => {
    expect(ARPEGGIATOR_TYPES).toHaveLength(100);
    const numbers = ARPEGGIATOR_TYPES.map((a) => a.number);
    expect(new Set(numbers).size).toBe(100);
    expect(Math.min(...numbers)).toBe(1);
    expect(Math.max(...numbers)).toBe(100);
  });

  it('recoupe un exemple connu du manuel', () => {
    expect(ARPEGGIATOR_TYPES.find((a) => a.number === 1)).toMatchObject({ name: 'Screw Up' });
    expect(ARPEGGIATOR_TYPES.find((a) => a.number === 61)).toMatchObject({ name: 'Up' });
  });
});

describe('AUTO_HARMONIZE_TYPES', () => {
  it('contient les 12 types avec une description', () => {
    expect(AUTO_HARMONIZE_TYPES).toHaveLength(12);
    expect(AUTO_HARMONIZE_TYPES.every((t) => t.description.length > 0)).toBe(true);
  });
});

describe('REVERB_TYPES / CHORUS_TYPES', () => {
  it('correspondent aux tables 13.6/13.7 du MIDI Implementation (6 valeurs chacune)', () => {
    expect(REVERB_TYPES).toHaveLength(6);
    expect(CHORUS_TYPES).toHaveLength(6);
    expect(REVERB_TYPES.map((r) => r.value)).toEqual([0, 1, 2, 3, 4, 8]);
    expect(CHORUS_TYPES.map((c) => c.value)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
