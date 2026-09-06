import { describe, expect, test } from 'vitest';
import { computeMonthlyBreakdown, deltaMap, formatMonthDelta, monthDelta, subcategoryBreakdown } from './monthlyBreakdown';
import type { BudgetSlice } from './monthlyBreakdown';
import type { BudgetCategory, BudgetEntry } from './types';

function category(patch: Partial<BudgetCategory>): BudgetCategory {
  return {
    id: 'cat-1',
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

  test('les catégories epargne sont exclues du camembert, comme transfert (etude-astra-epargne.md §5)', () => {
    const cat = category({ id: 'c1', kind: 'epargne', name: 'Épargne' });
    const e = entry({ categoryId: 'c1', amountCents: -50000 });
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
    expect(result.incomeSlices).toEqual([]);
    expect(result.totalIncomeCents).toBe(0);
  });

  test('une catégorie revenu (ex. Salaire) devient une part du camembert des entrées', () => {
    const cat = category({ id: 'c1', name: 'Salaire', kind: 'revenu' });
    const e = entry({ categoryId: 'c1', amountCents: 250000 });
    const result = computeMonthlyBreakdown([e], [cat], '2026-07');
    expect(result.incomeSlices).toEqual([
      { categoryId: 'c1', label: 'Salaire', emoji: '🛒', color: '#ff0000', cents: 250000 },
    ]);
    expect(result.totalIncomeCents).toBe(250000);
  });

  test('une entrée d’argent isolée et non catégorisée apparaît sous « À classer » côté entrées, jamais masquée', () => {
    const e = entry({ categoryId: null, amountCents: 2000 });
    const result = computeMonthlyBreakdown([e], [], '2026-07');
    expect(result.incomeSlices).toEqual([
      { categoryId: null, label: 'À classer', emoji: '❔', color: '#8a8f98', cents: 2000 },
    ]);
  });

  test('un remboursement qui dépasse la dépense d’origine fait une part côté entrées, pas côté dépenses', () => {
    const cat = category({ id: 'c1', name: 'Restaurants' });
    const depense = entry({ id: 'e1', categoryId: 'c1', amountCents: -3000 });
    const remboursement = entry({ id: 'e2', categoryId: 'c1', amountCents: 5000 });
    const result = computeMonthlyBreakdown([depense, remboursement], [cat], '2026-07');
    expect(result.slices).toEqual([]);
    expect(result.incomeSlices).toEqual([
      { categoryId: 'c1', label: 'Restaurants', emoji: '🛒', color: '#ff0000', cents: 2000 },
    ]);
  });

  test('une sous-catégorie remonte dans la part de son parent, pas la sienne (docs/etude-astra.md §14)', () => {
    const loisirs = category({ id: 'loisirs', name: 'Loisirs' });
    const onePiece = category({ id: 'one-piece', name: 'Cartes One Piece', parentId: 'loisirs' });
    const direct = entry({ id: 'e1', categoryId: 'loisirs', amountCents: -1500 });
    const sub = entry({ id: 'e2', categoryId: 'one-piece', amountCents: -3800 });
    const result = computeMonthlyBreakdown([direct, sub], [loisirs, onePiece], '2026-07');
    expect(result.slices).toEqual([
      { categoryId: 'loisirs', label: 'Loisirs', emoji: '🛒', color: '#ff0000', cents: 5300 },
    ]);
  });

  test('une sous-catégorie d’une catégorie revenu remonte aussi dans le camembert des entrées', () => {
    const salaire = category({ id: 'salaire', name: 'Salaire', kind: 'revenu' });
    const prime = category({ id: 'prime', name: 'Prime', kind: 'revenu', parentId: 'salaire' });
    const e = entry({ categoryId: 'prime', amountCents: 30000 });
    const result = computeMonthlyBreakdown([e], [salaire, prime], '2026-07');
    expect(result.incomeSlices).toEqual([
      { categoryId: 'salaire', label: 'Salaire', emoji: '🛒', color: '#ff0000', cents: 30000 },
    ]);
  });

  test('les catégories transfert et epargne sont exclues des deux camemberts', () => {
    const transfert = category({ id: 'c1', kind: 'transfert', name: 'Virements internes' });
    const epargne = category({ id: 'c2', kind: 'epargne', name: 'Épargne' });
    const e1 = entry({ id: 'e1', categoryId: 'c1', amountCents: 30000 });
    const e2 = entry({ id: 'e2', categoryId: 'c2', amountCents: 20000 });
    const result = computeMonthlyBreakdown([e1, e2], [transfert, epargne], '2026-07');
    expect(result.incomeSlices).toEqual([]);
    expect(result.totalIncomeCents).toBe(0);
  });
});

