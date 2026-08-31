import { describe, expect, it } from 'vitest';
import { mostUsedCategoryIds } from './categoryPicker';
import type { BudgetEntry } from './types';

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

describe('mostUsedCategoryIds', () => {
  it('classe les catégories par fréquence décroissante', () => {
    const entries = [
      entry({ categoryId: 'courses' }),
      entry({ categoryId: 'courses' }),
      entry({ categoryId: 'courses' }),
      entry({ categoryId: 'loyer' }),
      entry({ categoryId: 'loyer' }),
      entry({ categoryId: 'cinema' }),
    ];
    expect(mostUsedCategoryIds(entries)).toEqual(['courses', 'loyer', 'cinema']);
  });

  it('ignore les écritures « à classer »', () => {
    const entries = [entry({ categoryId: null }), entry({ categoryId: null }), entry({ categoryId: 'courses' })];
    expect(mostUsedCategoryIds(entries)).toEqual(['courses']);
  });

  it('se limite au nombre demandé', () => {
    const entries = ['a', 'b', 'c', 'd'].map((categoryId) => entry({ categoryId }));
    expect(mostUsedCategoryIds(entries, 2)).toHaveLength(2);
  });

  it('sans historique, aucune suggestion', () => {
    expect(mostUsedCategoryIds([])).toEqual([]);
  });
});
