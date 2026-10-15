import { describe, expect, it } from 'vitest';
import type { ShoppingSpendTrip } from '../../../core/lib/services';
import { moduleRefs, shoppingContent, shoppingTrend } from './shoppingContent';
import type { BudgetEntry } from './types';

// Le contenu des courses d'une part du budget (docs/etude-courses-typologies.md §4).
const labels = {
  typologies: [
    { id: 'alimentation', label: 'Alimentation', emoji: '🥖' },
    { id: 'maison', label: 'Maison et équipement', emoji: '🏠' },
    { id: 'hygiene', label: 'Hygiène et beauté', emoji: '🧴' },
  ],
  foodTypology: 'alimentation',
  foodKinds: [
    { id: 'essentiel', label: 'Essentiel' },
    { id: 'plaisir', label: 'Plaisir' },
    { id: 'alcool', label: 'Alcool' },
  ],
};

const entry = (amountCents: number, importKey: string | null, source: BudgetEntry['source'] = 'manuelle'): BudgetEntry =>
  ({ id: `e${amountCents}`, day: '2026-10-10', label: 'x', amountCents, categoryId: 'courses', source, importKey, note: '', createdAt: '' }) as BudgetEntry;

const trip = (ref: string, byKey: Record<string, number>, adjustmentCents = 0, undetailedCents = 0): ShoppingSpendTrip => ({
  ref,
  day: '2026-10-10',
  store: 'Auchan',
  totalCents: null,
  lines: [],
  byKey,
  adjustmentCents,
  undetailedCents,
});

describe('le contenu des courses d’une part', () => {
  it('additionne les courses détaillées, l’alimentation en sous-types, et dit ce qui reste sans ticket', () => {
    const entries = [entry(-3884, 'comete:course:1'), entry(-4388, 'comete:course:2'), entry(-7255, 'abc123', 'import'), entry(1500, null)];
    const content = shoppingContent(
      entries,
      [
        trip('comete:course:1', { 'alimentation:essentiel': 2041, 'alimentation:plaisir': 182, 'alimentation:alcool': 525, hygiene: 310, entretien: 826 }),
        trip('comete:course:2', { maison: 4388 }, -100),
      ],
      labels,
    );
    expect(content.rows).toEqual([
      { id: 'maison', label: 'Maison et équipement', emoji: '🏠', cents: 4388, kinds: [] },
      {
        id: 'alimentation',
        label: 'Alimentation',
        emoji: '🥖',
        cents: 2748,
        kinds: [
          { id: 'essentiel', label: 'Essentiel', cents: 2041 },
          { id: 'plaisir', label: 'Plaisir', cents: 182 },
          { id: 'alcool', label: 'Alcool', cents: 525 },
        ],
      },
      { id: 'hygiene', label: 'Hygiène et beauté', emoji: '🧴', cents: 310, kinds: [] },
    ]);
    expect(content.detailedCents).toBe(8272);
    expect(content.adjustmentCents).toBe(-100);
    // Le relevé importé moins un remboursement.
    expect(content.withoutTicketCents).toBe(5755);
  });

  it('ne demande au service que les références des dépenses créées par un module', () => {
    expect(moduleRefs([entry(-1, 'comete:course:1'), entry(-2, 'comete:course:1'), entry(-3, 'empreinte', 'import'), entry(-4, null)])).toEqual(['comete:course:1']);
  });
});

describe('l’évolution du contenu des courses', () => {
  it('mois par mois, une typologie entière ou un sous-type, les mois vides à zéro', () => {
    const trips = [
      { ...trip('a', { 'alimentation:essentiel': 1000, 'alimentation:plaisir': 200 }), day: '2026-08-10' },
      { ...trip('b', { 'alimentation:plaisir': 300, maison: 900 }), day: '2026-10-02' },
    ];
    expect(shoppingTrend(trips, 'alimentation', '2026-10')).toEqual([
      { monthKey: '2026-08', cents: 1200 },
      { monthKey: '2026-09', cents: 0 },
      { monthKey: '2026-10', cents: 300 },
    ]);
    expect(shoppingTrend(trips, 'alimentation:plaisir', '2026-10').map((p) => p.cents)).toEqual([200, 0, 300]);
    expect(shoppingTrend(trips, 'maison', '2026-10').map((p) => p.cents)).toEqual([0, 0, 900]);
    expect(shoppingTrend([], 'maison', '2026-10')).toEqual([]);
  });
});
