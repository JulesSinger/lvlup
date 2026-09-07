import { describe, expect, test } from 'vitest';
import { computeIncomeTrend, computeNetTrend, computeSpendingTrend } from './spendingTrend';
import type { BudgetCategory, BudgetEntry } from './types';

function category(patch: Partial<BudgetCategory>): BudgetCategory {
  return {
    id: 'c1',
    name: 'Courses',
    emoji: '🛒',
    color: '#ff0000',
    kind: 'variable',
    position: 0,
    parentId: null,
    ...patch,
  };
}

function entry(patch: Partial<BudgetEntry>): BudgetEntry {
  return {
    id: 'e1',
    day: '2026-07-04',
    label: 'Test',
    amountCents: -1000,
    categoryId: null,
    source: 'manuelle',
    importKey: null,
    note: '',
    createdAt: '2026-07-04T00:00:00.000Z',
    ...patch,
  };
}

describe('computeSpendingTrend', () => {
  test('le total additionne toutes les dépenses du mois, sans rien demander de précis', () => {
    const courses = category({ id: 'c1' });
    const loyer = category({ id: 'c2', name: 'Loyer', kind: 'fixe' });
    const list = [
      entry({ id: 'e1', day: '2026-07-05', categoryId: 'c1', amountCents: -4500 }),
      entry({ id: 'e2', day: '2026-07-10', categoryId: 'c2', amountCents: -80000 }),
    ];
    const trend = computeSpendingTrend(list, [courses, loyer], null, '2026-07');
    expect(trend).toEqual([{ monthKey: '2026-07', cents: 84500 }]);
  });

  test('une seule catégorie ne compte que ses propres écritures', () => {
    const courses = category({ id: 'c1' });
    const loyer = category({ id: 'c2', name: 'Loyer', kind: 'fixe' });
    const list = [
      entry({ id: 'e1', day: '2026-07-05', categoryId: 'c1', amountCents: -4500 }),
      entry({ id: 'e2', day: '2026-07-10', categoryId: 'c2', amountCents: -80000 }),
    ];
    const trend = computeSpendingTrend(list, [courses, loyer], 'c1', '2026-07');
    expect(trend).toEqual([{ monthKey: '2026-07', cents: 4500 }]);
  });

  test('une sous-catégorie remonte dans la courbe de son parent', () => {
    const loisirs = category({ id: 'loisirs', name: 'Loisirs' });
    const onePiece = category({ id: 'one-piece', name: 'Cartes One Piece', parentId: 'loisirs' });
    const list = [entry({ day: '2026-07-05', categoryId: 'one-piece', amountCents: -3800 })];
    const trend = computeSpendingTrend(list, [loisirs, onePiece], 'loisirs', '2026-07');
    expect(trend).toEqual([{ monthKey: '2026-07', cents: 3800 }]);
  });

  test('les mois sans rien dépenser restent dans la courbe, à zéro', () => {
    const courses = category({ id: 'c1' });
    const list = [
      entry({ id: 'e1', day: '2026-05-05', categoryId: 'c1', amountCents: -1000 }),
      entry({ id: 'e2', day: '2026-07-05', categoryId: 'c1', amountCents: -2000 }),
    ];
    const trend = computeSpendingTrend(list, [courses], null, '2026-07');
    expect(trend.map((p) => p.cents)).toEqual([1000, 0, 2000]);
    expect(trend.map((p) => p.monthKey)).toEqual(['2026-05', '2026-06', '2026-07']);
  });

  test('la fenêtre commence au premier mois d’activité, quelle que soit la catégorie choisie ensuite', () => {
    const courses = category({ id: 'c1' });
    const loisirs = category({ id: 'c2', name: 'Loisirs' });
    const list = [
      entry({ id: 'e1', day: '2026-05-05', categoryId: 'c1', amountCents: -1000 }),
      entry({ id: 'e2', day: '2026-07-05', categoryId: 'c2', amountCents: -2000 }),
    ];
    // Loisirs n'a rien avant juillet, mais la fenêtre reste celle de mai à
    // juillet : changer de catégorie ne doit jamais bouger l'axe des temps.
    const trend = computeSpendingTrend(list, [courses, loisirs], 'c2', '2026-07');
    expect(trend.map((p) => p.monthKey)).toEqual(['2026-05', '2026-06', '2026-07']);
    expect(trend.map((p) => p.cents)).toEqual([0, 0, 2000]);
  });

  test('transfert, épargne et revenu sont hors du périmètre', () => {
    const transfert = category({ id: 'c1', kind: 'transfert' });
    const epargne = category({ id: 'c2', kind: 'epargne' });
    const revenu = category({ id: 'c3', kind: 'revenu' });
    const list = [
      entry({ id: 'e1', day: '2026-07-05', categoryId: 'c1', amountCents: -1000 }),
      entry({ id: 'e2', day: '2026-07-05', categoryId: 'c2', amountCents: -2000 }),
      entry({ id: 'e3', day: '2026-07-05', categoryId: 'c3', amountCents: 300000 }),
    ];
    const trend = computeSpendingTrend(list, [transfert, epargne, revenu], null, '2026-07');
    expect(trend).toEqual([]);
  });

  test('un remboursement complet ramène la part à zéro, jamais en négatif', () => {
    const courses = category({ id: 'c1' });
    const list = [
      entry({ id: 'e1', day: '2026-07-05', categoryId: 'c1', amountCents: -3000 }),
      entry({ id: 'e2', day: '2026-07-10', categoryId: 'c1', amountCents: 5000 }),
    ];
    const trend = computeSpendingTrend(list, [courses], 'c1', '2026-07');
    expect(trend).toEqual([{ monthKey: '2026-07', cents: 0 }]);
  });

  test('rien nulle part rend une courbe vide', () => {
    expect(computeSpendingTrend([], [], null, '2026-07')).toEqual([]);
  });

  test('ignore les écritures datées dans le futur', () => {
    const courses = category({ id: 'c1' });
    const list = [entry({ day: '2026-09-05', categoryId: 'c1', amountCents: -1000 })];
    expect(computeSpendingTrend(list, [courses], null, '2026-07')).toEqual([]);
  });
});

