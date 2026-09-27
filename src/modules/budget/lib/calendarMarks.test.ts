import { describe, expect, it } from 'vitest';
import { spendingMarks } from './calendarMarks';
import type { BudgetCategory, BudgetEntry } from './types';

const categories = [
  { id: 'food', kind: 'variable' },
  { id: 'move', kind: 'transfert' },
  { id: 'save', kind: 'epargne' },
] as BudgetCategory[];
const entry = (day: string, amountCents: number, categoryId: string | null, label = 'Achat') =>
  ({ id: `${day}${amountCents}`, day, label, amountCents, categoryId }) as BudgetEntry;

describe('spendingMarks — le calque d’Astra', () => {
  it('additionne les dépenses du jour, sans virements, épargne ni entrées', () => {
    const marks = spendingMarks(
      [
        entry('2026-09-25', -1250, 'food', 'Boulangerie'),
        entry('2026-09-25', -3000, null, 'Pharmacie'),
        entry('2026-09-25', -50000, 'move'),
        entry('2026-09-25', -10000, 'save'),
        entry('2026-09-25', 200000, null, 'Salaire'),
        entry('2026-09-10', -999, 'food'),
      ],
      categories,
      '2026-09-21',
      '2026-09-27',
    );
    expect(marks).toEqual([
      { id: 'spent|2026-09-25', day: '2026-09-25', title: '42,50 € dépensés', detail: 'Boulangerie (12,50 €), Pharmacie (30,00 €)' },
    ]);
  });
});
