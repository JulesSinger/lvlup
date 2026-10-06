import { describe, expect, it } from 'vitest';
import type { Recurring } from './recurring';
import { addPeriods, draftFromRecurring, lastSeen, monthlyCost, nextOccurrence, plannedReminders, subscriptionsView, validateSubscription } from './subscriptions';
import type { BudgetEntry, BudgetSubscription } from './types';

const TODAY = '2026-10-07';
const NOW = new Date(2026, 9, 7, 8, 0);

const sub = (over: Partial<BudgetSubscription> = {}): BudgetSubscription => ({
  id: 's1',
  name: 'Netflix',
  amountCents: 1_399,
  frequency: 'mensuel',
  nextDay: '2026-10-12',
  categoryId: null,
  pattern: '',
  remindDays: null,
  createdAt: '',
  ...over,
});

let seq = 0;
const entry = (day: string, label: string, amountCents: number): BudgetEntry => ({
  id: `e${++seq}`,
  day,
  label,
  amountCents,
  categoryId: null,
  source: 'import',
  importKey: null,
  note: '',
  createdAt: '',
});

const recurring = (over: Partial<Recurring> = {}): Recurring => ({
  key: 'cb netflix',
  label: 'CB NETFLIX',
  frequency: 'mensuel',
  amountCents: 1_399,
  lastAmountCents: 1_399,
  monthlyCents: 1_399,
  count: 4,
  firstDay: '2026-06-12',
  lastDay: '2026-09-12',
  nextDay: '2026-10-12',
  active: true,
  categoryId: null,
  ...over,
});

describe('les échéances d’un abonnement', () => {
  it('au même jour du mois, le 31 ramené au dernier jour sans dériver ensuite', () => {
    expect(addPeriods('2026-01-31', 'mensuel', 1)).toBe('2026-02-28');
    expect(addPeriods('2026-01-31', 'mensuel', 2)).toBe('2026-03-31');
    expect(addPeriods('2026-11-15', 'trimestriel', 1)).toBe('2027-02-15');
    expect(addPeriods('2024-02-29', 'annuel', 1)).toBe('2025-02-28');
    expect(addPeriods('2026-10-01', 'hebdomadaire', 2)).toBe('2026-10-15');
  });

  it('la prochaine, à partir d’une échéance passée ; aujourd’hui compris', () => {
    expect(nextOccurrence('2026-01-12', 'mensuel', TODAY)).toBe('2026-10-12');
    expect(nextOccurrence('2026-10-07', 'mensuel', TODAY)).toBe('2026-10-07');
    expect(nextOccurrence('2025-03-01', 'annuel', TODAY)).toBe('2027-03-01');
    expect(nextOccurrence('2026-12-01', 'annuel', TODAY)).toBe('2026-12-01');
  });

  it('ramené au mois', () => {
    expect(monthlyCost(18_600, 'annuel')).toBe(1_550);
    expect(monthlyCost(2_000, 'hebdomadaire')).toBe(8_667);
  });
});

