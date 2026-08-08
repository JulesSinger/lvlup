import { describe, expect, it } from 'vitest';
import {
  MEASURE_PP,
  actionNature,
  kindFields,
  measureSeries,
  measureTarget,
  natureFields,
  needsInput,
  parseAmount,
  tapValue,
  targetForInput,
  targetForStore,
} from './quantities';
import type { Action, Checkin, Tier, TierKind } from './types';

/**
 * Ce fichier garde la promesse du lot : **un appui reste un appui**. Chaque
 * fois qu'on ouvrira un clavier là où une pastille suffisait, un de ces tests
 * doit tomber.
 */

let n = 0;

function tier(patch: Partial<Tier> & { kind: TierKind }): Tier {
  n += 1;
  return {
    id: `t${n}`,
    goalId: 'g1',
    title: 'Palier',
    rank: 'bronze',
    position: 0,
    completedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    target: null,
    unit: '',
    direction: 'hausse',
    mode: 'absolu',
    sources: [],
    ...patch,
  };
}

function action(patch: Partial<Action> = {}): Action {
  n += 1;
  return {
    id: patch.id ?? `a${n}`,
    goalId: 'g1',
    title: 'Action',
    pp: 15,
    position: 0,
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    unit: '',
    defaultValue: null,
    isMeasure: false,
    ...patch,
  };
}

function checkin(day: string, patch: Partial<Checkin> = {}): Checkin {
  n += 1;
  return {
    id: `c${n}`,
    goalId: 'g1',
    actionId: 'a1',
    pp: 15,
    day,
    note: '',
    createdAt: `${day}T08:00:00.000Z`,
    value: null,
    ...patch,
  };
}

describe('nature d’une action', () => {
  it('sans unité, une action est simple', () => {
    expect(actionNature(action())).toBe('simple');
    expect(actionNature(action({ unit: '   ' }))).toBe('simple');
  });

  it('une unité suffit à la rendre quantifiée', () => {
    expect(actionNature(action({ unit: 'km', defaultValue: 8 }))).toBe('quantifiee');
  });

  it('un relevé reste un relevé même avec une unité', () => {
    expect(actionNature(action({ unit: 'kg', isMeasure: true }))).toBe('releve');
  });
});

describe('changement de nature', () => {
  it('revenir à simple efface unité et valeur habituelle', () => {
    expect(natureFields('simple', action({ unit: 'km', defaultValue: 8, pp: 15 }))).toEqual({
      unit: '',
      defaultValue: null,
      isMeasure: false,
    });
  });

  it('quantifier propose une unité et une valeur plutôt qu’un champ vide', () => {
    const fields = natureFields('quantifiee', action());
    expect(fields.unit).toBeTruthy();
    expect(fields.defaultValue).toBeGreaterThan(0);
  });

  it('passer en relevé garde l’unité déjà saisie', () => {
    expect(natureFields('releve', action({ unit: 'cm', pp: 5 })).unit).toBe('cm');
  });

  it('un relevé ne peut pas devenir une machine à points', () => {
    // Décision 4 : se peser entretient le streak, mais ne rapporte presque rien.
    expect(natureFields('releve', action({ pp: 30 })).pp).toBe(MEASURE_PP);
    expect(natureFields('releve', action({ pp: 5 })).pp).toBe(5);
  });

  it('un relevé n’a pas de valeur habituelle', () => {
    expect(natureFields('releve', action({ defaultValue: 8 })).defaultValue).toBeNull();
  });
});

describe('lecture d’un nombre tapé', () => {
  it('accepte la virgule française', () => {
    expect(parseAmount('78,4')).toBe(78.4);
  });

  it('accepte le point et les espaces, y compris insécables', () => {
    expect(parseAmount(' 8.5 ')).toBe(8.5);
    expect(parseAmount('1 000')).toBe(1000);
  });

  it('refuse plutôt que d’enregistrer un NaN', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('huit')).toBeNull();
    expect(parseAmount('-')).toBeNull();
    expect(parseAmount(',')).toBeNull();
  });

  it('accepte zéro — « 0 cigarette » est une valeur', () => {
    expect(parseAmount('0')).toBe(0);
  });
});

describe('ce qu’un appui enregistre', () => {
  it('une action simple n’enregistre aucune quantité', () => {
    expect(tapValue(action())).toBeNull();
    expect(needsInput(action())).toBe(false);
  });

  it('une action quantifiée enregistre sa valeur habituelle, sans clavier', () => {
    expect(tapValue(action({ unit: 'km', defaultValue: 8 }))).toBe(8);
    expect(needsInput(action({ unit: 'km', defaultValue: 8 }))).toBe(false);
  });

  it('un relevé demande la saisie : la valeur du jour est le geste', () => {
    const balance = action({ unit: 'kg', isMeasure: true });
    expect(needsInput(balance)).toBe(true);
    expect(tapValue(balance)).toBeNull();
  });
});