describe('subcategoryBreakdown', () => {
  const loisirs = category({ id: 'loisirs', name: 'Loisirs', color: '#d16fa8' });
  const onePiece = category({
    id: 'one-piece',
    name: 'Cartes One Piece',
    emoji: '🃏',
    color: '#b06fd1',
    parentId: 'loisirs',
  });
  const cinema = category({
    id: 'cinema',
    name: 'Cinéma',
    emoji: '🎬',
    color: '#5c5548',
    parentId: 'loisirs',
  });

  test('répartit par sous-catégorie, chacune avec sa propre couleur', () => {
    const e1 = entry({ id: 'e1', categoryId: 'one-piece', amountCents: -3800 });
    const e2 = entry({ id: 'e2', categoryId: 'cinema', amountCents: -2400 });
    const result = subcategoryBreakdown([e1, e2], [loisirs, onePiece, cinema], 'loisirs', '2026-07');
    expect(result.slices).toEqual([
      { categoryId: 'one-piece', label: 'Cartes One Piece', emoji: '🃏', color: '#b06fd1', cents: 3800 },
      { categoryId: 'cinema', label: 'Cinéma', emoji: '🎬', color: '#5c5548', cents: 2400 },
    ]);
  });

  test('une écriture posée sur le parent devient « Non précisé », jamais masquée', () => {
    const direct = entry({ id: 'e1', categoryId: 'loisirs', amountCents: -1500 });
    const result = subcategoryBreakdown([direct], [loisirs, onePiece], 'loisirs', '2026-07');
    expect(result.slices).toEqual([
      { categoryId: null, label: 'Non précisé', emoji: '—', color: '#d16fa8', cents: 1500 },
    ]);
  });

  test('une sous-catégorie d’un autre parent n’apparaît pas', () => {
    const courses = category({ id: 'courses', name: 'Courses' });
    const bio = category({ id: 'bio', name: 'Bio', parentId: 'courses' });
    const e = entry({ categoryId: 'bio', amountCents: -2000 });
    const result = subcategoryBreakdown([e], [loisirs, onePiece, courses, bio], 'loisirs', '2026-07');
    expect(result.slices).toEqual([]);
  });

  test('un remboursement réduit la part de sa sous-catégorie sans devenir un revenu', () => {
    const depense = entry({ id: 'e1', categoryId: 'one-piece', amountCents: -3800 });
    const remboursement = entry({ id: 'e2', categoryId: 'one-piece', amountCents: 1000 });
    const result = subcategoryBreakdown([depense, remboursement], [loisirs, onePiece], 'loisirs', '2026-07');
    expect(result.slices).toEqual([
      { categoryId: 'one-piece', label: 'Cartes One Piece', emoji: '🃏', color: '#b06fd1', cents: 2800 },
    ]);
    expect(result.incomeSlices).toEqual([]);
  });

  test('rien ce mois-ci rend un détail vide', () => {
    const result = subcategoryBreakdown([], [loisirs, onePiece], 'loisirs', '2026-07');
    expect(result.slices).toEqual([]);
    expect(result.incomeSlices).toEqual([]);
  });
});

describe('monthDelta', () => {
  test('calcule un pourcentage d’évolution', () => {
    expect(monthDelta(11000, 10000)).toEqual({ kind: 'change', percent: 10 });
    expect(monthDelta(8000, 10000)).toEqual({ kind: 'change', percent: -20 });
  });

  test('rien les deux mois : rien à comparer', () => {
    expect(monthDelta(0, 0)).toEqual({ kind: 'none' });
  });

  test('rien le mois précédent, quelque chose ce mois-ci : « nouveau », pas un pourcentage', () => {
    expect(monthDelta(5000, 0)).toEqual({ kind: 'new' });
  });

  test('une baisse à zéro reste un pourcentage exact (-100 %)', () => {
    expect(monthDelta(0, 5000)).toEqual({ kind: 'change', percent: -100 });
  });
});

function slice(patch: Partial<BudgetSlice>): BudgetSlice {
  return { categoryId: 'c1', label: 'Courses', emoji: '🛒', color: '#ff0000', cents: 0, ...patch };
}

describe('deltaMap', () => {
  test('associe chaque part du mois à celle du mois précédent, par catégorie', () => {
    const current = [slice({ categoryId: 'c1', cents: 11000 }), slice({ categoryId: 'c2', cents: 3000 })];
    const previous = [slice({ categoryId: 'c1', cents: 10000 })];
    const map = deltaMap(current, previous);
    expect(map.get('c1')).toEqual({ kind: 'change', percent: 10 });
    expect(map.get('c2')).toEqual({ kind: 'new' });
  });

  test('« à classer » (categoryId null) se compare aussi, sous la clé vide', () => {
    const current = [slice({ categoryId: null, cents: 2000 })];
    const previous = [slice({ categoryId: null, cents: 4000 })];
    expect(deltaMap(current, previous).get('')).toEqual({ kind: 'change', percent: -50 });
  });
});

describe('formatMonthDelta', () => {
  test('rien à dire pour « none »', () => {
    expect(formatMonthDelta({ kind: 'none' })).toBeNull();
  });

  test('« nouveau » reste tel quel', () => {
    expect(formatMonthDelta({ kind: 'new' })).toBe('nouveau');
  });

  test('un pourcentage positif porte son signe', () => {
    expect(formatMonthDelta({ kind: 'change', percent: 12.4 })).toBe('+12 %');
  });

  test('un pourcentage négatif garde le sien, sans doublon', () => {
    expect(formatMonthDelta({ kind: 'change', percent: -8.2 })).toBe('-8 %');
  });
});
