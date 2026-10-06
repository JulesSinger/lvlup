import { describe, expect, it } from 'vitest';
import { detectRecurring, recurringTotals } from './recurring';
import type { BudgetCategory, BudgetEntry } from './types';

const TODAY = '2026-10-07';
let seq = 0;
const entry = (day: string, label: string, amountCents: number, categoryId: string | null = null): BudgetEntry => ({
  id: `e${++seq}`,
  day,
  label,
  amountCents,
  categoryId,
  source: 'import',
  importKey: null,
  note: '',
  createdAt: `${day}T10:00:00Z`,
});
const monthly = (label: string, amount: number, months: string[], day = '12') => months.map((m) => entry(`2026-${m}-${day}`, `${label} ${day}/${m}`, -amount));

describe('les dépenses récurrentes', () => {
  it('un abonnement mensuel : même libellé, même montant, chaque mois', () => {
    const [netflix] = detectRecurring(monthly('CB NETFLIX', 1_399, ['06', '07', '08', '09']), [], TODAY);
    expect(netflix).toMatchObject({
      key: 'cb netflix',
      label: 'CB NETFLIX',
      frequency: 'mensuel',
      amountCents: 1_399,
      monthlyCents: 1_399,
      count: 4,
      lastDay: '2026-09-12',
      nextDay: '2026-10-13',
      active: true,
    });
  });

  it('une hausse de prix reste le même abonnement ; le dernier montant est retenu à part', () => {
    const list = [...monthly('SPOTIFY', 1_099, ['05', '06', '07']), entry('2026-08-12', 'SPOTIFY 12/08', -1_199), entry('2026-09-12', 'SPOTIFY 12/09', -1_199)];
    const [spotify] = detectRecurring(list, [], TODAY);
    expect([spotify.frequency, spotify.lastAmountCents]).toEqual(['mensuel', 1_199]);
  });

  it('des courses au montant variable ne sont pas un abonnement', () => {
    const list = ['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22', '2026-09-29'].map((d, i) => entry(d, 'LIDL', -[3_000, 8_500, 4_200, 12_000, 2_500][i]));
    expect(detectRecurring(list, [], TODAY)).toEqual([]);
  });

  it('annuel, trimestriel, hebdomadaire ; ramené au mois', () => {
    const list = [
      entry('2024-10-02', 'ASSURANCE HABITATION', -18_000),
      entry('2025-10-01', 'ASSURANCE HABITATION', -18_600),
      ...['2026-01-05', '2026-04-05', '2026-07-05'].map((d) => entry(d, 'Eau trimestre', -9_000)),
      ...['2026-09-02', '2026-09-09', '2026-09-16', '2026-09-23', '2026-09-30'].map((d) => entry(d, 'Panier AMAP', -2_000)),
    ];
    const found = detectRecurring(list, [], TODAY);
    const by = (label: string) => found.find((f) => f.label.startsWith(label))!;
    expect(by('ASSURANCE').frequency).toBe('annuel');
    expect(by('ASSURANCE').monthlyCents).toBe(1_525);
    expect(by('Eau').frequency).toBe('trimestriel');
    expect(by('Eau').monthlyCents).toBe(3_000);
    expect(by('Panier').frequency).toBe('hebdomadaire');
    expect(by('Panier').monthlyCents).toBe(8_667);
  });

  it('un abonnement arrêté n’est plus actif, et ne compte plus dans le total', () => {
    const list = [...monthly('CB NETFLIX', 1_399, ['03', '04', '05']), ...monthly('DEEZER', 999, ['07', '08', '09'])];
    const found = detectRecurring(list, [], TODAY);
    expect(found.map((f) => [f.key, f.active])).toEqual([
      ['deezer', true],
      ['cb netflix', false],
    ]);
    expect(recurringTotals(found)).toEqual({ monthlyCents: 999, yearlyCents: 11_988 });
  });

  it('ni les virements internes ni l’épargne, ni les entrées d’argent', () => {
    const categories = [{ id: 'epargne', kind: 'epargne' }, { id: 'virement', kind: 'transfert' }] as BudgetCategory[];
    const list = [
      ...monthly('VIR LIVRET A', 20_000, ['06', '07', '08']).map((e) => ({ ...e, categoryId: 'epargne' })),
      ...monthly('VIR COMPTE JOINT', 50_000, ['06', '07', '08']).map((e) => ({ ...e, categoryId: 'virement' })),
      ...monthly('SALAIRE', -200_000, ['06', '07', '08']),
    ];
    expect(detectRecurring(list, categories, TODAY)).toEqual([]);
  });
});