describe('déclarés et repérés, ensemble', () => {
  const entries = [entry('2026-09-12', 'CB NETFLIX 12/09', -1_399), entry('2026-08-12', 'CB NETFLIX 12/08', -1_399), entry('2026-02-03', 'SALLE DE SPORT', -2_990)];

  it('un abonnement déclaré avec un motif absorbe la dépense repérée, et dit quand il a été vu', () => {
    const view = subscriptionsView([sub({ pattern: 'netflix' })], [recurring(), recurring({ key: 'spotify', label: 'SPOTIFY' })], [], entries, TODAY);
    expect(view.detected.map((r) => r.key)).toEqual(['spotify']);
    expect(view.declared[0]).toMatchObject({ next: '2026-10-12', seen: { day: '2026-09-12', amountCents: 1_399, count: 2 }, stale: false });
  });

  it('jamais vu, ou plus vu depuis longtemps', () => {
    const view = subscriptionsView([sub({ id: 'a', name: 'Assurance', pattern: '' }), sub({ id: 'b', name: 'Salle', pattern: 'salle de sport' })], [], [], entries, TODAY);
    const byName = Object.fromEntries(view.declared.map((d) => [d.subscription.name, d]));
    expect(byName.Assurance.seen).toBeNull();
    expect(byName.Salle).toMatchObject({ stale: true, seen: { day: '2026-02-03' } });
  });

  it('le total : déclarés (sauf ceux qu’on ne voit plus) et repérés encore payés, sans les écartés', () => {
    const view = subscriptionsView(
      [sub({ amountCents: 18_600, frequency: 'annuel', name: 'Assurance' }), sub({ id: 'b', name: 'Salle', pattern: 'salle de sport', amountCents: 2_990 })],
      [recurring(), recurring({ key: 'loyer', label: 'LOYER', monthlyCents: 65_000 }), recurring({ key: 'deezer', active: false, monthlyCents: 999 })],
      [{ key: 'loyer', label: 'LOYER', createdAt: '' }],
      entries,
      TODAY,
    );
    expect(view.detected.map((r) => r.key)).toEqual(['cb netflix', 'deezer']);
    expect(view.monthlyCents).toBe(1_550 + 1_399);
    expect(view.yearlyCents).toBe((1_550 + 1_399) * 12);
  });

  it('un motif retrouve le dernier paiement, sans accents ni casse ; trop court, rien', () => {
    expect(lastSeen('Netflix', entries)?.count).toBe(2);
    expect(lastSeen('ne', entries)).toBeNull();
  });

  it('déclarer une dépense repérée : tout est déjà connu', () => {
    expect(draftFromRecurring(recurring({ nextDay: '2026-09-12', lastAmountCents: 1_599 }), TODAY)).toEqual({
      name: 'CB NETFLIX',
      amountCents: 1_599,
      frequency: 'mensuel',
      nextDay: '2026-10-12',
      categoryId: null,
      pattern: 'CB NETFLIX',
      remindDays: null,
    });
  });
});

describe('les rappels avant échéance', () => {
  it('tant de jours avant chaque échéance des soixante jours, à 9 h', () => {
    const r = plannedReminders([sub({ remindDays: 3 }), sub({ id: 'x', remindDays: null })], NOW, TODAY);
    expect(r.map((x) => [x.ref, x.fireAt])).toEqual([
      ['sub:s1:2026-10-12', new Date(2026, 9, 9, 9, 0).toISOString()],
      ['sub:s1:2026-11-12', new Date(2026, 10, 9, 9, 0).toISOString()],
    ]);
    expect(r[0]).toMatchObject({ title: '🔁 Netflix : prélèvement dans 3 jours', url: '/#/budget' });
    expect(r[0].body).toContain('13,99 € le 12/10');
  });

  it('un préavis déjà passé pour cette échéance vise la suivante ; une échéance lointaine attend', () => {
    expect(plannedReminders([sub({ remindDays: 7 })], NOW, TODAY).map((x) => x.ref)).toEqual(['sub:s1:2026-11-12', 'sub:s1:2026-12-12']);
    expect(plannedReminders([sub({ remindDays: 30, frequency: 'annuel', nextDay: '2027-06-01' })], NOW, TODAY)).toEqual([]);
  });
});

describe('valider un abonnement', () => {
  it('un nom, un montant positif, une échéance', () => {
    expect(validateSubscription({ name: 'Netflix', amountCents: 1_399, nextDay: TODAY })).toBeNull();
    expect(validateSubscription({ name: ' ', amountCents: 1, nextDay: TODAY })).toMatch(/nom/);
    expect(validateSubscription({ name: 'X', amountCents: undefined, nextDay: TODAY })).toMatch(/nombre positif/);
    expect(validateSubscription({ name: 'X', amountCents: 1, nextDay: '' })).toMatch(/échéance/);
  });
});
