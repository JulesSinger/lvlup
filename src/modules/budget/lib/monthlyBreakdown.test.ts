import { describe, expect, test } from 'vitest';
import { computeMonthlyBreakdown } from './monthlyBreakdown';
import type { BudgetCategory, BudgetEntry } from './types';

function category(patch: Partial<BudgetCategory>): BudgetCategory {
  return {
    id: 'cat-1',
    name: 'Courses',
    emoji: '🛒',
    color: '#ff0000',
    kind: 'variable',
    position: 0,
    ...patch,
  };
}

function entry(patch: Partial<BudgetEntry>): BudgetEntry {
  return {
    id: 'e-1',
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

describe('computeMonthlyBreakdown', () => {
  test('une dépense catégorisée devient une part au montant positif', () => {
    const cat = category({ id: 'c1', name: 'Courses' });
    const e = entry({ id: 'e1', categoryId: 'c1', amountCents: -4500 });
    const result = computeMonthlyBreakdown([e], [cat], '2026-07');
    expect(result.slices).toEqual([
      { categoryId: 'c1', label: 'Courses', emoji: '🛒', color: '#ff0000', cents: 4500 },
    ]);
    expect(result.totalSpentCents).toBe(4500);
  });

  test('les catégories transfert sont exclues du camembert (etude-astra.md §2/§6)', () => {
    const cat = category({ id: 'c1', kind: 'transfert', name: 'Épargne' });
    const e = entry({ categoryId: 'c1', amountCents: -30000 });
    const result = computeMonthlyBreakdown([e], [cat], '2026-07');
    expect(result.slices).toEqual([]);
    expect(result.totalSpentCents).toBe(0);
  });

  test('une écriture dépensée sans catégorie apparaît sous « À classer », jamais masquée', () => {
    const e = entry({ categoryId: null, amountCents: -1500 });
    const result = computeMonthlyBreakdown([e], [], '2026-07');
    expect(result.slices).toEqual([
      { categoryId: null, label: 'À classer', emoji: '❔', color: '#8a8f98', cents: 1500 },
    ]);
  });

  test('une entrée d’argent isolée et non catégorisée (ex. remboursement d’ami) ne fait pas de part', () => {
    const e = entry({ categoryId: null, amountCents: 2000 });
    const result = computeMonthlyBreakdown([e], [], '2026-07');
    expect(result.slices).toEqual([]);
    expect(result.totalSpentCents).toBe(0);
  });

  test('un remboursement dans une catégorie de dépense réduit sa part sans créer de revenu (etude-astra.md §6)', () => {
    const cat = category({ id: 'c1', name: 'Restaurants' });
    const depense = entry({ id: 'e1', categoryId: 'c1', amountCents: -8000 });
    const remboursement = entry({ id: 'e2', categoryId: 'c1', amountCents: 4000 });
    const result = computeMonthlyBreakdown([depense, remboursement], [cat], '2026-07');
    expect(result.slices).toEqual([
      { categoryId: 'c1', label: 'Restaurants', emoji: '🛒', color: '#ff0000', cents: 4000 },
    ]);
  });

  test('une catégorie entièrement remboursée (net positif ou nul) ne fait pas de part', () => {
    const cat = category({ id: 'c1', name: 'Restaurants' });
    const depense = entry({ id: 'e1', categoryId: 'c1', amountCents: -4000 });
    const remboursement = entry({ id: 'e2', categoryId: 'c1', amountCents: 4000 });
    const result = computeMonthlyBreakdown([depense, remboursement], [cat], '2026-07');
    expect(result.slices).toEqual([]);
  });

  test('une catégorie revenu (ex. Salaire) est exclue naturellement, sans cas particulier sur kind', () => {
    const cat = category({ id: 'c1', name: 'Salaire', kind: 'revenu' });
    const e = entry({ categoryId: 'c1', amountCents: 250000 });
    const result = computeMonthlyBreakdown([e], [cat], '2026-07');
    expect(result.slices).toEqual([]);
  });

  test('seules les écritures du mois demandé comptent', () => {
    const cat = category({ id: 'c1' });
    const juillet = entry({ id: 'e1', day: '2026-07-15', categoryId: 'c1', amountCents: -1000 });
    const aout = entry({ id: 'e2', day: '2026-08-02', categoryId: 'c1', amountCents: -2000 });
    const result = computeMonthlyBreakdown([juillet, aout], [cat], '2026-07');
    expect(result.slices).toEqual([{ categoryId: 'c1', label: 'Courses', emoji: '🛒', color: '#ff0000', cents: 1000 }]);
  });

  test('les parts sont triées du plus dépensé au moins dépensé', () => {
    const petite = category({ id: 'c1', name: 'Petite' });
    const grosse = category({ id: 'c2', name: 'Grosse' });
    const e1 = entry({ id: 'e1', categoryId: 'c1', amountCents: -500 });
    const e2 = entry({ id: 'e2', categoryId: 'c2', amountCents: -9000 });
    const result = computeMonthlyBreakdown([e1, e2], [petite, grosse], '2026-07');
    expect(result.slices.map((s) => s.label)).toEqual(['Grosse', 'Petite']);
  });

  test('aucune écriture ce mois-ci rend un camembert vide', () => {
    const result = computeMonthlyBreakdown([], [], '2026-07');
    expect(result.slices).toEqual([]);
    expect(result.totalSpentCents).toBe(0);
  });
});
