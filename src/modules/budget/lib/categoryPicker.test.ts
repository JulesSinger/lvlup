import { describe, expect, it } from 'vitest';
import { frequentCategoryIds, menuKindOrder } from './categoryPicker';
import type { BudgetCategory, BudgetCategoryKind, BudgetEntry } from './types';

let n = 0;

function entry(patch: Partial<BudgetEntry> = {}): BudgetEntry {
  n += 1;
  return {
    id: `e${n}`,
    day: '2026-08-01',
    label: 'Test',
    amountCents: -1000,
    categoryId: null,
    source: 'manuelle',
    importKey: null,
    note: '',
    createdAt: '2026-08-01T08:00:00.000Z',
    ...patch,
  };
}

function category(id: string, kind: BudgetCategoryKind = 'variable', position = 0, parentId: string | null = null): BudgetCategory {
  return { id, name: id, emoji: '', color: '', kind, position, parentId };
}

const categories = [
  category('courses'),
  category('loyer', 'fixe'),
  category('cinema', 'variable', 1),
  category('sante', 'variable', 2),
  category('salaire', 'revenu'),
  category('freelance', 'revenu', 1),
];

describe('frequentCategoryIds', () => {
  it('classe les catégories de dépense par fréquence décroissante', () => {
    const entries = [
      entry({ categoryId: 'courses' }),
      entry({ categoryId: 'courses' }),
      entry({ categoryId: 'courses' }),
      entry({ categoryId: 'loyer' }),
      entry({ categoryId: 'loyer' }),
      entry({ categoryId: 'cinema' }),
    ];
    expect(frequentCategoryIds(entries, categories, 'expense', 3)).toEqual(['courses', 'loyer', 'cinema']);
  });

  it('côté Entrée, ne compte que les entrées — un remboursement rangé en Santé remonte', () => {
    const entries = [
      entry({ categoryId: 'courses' }),
      entry({ categoryId: 'courses' }),
      entry({ categoryId: 'sante', amountCents: 2500 }),
      entry({ categoryId: 'sante', amountCents: 2500 }),
      entry({ categoryId: 'salaire', amountCents: 200000 }),
    ];
    expect(frequentCategoryIds(entries, categories, 'income')).toEqual(['sante', 'salaire', 'freelance']);
  });

  it('sans historique, propose les catégories qui vont avec le sens', () => {
    expect(frequentCategoryIds([], categories, 'income')).toEqual(['salaire', 'freelance']);
    expect(frequentCategoryIds([], categories, 'expense', 3)).toEqual(['courses', 'cinema', 'sante']);
  });

  it('complète un historique court sans répéter une catégorie', () => {
    const entries = [entry({ categoryId: 'freelance', amountCents: 50000 })];
    expect(frequentCategoryIds(entries, categories, 'income')).toEqual(['freelance', 'salaire']);
  });

  it('ignore les écritures « à classer » et les catégories supprimées', () => {
    const entries = [entry({ categoryId: null }), entry({ categoryId: 'disparue' }), entry({ categoryId: 'loyer' })];
    expect(frequentCategoryIds(entries, categories, 'expense', 1)).toEqual(['loyer']);
  });

  it('ne propose pas une sous-catégorie pour compléter', () => {
    const withChild = [...categories, category('bar', 'revenu', 0, 'salaire')];
    expect(frequentCategoryIds([], withChild, 'income')).not.toContain('bar');
  });

  it('se limite au nombre demandé', () => {
    expect(frequentCategoryIds([], categories, 'expense', 2)).toHaveLength(2);
  });
});

describe('menuKindOrder', () => {
  it('met les revenus en tête pour une entrée, à la fin pour une dépense', () => {
    expect(menuKindOrder('income')[0]).toBe('revenu');
    expect(menuKindOrder('expense').at(-1)).toBe('revenu');
    expect([...menuKindOrder('income')].sort()).toEqual([...menuKindOrder('expense')].sort());
  });
});
