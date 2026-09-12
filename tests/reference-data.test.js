import { describe, it, expect } from 'vitest';
import { ARPEGGIATOR_TYPES } from '../src/data/arpeggiator-types.js';
import { AUTO_HARMONIZE_TYPES } from '../src/data/auto-harmonize-types.js';

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
