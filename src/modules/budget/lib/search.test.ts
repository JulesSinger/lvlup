import { describe, expect, it } from 'vitest';
import { fold, searchEntries, summarize } from './search';
import type { BudgetCategory, BudgetEntry } from './types';

const cat = (id: string, name: string) => ({ id, name }) as BudgetCategory;
const entry = (id: string, day: string, label: string, amountCents: number, over: Partial<BudgetEntry> = {}): BudgetEntry => ({
  id,
  day,
  label,
  amountCents,
  categoryId: null,
  source: 'manuelle',
  importKey: null,
  note: '',
  createdAt: `${day}T10:00:00Z`,
  ...over,
});

const categories = [cat('c1', 'Électricité'), cat('c2', 'Courses')];
const entries = [
  entry('a', '2026-03-02', 'Amazon Marketplace', -2_499, { categoryId: 'c2' }),
  entry('b', '2026-09-14', 'AMAZON prime', -699),
  entry('c', '2026-05-01', 'EDF facture', -6_250, { categoryId: 'c1' }),
  entry('d', '2026-06-10', 'Remboursement Amazon', 2_499, { note: 'colis abîmé' }),
];

describe('chercher dans les écritures', () => {
  it('sans accents ni casse, dans le libellé, la note et la catégorie ; les plus récentes d’abord', () => {
    expect(fold('  Électricité  Été ')).toBe('electricite ete');
    expect(searchEntries(entries, categories, 'amazon').map((e) => e.id)).toEqual(['b', 'd', 'a']);
    expect(searchEntries(entries, categories, 'electricite').map((e) => e.id)).toEqual(['c']);
    expect(searchEntries(entries, categories, 'abime').map((e) => e.id)).toEqual(['d']);
    expect(searchEntries(entries, categories, 'à classer').map((e) => e.id)).toEqual(['b', 'd']);
  });

  it('tous les mots doivent y être ; un montant trouve les écritures de ce montant', () => {
    expect(searchEntries(entries, categories, 'amazon prime').map((e) => e.id)).toEqual(['b']);
    expect(searchEntries(entries, categories, '24,99').map((e) => e.id)).toEqual(['d', 'a']);
    expect(searchEntries(entries, categories, '   ')).toEqual([]);
  });

  it('le bilan d’une recherche : combien, sorti, entré, sur quelle période', () => {
    expect(summarize(searchEntries(entries, categories, 'amazon'))).toEqual({ count: 3, spentCents: 3_198, receivedCents: 2_499, firstDay: '2026-03-02', lastDay: '2026-09-14' });
  });
});
