import { describe, expect, it } from 'vitest';
import { bilanPeriod, buildBilan } from '../../../../supabase/functions/atlas-mcp/bilan.ts';
import { computeMonthlyBreakdown } from './monthlyBreakdown';
import type { BudgetCategory, BudgetEntry } from './types';

const cat = (id: string, name: string, kind: BudgetCategory['kind'], parentId: string | null = null): BudgetCategory =>
  ({ id, name, kind, parentId, emoji: '', color: '', position: 0 }) as BudgetCategory;
const entry = (id: string, day: string, amountCents: number, categoryId: string | null): BudgetEntry =>
  ({ id, day, label: id, amountCents, categoryId, source: 'manuelle', importKey: null, note: '', createdAt: '' }) as BudgetEntry;

describe('le bilan transversal du connecteur', () => {
  it('compte Budget comme le camembert : virements et épargne écartés, remboursements déduits', () => {
    const categories = [
      cat('c', 'Courses', 'variable'),
      cat('r', 'Restaurants', 'variable'),
      cat('b', 'Bar', 'variable', 'r'),
      cat('s', 'Salaire', 'revenu'),
      cat('v', 'Virement interne', 'transfert'),
      cat('e', 'Épargne', 'epargne'),
    ];
    const entries = [
      entry('1', '2026-10-02', -5420, 'c'),
      entry('2', '2026-10-03', -3000, 'r'),
      entry('3', '2026-10-04', -1200, 'b'),
      entry('4', '2026-10-05', 1000, 'r'),
      entry('5', '2026-10-01', 210000, 's'),
      entry('6', '2026-10-06', -50000, 'v'),
      entry('7', '2026-10-07', -20000, 'e'),
      entry('8', '2026-10-08', -990, null),
    ];
    const app = computeMonthlyBreakdown(entries, categories, '2026-10');
    const bilan = buildBilan(
      {
        budget: {
          entries: entries.map((e) => ({ day: e.day, amount_cents: e.amountCents, category_id: e.categoryId })),
          categories: categories.map((c) => ({ id: c.id, name: c.name, kind: c.kind, parent_id: c.parentId })),
        },
      },
      '2026-10-01',
      '2026-10-31',
    ).budget as { spent: number; income: number; to_classify: number; top_categories: { category: string; spent: number }[] };
    expect(bilan.spent * 100).toBe(app.totalSpentCents);
    expect(bilan.income * 100).toBe(app.totalIncomeCents);
    expect(bilan.to_classify).toBe(1);
    expect(bilan.top_categories).toEqual([
      { category: 'Courses', spent: 54.2 },
      { category: 'Restaurants', spent: 32 },
      { category: 'À classer', spent: 9.9 },
    ]);
  });

  it('résume les autres modules, et ignore ceux qui manquent', () => {
    const bilan = buildBilan(
      {
        sport: {
          runs: [
            { day: '2026-10-06', distance_m: 8000, duration_s: 2700 },
            { day: '2026-10-11', distance_m: 18000, duration_s: 6300 },
          ],
          activities: [{ day: '2026-10-08', sport: 'renfo', duration_s: 1800 }],
          sessions: [
            { kind: 'footing', done: true },
            { kind: 'renfo', done: true },
            { kind: 'seuil', done: false },
          ],
        },
        nutrition: { entries: [{ day: '2026-10-06', kcal: 900 }, { day: '2026-10-06', kcal: 1100 }, { day: '2026-10-07', kcal: 2400 }] },
        objectifs: {
          goals: [{ id: 'g', title: 'Marathon', archived: false }],
          checkins: [
            { goal_id: 'g', day: '2026-10-06', pp: 20 },
            { goal_id: 'g', day: '2026-10-07', pp: 30 },
          ],
        },
      },
      '2026-10-05',
      '2026-10-11',
    );
    expect(bilan).toMatchObject({
      days: 7,
      sport: { runs: 2, running_km: 26, longest_km: 18, strength_sessions: 1, bike_sessions: 0, plan_sessions: { planned: 3, done: 2 } },
      nutrition: { logged_days: 2, average_kcal: 2200 },
      objectifs: { checkins: 2, pp: 50, active_days: 2, per_goal: [{ goal: 'Marathon', pp: 50 }] },
    });
    expect(bilan).not.toHaveProperty('budget');
  });

  it('comprend les périodes', () => {
    expect(bilanPeriod({}, '2026-10-15')).toEqual({ from: '2026-10-12', to: '2026-10-15' });
    expect(bilanPeriod({ period: 'semaine_derniere' }, '2026-10-15')).toEqual({ from: '2026-10-05', to: '2026-10-11' });
    expect(bilanPeriod({ period: 'mois_dernier' }, '2026-03-15')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(() => bilanPeriod({ from: '2026-10-10', to: '2026-10-01' }, '2026-10-15')).toThrow();
  });
});