describe('cible d’un palier', () => {
  it('« perdre 5 kg » se tape 5 et se stocke -5', () => {
    const t = tier({ kind: 'mesure', mode: 'delta', direction: 'baisse', target: -5, unit: 'kg' });
    expect(targetForInput(t)).toBe(5);
    expect(targetForStore(5, t)).toBe(-5);
  });

  it('une mesure en hausse reste positive', () => {
    const t = tier({ kind: 'mesure', mode: 'delta', direction: 'hausse', target: 3, unit: 'kg' });
    expect(targetForStore(3, t)).toBe(3);
  });

  it('une cible absolue n’est jamais négative, même en baisse', () => {
    // « Descendre à 75 kg » : 75, pas -75.
    const t = tier({ kind: 'mesure', mode: 'absolu', direction: 'baisse', target: 75, unit: 'kg' });
    expect(targetForStore(75, t)).toBe(75);
  });

  it('les autres natures ignorent le signe', () => {
    expect(targetForStore(-30, tier({ kind: 'compte', target: 30 }))).toBe(30);
  });
});

describe('réglages par défaut d’une nature de palier', () => {
  it('un jalon n’a rien à compter', () => {
    expect(kindFields('jalon', tier({ kind: 'compte', target: 30, unit: 'jours' }))).toMatchObject({
      kind: 'jalon',
      target: null,
      unit: '',
    });
  });

  it('chaque nature comptable propose une cible et une unité crédibles', () => {
    for (const kind of ['compte', 'cumul', 'serie', 'performance', 'mesure'] as TierKind[]) {
      const fields = kindFields(kind, tier({ kind: 'jalon' }));
      expect(fields.unit, kind).toBeTruthy();
      expect(Math.abs(fields.target as number), kind).toBeGreaterThan(0);
    }
  });

  it('une mesure part en delta et en baisse — le cas de très loin le plus courant', () => {
    expect(kindFields('mesure', tier({ kind: 'jalon' }))).toMatchObject({
      mode: 'delta',
      direction: 'baisse',
    });
    expect(kindFields('mesure', tier({ kind: 'jalon' })).target).toBeLessThan(0);
  });

  it('la cible déjà saisie survit à un changement de nature', () => {
    expect(kindFields('cumul', tier({ kind: 'compte', target: 42, unit: 'km' }))).toMatchObject({
      target: 42,
      unit: 'km',
    });
  });
});

describe('série de relevés', () => {
  const poids = tier({ kind: 'mesure', mode: 'delta', direction: 'baisse', target: -5, unit: 'kg' });

  it('ne garde que les relevés chiffrés', () => {
    const series = measureSeries(poids, [
      checkin('2026-01-01', { value: 80 }),
      checkin('2026-01-08'), // coche sans valeur : ce n'est pas un relevé
      checkin('2026-01-15', { value: 78.5 }),
    ]);
    expect(series.map((p) => p.value)).toEqual([80, 78.5]);
  });

  it('deux pesées le même matin ne font qu’un point : la dernière', () => {
    const series = measureSeries(poids, [
      checkin('2026-01-01', { value: 80, createdAt: '2026-01-01T07:00:00.000Z' }),
      checkin('2026-01-01', { value: 79.6, createdAt: '2026-01-01T07:05:00.000Z' }),
    ]);
    expect(series).toEqual([{ day: '2026-01-01', value: 79.6 }]);
  });

  it('les points sortent triés, quel que soit l’ordre d’arrivée', () => {
    const series = measureSeries(poids, [
      checkin('2026-02-01', { value: 77 }),
      checkin('2026-01-01', { value: 80 }),
    ]);
    expect(series.map((p) => p.day)).toEqual(['2026-01-01', '2026-02-01']);
  });

  it('la cible en delta se déduit du premier relevé', () => {
    const series = measureSeries(poids, [
      checkin('2026-01-01', { value: 80 }),
      checkin('2026-01-15', { value: 78 }),
    ]);
    expect(measureTarget(poids, series)).toBe(75);
  });

  it('sans relevé, une cible en delta n’existe pas encore', () => {
    expect(measureTarget(poids, [])).toBeNull();
  });

  it('une cible absolue ne dépend d’aucun relevé', () => {
    const t = tier({ kind: 'mesure', mode: 'absolu', direction: 'baisse', target: 75, unit: 'kg' });
    expect(measureTarget(t, [])).toBe(75);
  });

  it('un palier qui n’est pas une mesure n’a pas de cible traçable', () => {
    expect(measureTarget(tier({ kind: 'cumul', target: 100 }), [])).toBeNull();
  });
});