describe('computeIncomeTrend', () => {
  test('le total additionne toutes les entrées du mois', () => {
    const salaire = category({ id: 'c1', name: 'Salaire', kind: 'revenu' });
    const list = [entry({ day: '2026-07-01', categoryId: 'c1', amountCents: 250000 })];
    expect(computeIncomeTrend(list, [salaire], null, '2026-07')).toEqual([
      { monthKey: '2026-07', cents: 250000 },
    ]);
  });

  test('une seule catégorie ne compte que ses propres entrées', () => {
    const salaire = category({ id: 'c1', name: 'Salaire', kind: 'revenu' });
    const aides = category({ id: 'c2', name: 'Aides', kind: 'revenu' });
    const list = [
      entry({ id: 'e1', day: '2026-07-01', categoryId: 'c1', amountCents: 250000 }),
      entry({ id: 'e2', day: '2026-07-05', categoryId: 'c2', amountCents: 10000 }),
    ];
    expect(computeIncomeTrend(list, [salaire, aides], 'c1', '2026-07')).toEqual([
      { monthKey: '2026-07', cents: 250000 },
    ]);
  });

  test('les mois sans rien reçu restent dans la courbe, à zéro', () => {
    const salaire = category({ id: 'c1', name: 'Salaire', kind: 'revenu' });
    const list = [
      entry({ id: 'e1', day: '2026-05-01', categoryId: 'c1', amountCents: 200000 }),
      entry({ id: 'e2', day: '2026-07-01', categoryId: 'c1', amountCents: 200000 }),
    ];
    const trend = computeIncomeTrend(list, [salaire], null, '2026-07');
    expect(trend.map((p) => p.cents)).toEqual([200000, 0, 200000]);
  });

  test('transfert et épargne sont hors du périmètre', () => {
    const transfert = category({ id: 'c1', kind: 'transfert' });
    const epargne = category({ id: 'c2', kind: 'epargne' });
    const list = [
      entry({ id: 'e1', day: '2026-07-01', categoryId: 'c1', amountCents: 30000 }),
      entry({ id: 'e2', day: '2026-07-02', categoryId: 'c2', amountCents: 20000 }),
    ];
    expect(computeIncomeTrend(list, [transfert, epargne], null, '2026-07')).toEqual([]);
  });

  test('un remboursement dans une catégorie de dépense compte aussi comme une entrée', () => {
    // Le camembert des entrées d'Aperçu fait la même chose : la nature de
    // la catégorie ne décide pas seule, le signe du net compte.
    const restos = category({ id: 'c1', name: 'Restaurants', kind: 'variable' });
    const depense = entry({ id: 'e1', day: '2026-07-01', categoryId: 'c1', amountCents: -3000 });
    const remboursement = entry({ id: 'e2', day: '2026-07-05', categoryId: 'c1', amountCents: 5000 });
    const trend = computeIncomeTrend([depense, remboursement], [restos], null, '2026-07');
    expect(trend).toEqual([{ monthKey: '2026-07', cents: 2000 }]);
  });
});

describe('computeNetTrend', () => {
  test('additionne les entrées et soustrait les dépenses, comme le Solde d’Aperçu', () => {
    const salaire = category({ id: 'c1', name: 'Salaire', kind: 'revenu' });
    const courses = category({ id: 'c2', name: 'Courses', kind: 'variable' });
    const list = [
      entry({ id: 'e1', day: '2026-07-01', categoryId: 'c1', amountCents: 250000 }),
      entry({ id: 'e2', day: '2026-07-05', categoryId: 'c2', amountCents: -80000 }),
    ];
    expect(computeNetTrend(list, [salaire, courses], '2026-07')).toEqual([
      { monthKey: '2026-07', cents: 170000 },
    ]);
  });

  test('un mois dans le rouge reste négatif, jamais ramené à zéro', () => {
    const salaire = category({ id: 'c1', name: 'Salaire', kind: 'revenu' });
    const loyer = category({ id: 'c2', name: 'Loyer', kind: 'fixe' });
    const list = [
      entry({ id: 'e1', day: '2026-07-01', categoryId: 'c1', amountCents: 100000 }),
      entry({ id: 'e2', day: '2026-07-05', categoryId: 'c2', amountCents: -150000 }),
    ];
    expect(computeNetTrend(list, [salaire, loyer], '2026-07')).toEqual([
      { monthKey: '2026-07', cents: -50000 },
    ]);
  });

  test('épargne et transfert sont hors du différentiel, comme le Solde d’Aperçu', () => {
    const epargne = category({ id: 'c1', kind: 'epargne' });
    const list = [entry({ id: 'e1', day: '2026-07-01', categoryId: 'c1', amountCents: -50000 })];
    expect(computeNetTrend(list, [epargne], '2026-07')).toEqual([]);
  });

  test('les mois sans rien restent dans la courbe, à zéro', () => {
    const salaire = category({ id: 'c1', name: 'Salaire', kind: 'revenu' });
    const list = [
      entry({ id: 'e1', day: '2026-05-01', categoryId: 'c1', amountCents: 100000 }),
      entry({ id: 'e2', day: '2026-07-01', categoryId: 'c1', amountCents: 50000 }),
    ];
    const trend = computeNetTrend(list, [salaire], '2026-07');
    expect(trend.map((p) => p.cents)).toEqual([100000, 0, 50000]);
  });
});
