import { describe, it, expect } from 'vitest';
import { Matcher } from '../src/core/matcher.js';

/** Construit une séquence de RefEvent à partir d'une liste de pitches ou d'accords (number[]). */
function events(...pitchesList) {
  return pitchesList.map((pitches, index) => ({
    index,
    ticks: index * 480,
    time: index * 0.5,
    pitches: Array.isArray(pitches) ? [...pitches].sort((a, b) => a - b) : [pitches],
  }));
}

function playAll(matcher, pitches) {
  return pitches.map((p) => matcher.onNoteOn(p));
}

describe('Matcher — exécution parfaite', () => {
  it('avance pas à pas sur une mélodie monophonique jouée exactement', () => {
    const seq = events(60, 62, 64, 65, 67); // C D E F G
    const matcher = new Matcher(seq);

    const results = playAll(matcher, [60, 62, 64, 65, 67]);

    expect(results.map((r) => r.kind)).toEqual(['match', 'match', 'match', 'match', 'match']);
    expect(results.every((r) => r.advanced)).toBe(true);
    expect(matcher.cursor).toBe(5); // fini : cursor === events.length
    expect(matcher.progress).toBe(1);
    expect(matcher.stats).toEqual({ matched: 5, skipped: 0, rejected: 0, rewinds: 0 });
  });
});

describe('Matcher — note omise', () => {
  it('rattrape en sautant la note manquante sans se bloquer', () => {
    const seq = events(60, 62, 64, 65); // C D E F
    const matcher = new Matcher(seq);

    const r0 = matcher.onNoteOn(60); // match
    const r1 = matcher.onNoteOn(64); // D omis -> skip jusqu'à E
    const r2 = matcher.onNoteOn(65); // match

    expect(r0.kind).toBe('match');
    expect(r1.kind).toBe('skip');
    expect(r1.cursor).toBe(3); // a dépassé l'événement D (index 1) pour se retrouver après E (index 2)
    expect(r2.kind).toBe('match');
    expect(matcher.cursor).toBe(4);
    expect(matcher.stats).toEqual({ matched: 2, skipped: 1, rejected: 0, rewinds: 0 });
  });
});

describe('Matcher — fausse note insérée', () => {
  it('ignore une fausse note entre deux bonnes, sans faire dériver le curseur', () => {
    const seq = events(60, 62, 64);
    const matcher = new Matcher(seq);

    const r0 = matcher.onNoteOn(60); // match
    const r1 = matcher.onNoteOn(90); // fausse note, hors de toute fenêtre -> reject
    const r2 = matcher.onNoteOn(62); // match, reprend normalement

    expect(r0.kind).toBe('match');
    expect(r1.kind).toBe('reject');
    expect(r1.advanced).toBe(false);
    expect(r1.cursor).toBe(1); // inchangé
    expect(r2.kind).toBe('match');
    expect(matcher.cursor).toBe(2);
    expect(matcher.stats.rejected).toBe(1);
  });
});

describe('Matcher — accord joué en arpège', () => {
  it("un accord joué note par note (ordre quelconque, timing ignoré) n'entraîne aucune dérive", () => {
    const seq = events(60, [60, 64, 67], 65); // note, accord, note
    const matcher = new Matcher(seq);

    matcher.onNoteOn(60); // franchit le premier événement -> cursor=1, pending={60,64,67}
    expect(matcher.cursor).toBe(1);

    const r1 = matcher.onNoteOn(60); // 1re note de l'accord -> avance immédiatement (strictChords=false)
    expect(r1.kind).toBe('match');
    expect(matcher.cursor).toBe(2);

    const r2 = matcher.onNoteOn(64); // 2e note de l'accord, jouée après l'avance -> aucune dérive nette
    const r3 = matcher.onNoteOn(67); // 3e note de l'accord
    expect(r2.advanced).toBe(false);
    expect(r3.advanced).toBe(false);
    expect(matcher.cursor).toBe(2); // toujours sur l'événement suivant, pas de dérive

    const r4 = matcher.onNoteOn(65); // dernière note, normale
    expect(r4.kind).toBe('match');
    expect(matcher.cursor).toBe(3);
  });

  it('une main légèrement en retard ne fait pas sauter le curseur à une occurrence lointaine de la même hauteur', () => {
    // Reproduit un cas réel (gamme mains ensemble) : chaque accord associe une hauteur qui
    // réapparaît nettement plus loin dans le morceau (ici 60, présent au 1er ET au dernier
    // accord). Si la main en retard est recherchée « en avant » avant « en arrière », elle
    // matche par erreur l'occurrence lointaine au lieu de se corriger juste derrière.
    const seq = events(
      [48, 60],
      [50, 62],
      [52, 64],
      [53, 65],
      [55, 67],
      [57, 69],
      [59, 71],
      [60, 72],
    );
    const matcher = new Matcher(seq);

    matcher.onNoteOn(48); // main gauche du 1er accord -> avance immédiatement, cursor=1
    const late = matcher.onNoteOn(60); // main droite du 1er accord, jouée en retard

    expect(late.kind).toBe('rewind'); // corrigée juste derrière, pas un saut au dernier accord
    expect(late.advanced).toBe(false);
    expect(matcher.cursor).toBe(1);

    // Le morceau continue normalement depuis cette position, sans dérive accumulée.
    const next = matcher.onNoteOn(50);
    expect(next.kind).toBe('match');
    expect(matcher.cursor).toBe(2);
  });
});

