import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, resolveSettings } from '../src/core/settings.js';

describe('resolveSettings', () => {
  it('retourne les défauts quand rien n\'est fourni', () => {
    expect(resolveSettings(undefined, undefined)).toEqual(DEFAULT_SETTINGS);
    expect(resolveSettings({}, {})).toEqual(DEFAULT_SETTINGS);
  });

  it('les réglages globaux surchargent les défauts', () => {
    const result = resolveSettings({ lookahead: 12 }, {});
    expect(result.lookahead).toBe(12);
    expect(result.lookbehind).toBe(DEFAULT_SETTINGS.lookbehind);
  });

  it('la surcharge du morceau gagne sur les réglages globaux', () => {
    const result = resolveSettings({ lookahead: 12 }, { lookahead: 20 });
    expect(result.lookahead).toBe(20);
  });

  it('un champ vide/undefined/null dans une surcharge n\'écrase pas le niveau précédent', () => {
    const result = resolveSettings({ lookahead: 12 }, { lookahead: undefined, lead: null, chordWindowMs: '' });
    expect(result.lookahead).toBe(12);
    expect(result.lead).toBe(DEFAULT_SETTINGS.lead);
    expect(result.chordWindowMs).toBe(DEFAULT_SETTINGS.chordWindowMs);
  });

  it('conserve les valeurs falsy valides (0, false)', () => {
    const result = resolveSettings({ lead: 0 }, { octaveAgnostic: false, strictChords: true });
    expect(result.lead).toBe(0);
    expect(result.octaveAgnostic).toBe(false);
    expect(result.strictChords).toBe(true);
  });

  it('defaultZoom : null (auto) hérité, mais une valeur numérique surcharge', () => {
    expect(resolveSettings({}, {}).defaultZoom).toBeNull();
    expect(resolveSettings({ defaultZoom: 1.5 }, {}).defaultZoom).toBe(1.5);
    expect(resolveSettings({ defaultZoom: 1.5 }, { defaultZoom: 2 }).defaultZoom).toBe(2);
  });
});
