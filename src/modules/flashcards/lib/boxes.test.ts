import { describe, expect, it } from 'vitest';
import { BOX_INTERVALS, MASTERED_INTERVAL, applyReview, boxDistribution, dueCards } from './boxes';
import { BOX_COUNT } from './types';
import type { Card } from './types';

/**
 * Le moteur est le cœur du module (docs/etude-flashcards.md §5) : ce fichier
 * couvre chaque cas listé dans l'étude avant qu'aucun écran n'y touche.
 */

let n = 0;

function card(patch: Partial<Card> = {}): Card {
  n += 1;
  return {
    id: `c${n}`,
    deckId: 'd1',
    front: 'Recto',
    back: 'Verso',
    box: 1,
    dueDay: '2026-08-30',
    createdAt: '2026-08-30T08:00:00.000Z',
    ...patch,
  };
}

describe('applyReview — réponse fausse', () => {
  it('retombe en boîte 1, quelle que soit la boîte de départ', () => {
    for (let box = 1; box <= BOX_COUNT; box++) {
      const result = applyReview({ box, dueDay: '2026-08-30' }, false, '2026-08-30');
      expect(result.box, `boîte de départ ${box}`).toBe(1);
    }
  });

  it("l'échéance repart sur l'intervalle de la boîte 1", () => {
    const result = applyReview({ box: 4, dueDay: '2026-08-30' }, false, '2026-08-30');
    expect(result.dueDay).toBe('2026-08-31'); // +1 jour
  });
});

describe('applyReview — réponse juste, boîtes 1 à 4', () => {
  it('monte d’une boîte à chaque fois', () => {
    let box = 1;
    for (let i = 0; i < BOX_COUNT - 1; i++) {
      const result = applyReview({ box, dueDay: '2026-08-30' }, true, '2026-08-30');
      expect(result.box).toBe(box + 1);
      box = result.box;
    }
    expect(box).toBe(BOX_COUNT);
  });

  it('l’échéance suit BOX_INTERVALS de la boîte atteinte', () => {
    const result = applyReview({ box: 1, dueDay: '2026-08-30' }, true, '2026-08-30');
    expect(result.dueDay).toBe('2026-09-01'); // boîte 2 : +2 jours
  });

  it('boîte 4 → boîte 5, +16 jours', () => {
    const result = applyReview({ box: 4, dueDay: '2026-08-30' }, true, '2026-08-30');
    expect(result.box).toBe(5);
    expect(result.dueDay).toBe('2026-09-15'); // +16 jours
  });
});

describe('applyReview — réponse juste, déjà en boîte 5', () => {
  it('reste en boîte 5, pas de boîte 6', () => {
    const result = applyReview({ box: BOX_COUNT, dueDay: '2026-08-30' }, true, '2026-08-30');
    expect(result.box).toBe(BOX_COUNT);
  });

  it('bascule sur MASTERED_INTERVAL plutôt que de reprendre BOX_INTERVALS[4]', () => {
    const result = applyReview({ box: BOX_COUNT, dueDay: '2026-08-30' }, true, '2026-08-30');
    expect(result.dueDay).toBe('2026-10-01'); // +32 jours
    expect(MASTERED_INTERVAL).not.toBe(BOX_INTERVALS[BOX_COUNT - 1]);
  });
});

describe('dueCards', () => {
  it('une carte due aujourd’hui ou en retard est due', () => {
    const aujourdhui = card({ dueDay: '2026-08-30' });
    const enRetard = card({ dueDay: '2026-08-20' });
    expect(dueCards([aujourdhui, enRetard], '2026-08-30')).toHaveLength(2);
  });

  it('une carte due demain ne l’est pas encore', () => {
    const demain = card({ dueDay: '2026-08-31' });
    expect(dueCards([demain], '2026-08-30')).toHaveLength(0);
  });

  it('les plus en retard passent en premier', () => {
    const recente = card({ id: 'récente', dueDay: '2026-08-29' });
    const ancienne = card({ id: 'ancienne', dueDay: '2026-08-10' });
    const ordre = dueCards([recente, ancienne], '2026-08-30').map((c) => c.id);
    expect(ordre).toEqual(['ancienne', 'récente']);
  });

  it('à échéance égale, la boîte la plus basse passe en premier', () => {
    const fragile = card({ id: 'fragile', box: 1, dueDay: '2026-08-30' });
    const solide = card({ id: 'solide', box: 4, dueDay: '2026-08-30' });
    const ordre = dueCards([solide, fragile], '2026-08-30').map((c) => c.id);
    expect(ordre).toEqual(['fragile', 'solide']);
  });
});

describe('boxDistribution', () => {
  it('compte les cartes de chaque boîte, y compris les boîtes vides', () => {
    const cards = [card({ box: 1 }), card({ box: 1 }), card({ box: 3 })];
    expect(boxDistribution(cards)).toEqual({ 1: 2, 2: 0, 3: 1, 4: 0, 5: 0 });
  });

  it('un paquet vide donne des boîtes toutes à zéro', () => {
    expect(boxDistribution([])).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  });
});
