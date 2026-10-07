import { describe, expect, it } from 'vitest';
import { isBlankRow, newBulkRow, validateBulkRows, type BulkRow } from './bulkEntries';

function row(patch: Partial<BulkRow> = {}): BulkRow {
  return { ...newBulkRow('2026-10-07'), ...patch };
}

describe('newBulkRow', () => {
  it('reprend le jour et le sens de la ligne précédente', () => {
    const previous = row({ day: '2026-10-01', isExpense: false });
    const next = newBulkRow('2026-10-07', previous);
    expect(next.day).toBe('2026-10-01');
    expect(next.isExpense).toBe(false);
    expect(next.key).not.toBe(previous.key);
  });

  it('une première ligne : le jour donné, une dépense', () => {
    const first = newBulkRow('2026-10-07');
    expect(first.day).toBe('2026-10-07');
    expect(first.isExpense).toBe(true);
  });
});

describe('validateBulkRows', () => {
  it('donne une écriture par ligne remplie, signée selon le sens', () => {
    const { inputs, errors } = validateBulkRows([
      row({ label: 'Boulangerie', amountText: '3,20', categoryId: 'courses' }),
      row({ label: 'Remboursement', amountText: '15', isExpense: false }),
    ]);
    expect(errors).toEqual({});
    expect(inputs).toEqual([
      { day: '2026-10-07', label: 'Boulangerie', amountCents: -320, categoryId: 'courses', source: 'manuelle' },
      { day: '2026-10-07', label: 'Remboursement', amountCents: 1500, categoryId: null, source: 'manuelle' },
    ]);
  });

  it('ignore les lignes vides', () => {
    const blank = row({ categoryId: 'courses' });
    expect(isBlankRow(blank)).toBe(true);
    const { inputs, errors } = validateBulkRows([blank, row({ label: 'Café', amountText: '2' })]);
    expect(errors).toEqual({});
    expect(inputs).toHaveLength(1);
  });

  it('une ligne fausse : rien n’est enregistré, l’erreur est sur sa ligne', () => {
    const bad = row({ label: 'Café', amountText: 'abc' });
    const missing = row({ amountText: '4' });
    const { inputs, errors } = validateBulkRows([row({ label: 'Pain', amountText: '1' }), bad, missing]);
    expect(inputs).toEqual([]);
    expect(Object.keys(errors).sort()).toEqual([bad.key, missing.key].sort());
    expect(errors[missing.key]).toContain('libellé');
  });
});