describe('Matcher — accord incomplet', () => {
  it("une seule note jouée d'un accord suffit à avancer (strictChords=false par défaut)", () => {
    const seq = events([60, 64, 67], 65);
    const matcher = new Matcher(seq);

    const r0 = matcher.onNoteOn(60); // une seule note de l'accord
    expect(r0.kind).toBe('match');
    expect(r0.advanced).toBe(true);
    expect(matcher.cursor).toBe(1);

    const r1 = matcher.onNoteOn(65);
    expect(r1.kind).toBe('match');
    expect(matcher.cursor).toBe(2);
  });

  it('avec strictChords=true, il faut jouer toutes les notes avant d\'avancer', () => {
    const seq = events([60, 64, 67], 65);
    const matcher = new Matcher(seq, { strictChords: true });

    const r0 = matcher.onNoteOn(60);
    expect(r0.kind).toBe('match');
    expect(r0.advanced).toBe(false);
    expect(matcher.cursor).toBe(0); // toujours sur l'accord, notes manquantes

    matcher.onNoteOn(64);
    const r2 = matcher.onNoteOn(67); // dernière note -> l'accord est complet
    expect(r2.advanced).toBe(true);
    expect(matcher.cursor).toBe(1);
  });
});

describe('Matcher — saut de plusieurs mesures', () => {
  it('retrouve le curseur après un saut en avant, dans la fenêtre lookahead', () => {
    const seq = events(60, 61, 62, 63, 64, 65, 67); // 7 événements, saut vers le dernier (index 6)
    const matcher = new Matcher(seq); // lookahead par défaut = 8, largement suffisant ici

    const r0 = matcher.onNoteOn(60); // match, cursor=1
    const r1 = matcher.onNoteOn(67); // saute directement à l'avant-dernier événement (index 6)

    expect(r0.kind).toBe('match');
    expect(r1.kind).toBe('skip');
    expect(matcher.cursor).toBe(7); // dépassé le dernier événement -> morceau fini
    expect(matcher.stats.skipped).toBe(1);
  });

  it('un saut hors de la fenêtre lookahead par défaut est rejeté (pas de correspondance trouvée)', () => {
    const pitches = Array.from({ length: 12 }, (_, i) => 60 + i);
    const seq = events(...pitches);
    const matcher = new Matcher(seq); // lookahead=8

    matcher.onNoteOn(60); // cursor=1
    const farJump = matcher.onNoteOn(pitches[11]); // à 10 événements de distance, hors fenêtre
    expect(farJump.kind).toBe('reject');
    expect(matcher.cursor).toBe(1); // inchangé

    // Avec un lookahead plus large, le même saut est retrouvé.
    const matcherWide = new Matcher(seq, { lookahead: 16 });
    matcherWide.onNoteOn(60);
    const farJumpWide = matcherWide.onNoteOn(pitches[11]);
    expect(farJumpWide.kind).toBe('skip');
  });
});

describe('Matcher — reprise en arrière', () => {
  it('retrouve le curseur en arrière dans la fenêtre lookbehind (reprise d\'un passage)', () => {
    const seq = events(60, 62, 64, 65, 67);
    const matcher = new Matcher(seq);

    matcher.onNoteOn(60); // cursor=1
    matcher.onNoteOn(62); // cursor=2
    matcher.onNoteOn(64); // cursor=3

    const rewind = matcher.onNoteOn(62); // rejoue une note d'un événement déjà passé
    expect(rewind.kind).toBe('rewind');
    expect(matcher.cursor).toBe(2); // revenu juste après l'événement rejoué (index 1)
    expect(matcher.stats.rewinds).toBe(1);

    // Et le suivi reprend normalement depuis la position reculée.
    const resume = matcher.onNoteOn(64);
    expect(resume.kind).toBe('match');
    expect(matcher.cursor).toBe(3);
  });
});

