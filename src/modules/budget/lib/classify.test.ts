import { describe, expect, it } from 'vitest';
import { labelKey, suggestedPattern, unclassifiedGroups, unclassifiedMatching, validateRulePattern } from './classify';
import type { BudgetEntry, BudgetRule } from './types';

const entry = (id: string, label: string, amountCents: number, categoryId: string | null = null): BudgetEntry => ({
  id,
  day: '2026-10-01',
  label,
  amountCents,
  categoryId,
  source: 'import',
  importKey: id,
  note: '',
  createdAt: '2026-10-01T10:00:00Z',
});

describe('les « à classer », regroupés', () => {
  it('un même commerçant d’un mois à l’autre, malgré dates et numéros', () => {
    expect(labelKey('CB NETFLIX 12/09')).toBe('cb netflix');
    expect(labelKey('CB Netflix 03/10')).toBe('cb netflix');
    expect(labelKey('Boulangerie Ferrand n°4')).toBe('boulangerie ferrand n');
  });

  it('par groupe, les plus fournis d’abord, sans les écritures déjà classées', () => {
    const groups = unclassifiedGroups([
      entry('1', 'CB NETFLIX 12/09', -1_399),
      entry('2', 'CB NETFLIX 12/10', -1_399),
      entry('3', 'Loyer', -65_000),
      entry('4', 'CB NETFLIX 12/08', -1_399, 'cat'),
    ]);
    expect(groups.map((g) => [g.key, g.entries.length, g.totalCents])).toEqual([
      ['cb netflix', 2, -2_798],
      ['loyer', 1, -65_000],
    ]);
  });
});

describe('les règles', () => {
  const rules = [{ id: 'r1', pattern: 'NETFLIX', categoryId: 'c', priority: 10 }] as BudgetRule[];

  it('un motif d’au moins trois caractères, sans doublon', () => {
    expect(validateRulePattern('cb', rules)).toMatch(/au moins 3/);
    expect(validateRulePattern('netflix', rules)).toMatch(/existe déjà/);
    expect(validateRulePattern('netflix', rules, 'r1')).toBeNull();
    expect(validateRulePattern('Spotify', rules)).toBeNull();
  });

  it('propose le libellé sans ses chiffres, et retrouve les « à classer » qu’il rangerait', () => {
    expect(suggestedPattern('CB NETFLIX 12/09')).toBe('CB NETFLIX');
    const list = [entry('1', 'CB Netflix 12/09', -1), entry('2', 'Netflix.com', -1), entry('3', 'Netflix', -1, 'deja')];
    expect(unclassifiedMatching(list, 'NETFLIX').map((e) => e.id)).toEqual(['1', '2']);
    expect(unclassifiedMatching(list, 'ne')).toEqual([]);
  });
});
