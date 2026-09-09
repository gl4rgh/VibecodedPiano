import { describe, it, expect } from 'vitest';
import { noteName } from '../src/util/note-names.js';

describe('noteName', () => {
  it('nomme en anglais par défaut', () => {
    expect(noteName(60)).toBe('C4');
    expect(noteName(61)).toBe('C#4');
    expect(noteName(69)).toBe('A4');
  });

  it('nomme en solfège quand demandé', () => {
    expect(noteName(60, 'solfege')).toBe('Do4');
    expect(noteName(61, 'solfege')).toBe('Do#4');
    expect(noteName(62, 'solfege')).toBe('Ré4');
    expect(noteName(71, 'solfege')).toBe('Si4');
  });

  it("change d'octave à C/Do, pas à A/La", () => {
    expect(noteName(59, 'en')).toBe('B3');
    expect(noteName(60, 'en')).toBe('C4');
    expect(noteName(59, 'solfege')).toBe('Si3');
    expect(noteName(60, 'solfege')).toBe('Do4');
  });
});