describe('Matcher — motif répété', () => {
  it('un motif répété (C D C D C D) ne fait pas dérailler le curseur', () => {
    const seq = events(60, 62, 60, 62, 60, 62); // C D C D C D
    const matcher = new Matcher(seq);

    // Exécution parfaite du motif répété : uniquement des correspondances directes (cas 1),
    // jamais de recherche avant/arrière, donc aucune confusion possible entre occurrences.
    const results = playAll(matcher, [60, 62, 60, 62, 60, 62]);
    expect(results.every((r) => r.kind === 'match')).toBe(true);
    expect(matcher.cursor).toBe(6);

    // Une erreur au milieu (rejoue C au lieu de D) doit sauter à la PROCHAINE occurrence de C,
    // pas dérailler vers une occurrence lointaine ou se bloquer.
    const matcher2 = new Matcher(seq);
    matcher2.onNoteOn(60); // cursor=1, pending=D (index1)
    const wrong = matcher2.onNoteOn(60); // au lieu de D, rejoue C -> trouvé au prochain C (index2)
    expect(wrong.kind).toBe('skip');
    expect(matcher2.cursor).toBe(3); // juste après le C retrouvé (index 2)

    // La suite continue de façon cohérente depuis cette position.
    const after = matcher2.onNoteOn(62);
    expect(after.kind).toBe('match');
    expect(matcher2.cursor).toBe(4);
  });
});

describe('Matcher — note tenue rejouée', () => {
  it('un retrigger MIDI de la note déjà passée ne fait pas dériver la position', () => {
    const seq = events(60, 64, 67); // C E G
    const matcher = new Matcher(seq);

    matcher.onNoteOn(60); // cursor=1, pending=E
    const retrigger = matcher.onNoteOn(60); // C rejouée (pédale/retrigger) alors qu'on attend E

    // Retrouvée en arrière (index 0), puis la règle de complétion immédiate (strictChords=false)
    // renvoie aussitôt le curseur à sa position : aucune dérive nette.
    expect(retrigger.kind).toBe('rewind');
    expect(retrigger.advanced).toBe(false);
    expect(matcher.cursor).toBe(1);

    const resume = matcher.onNoteOn(64);
    expect(resume.kind).toBe('match');
    expect(matcher.cursor).toBe(2);
  });
});

describe('Matcher — reset / seekToEvent', () => {
  it('reset remet le curseur et les stats à zéro', () => {
    const seq = events(60, 62, 64);
    const matcher = new Matcher(seq);
    matcher.onNoteOn(60);
    matcher.onNoteOn(90); // reject

    matcher.reset();
    expect(matcher.cursor).toBe(0);
    expect(matcher.stats).toEqual({ matched: 0, skipped: 0, rejected: 0, rewinds: 0 });
  });

  it('seekToEvent déplace le curseur sans toucher aux stats', () => {
    const seq = events(60, 62, 64, 65);
    const matcher = new Matcher(seq);
    matcher.onNoteOn(60);

    matcher.seekToEvent(3);
    expect(matcher.cursor).toBe(3);
    expect(matcher.stats.matched).toBe(1); // stats conservées

    const r = matcher.onNoteOn(65);
    expect(r.kind).toBe('match');
    expect(matcher.cursor).toBe(4);
  });

  it('seekToEvent est borné à [0, events.length]', () => {
    const seq = events(60, 62);
    const matcher = new Matcher(seq);
    matcher.seekToEvent(-5);
    expect(matcher.cursor).toBe(0);
    matcher.seekToEvent(999);
    expect(matcher.cursor).toBe(2);
  });
});

describe('Matcher — octaveAgnostic', () => {
  it('ignore par défaut : une note à la mauvaise octave ne correspond pas', () => {
    const seq = events(60); // C4
    const matcher = new Matcher(seq);
    const r = matcher.onNoteOn(72); // C5 : même classe de note, octave différente
    expect(r.kind).toBe('reject');
  });

  it('avec octaveAgnostic=true, la classe de note suffit', () => {
    const seq = events(60, 62);
    const matcher = new Matcher(seq, { octaveAgnostic: true });
    const r = matcher.onNoteOn(72); // C5, reconnu comme équivalent à C4
    expect(r.kind).toBe('match');
    expect(matcher.cursor).toBe(1);
  });
});

describe('Matcher — morceau vide', () => {
  it("rejette systématiquement, sans jamais planter, sur une séquence vide", () => {
    const matcher = new Matcher([]);
    const r = matcher.onNoteOn(60);
    expect(r.kind).toBe('reject');
    expect(matcher.progress).toBe(0);
  });
});
