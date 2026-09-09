import { describe, it, expect } from 'vitest';
import {
  sortAnchors,
  resolveActiveAnchor,
  upsertAnchor,
  removeAnchor,
  exportJson,
  importJson,
  sha256Hex,
} from '../src/core/anchors.js';

function anchor(id, eventIndex, extra = {}) {
  return { id, eventIndex, page: 1, yRatio: 0, label: id, ...extra };
}

describe('sortAnchors', () => {
  it('trie par eventIndex croissant sans muter le tableau original', () => {
    const anchors = [anchor('c', 200), anchor('a', 0), anchor('b', 96)];
    const sorted = sortAnchors(anchors);

    expect(sorted.map((a) => a.id)).toEqual(['a', 'b', 'c']);
    expect(anchors.map((a) => a.id)).toEqual(['c', 'a', 'b']); // inchangé
  });
});

describe('resolveActiveAnchor', () => {
  const anchors = [anchor('start', 0), anchor('mid', 96), anchor('end', 210)];

  it('retourne null si le curseur est avant la première ancre (lead compris)', () => {
    // "start" à eventIndex=0, lead=4 -> seuil -4 : franchi seulement à partir de cursor=-4
    expect(resolveActiveAnchor(anchors, -5, 4)).toBeNull();
    expect(resolveActiveAnchor(anchors, -4, 4)?.id).toBe('start');
  });

  it('retourne la dernière ancre franchie compte tenu du lead par défaut', () => {
    // "mid" à eventIndex=96, lead=4 -> seuil 92
    expect(resolveActiveAnchor(anchors, 91, 4)?.id).toBe('start');
    expect(resolveActiveAnchor(anchors, 92, 4)?.id).toBe('mid');
  });

  it('respecte un lead spécifique à une ancre, indépendamment du defaultLead', () => {
    const withOverride = [anchor('start', 0), anchor('mid', 96, { lead: 20 })];
    // seuil = 96 - 20 = 76, alors que le defaultLead (4) donnerait 92
    expect(resolveActiveAnchor(withOverride, 80, 4)?.id).toBe('mid');
    expect(resolveActiveAnchor(withOverride, 75, 4)?.id).toBe('start');
  });

  it('recule quand le curseur recule (idempotent, pas d\'état interne)', () => {
    expect(resolveActiveAnchor(anchors, 210, 4)?.id).toBe('end');
    expect(resolveActiveAnchor(anchors, 50, 4)?.id).toBe('start');
    // rejouer le même curseur donne toujours le même résultat
    expect(resolveActiveAnchor(anchors, 210, 4)?.id).toBe('end');
  });

  it('retourne null sur une liste vide', () => {
    expect(resolveActiveAnchor([], 1000, 4)).toBeNull();
  });
});

describe('upsertAnchor / removeAnchor', () => {
  it('ajoute une nouvelle ancre et garde le tri', () => {
    const anchors = [anchor('a', 0)];
    const result = upsertAnchor(anchors, anchor('b', 50));
    expect(result.map((a) => a.id)).toEqual(['a', 'b']);
  });

  it('remplace une ancre existante (même id)', () => {
    const anchors = [anchor('a', 0), anchor('b', 50)];
    const result = upsertAnchor(anchors, { ...anchor('b', 50), label: 'modifié' });
    expect(result).toHaveLength(2);
    expect(result.find((a) => a.id === 'b').label).toBe('modifié');
  });

  it('supprime une ancre par id', () => {
    const anchors = [anchor('a', 0), anchor('b', 50)];
    expect(removeAnchor(anchors, 'a').map((a) => a.id)).toEqual(['b']);
  });
});

describe('exportJson / importJson', () => {
  const piece = {
    title: 'Gymnopédie n°1',
    midiBlob: new Blob([new Uint8Array([1, 2, 3, 4])]),
    pageCount: 4,
    eventCount: 3,
    settings: { lead: 4 },
    anchors: [anchor('a2', 96, { label: 'Système 3' }), anchor('a1', 0, { label: 'Début' })],
  };

  it('exporte un JSON relisible avec anchors triées et un hash sha256 cohérent', async () => {
    const text = await exportJson(piece);
    const data = JSON.parse(text);

    expect(data.schemaVersion).toBe(1);
    expect(data.title).toBe('Gymnopédie n°1');
    expect(data.anchors.map((a) => a.id)).toEqual(['a1', 'a2']);
    expect(data.midiSha256).toBe(await sha256Hex(piece.midiBlob));
  });

  it('importe sans avertissement si le hash correspond', async () => {
    const text = await exportJson(piece);
    const expectedSha = await sha256Hex(piece.midiBlob);

    const { anchors, warnings } = importJson(text, expectedSha);
    expect(anchors.map((a) => a.id)).toEqual(['a1', 'a2']);
    expect(warnings).toEqual([]);
  });

  it('avertit si le midiSha256 diffère du morceau courant', async () => {
    const text = await exportJson(piece);
    const { warnings } = importJson(text, 'un-hash-different');
    expect(warnings).toHaveLength(1);
  });

  it('rejette un schemaVersion inconnu', () => {
    const bad = JSON.stringify({ schemaVersion: 99, anchors: [] });
    expect(() => importJson(bad)).toThrow();
  });

  it('rejette un JSON invalide', () => {
    expect(() => importJson('{ pas du json')).toThrow();
  });
});
