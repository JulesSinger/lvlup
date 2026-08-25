import { describe, expect, it } from 'vitest';
import {
  computeEnvelopeBalanceCents,
  computeEnvelopesOverview,
  computeSavingsTimeline,
  computeSavingsTotalCents,
} from './envelopes';
import type { BudgetCategory, BudgetEntry, BudgetEnvelope, BudgetEnvelopeMove } from './types';

function category(patch: Partial<BudgetCategory>): BudgetCategory {
  return {
    id: 'cat-1',
    name: 'Épargne',
    emoji: '🏦',
    color: '#000000',
    kind: 'epargne',
    position: 0,
    ...patch,
  };
}

function entry(patch: Partial<BudgetEntry>): BudgetEntry {
  return {
    id: 'e-1',
    day: '2026-07-04',
    label: 'Test',
    amountCents: -1000,
    categoryId: null,
    source: 'manuelle',
    importKey: null,
    note: '',
    createdAt: '2026-07-04T00:00:00.000Z',
    ...patch,
  };
}

function envelope(patch: Partial<BudgetEnvelope>): BudgetEnvelope {
  return { id: 'env-1', name: 'Voiture', emoji: '🚗', color: '#000000', position: 0, ...patch };
}

function move(patch: Partial<BudgetEnvelopeMove>): BudgetEnvelopeMove {
  return {
    id: 'm-1',
    envelopeId: 'env-1',
    amountCents: 1000,
    day: '2026-07-04',
    note: '',
    createdAt: '2026-07-04T00:00:00.000Z',
    ...patch,
  };
}

describe('computeSavingsTotalCents', () => {
  it('un virement vers l’épargne (sortie du compte courant) fait monter le total', () => {
    const epargne = category({ id: 'c1' });
    const e = entry({ categoryId: 'c1', amountCents: -50000 });
    expect(computeSavingsTotalCents([e], [epargne])).toBe(50000);
  });

  it('un retrait de l’épargne (entrée sur le compte courant) fait baisser le total (etude-astra-epargne.md §3)', () => {
    const epargne = category({ id: 'c1' });
    const depot = entry({ id: 'e1', categoryId: 'c1', amountCents: -50000 });
    const retrait = entry({ id: 'e2', categoryId: 'c1', amountCents: 20000 });
    expect(computeSavingsTotalCents([depot, retrait], [epargne])).toBe(30000);
  });

  it('les écritures d’autres catégories, transfert compris, ne comptent pas', () => {
    const epargne = category({ id: 'c1', kind: 'epargne' });
    const transfert = category({ id: 'c2', kind: 'transfert', name: 'Virements internes' });
    const depense = entry({ id: 'e1', categoryId: null, amountCents: -3000 });
    const viaTransfert = entry({ id: 'e2', categoryId: 'c2', amountCents: -9000 });
    const viaEpargne = entry({ id: 'e3', categoryId: 'c1', amountCents: -1000 });
    expect(computeSavingsTotalCents([depense, viaTransfert, viaEpargne], [epargne, transfert])).toBe(1000);
  });

  it('aucune écriture épargne rend un total nul', () => {
    expect(computeSavingsTotalCents([], [])).toBe(0);
  });
});

describe('computeEnvelopeBalanceCents', () => {
  it('somme les mouvements d’une enveloppe, jamais stocké (§4.3)', () => {
    const m1 = move({ id: 'm1', amountCents: 100000 });
    const m2 = move({ id: 'm2', amountCents: -8000 });
    expect(computeEnvelopeBalanceCents('env-1', [m1, m2])).toBe(92000);
  });

  it('ignore les mouvements d’une autre enveloppe', () => {
    const mine = move({ id: 'm1', envelopeId: 'env-1', amountCents: 5000 });
    const autre = move({ id: 'm2', envelopeId: 'env-2', amountCents: 9000 });
    expect(computeEnvelopeBalanceCents('env-1', [mine, autre])).toBe(5000);
  });
});

describe('computeEnvelopesOverview', () => {
  it('le non-affecté est le total moins la somme de tous les mouvements', () => {
    const epargne = category({ id: 'c1' });
    const depot = entry({ categoryId: 'c1', amountCents: -140000 });
    const voiture = envelope({ id: 'env-1', name: 'Voiture', position: 0 });
    const vacances = envelope({ id: 'env-2', name: 'Vacances', position: 1 });
    const moves = [
      move({ id: 'm1', envelopeId: 'env-1', amountCents: 100000 }),
      move({ id: 'm2', envelopeId: 'env-2', amountCents: 10000 }),
    ];
    const overview = computeEnvelopesOverview([depot], [epargne], [voiture, vacances], moves);
    expect(overview.totalCents).toBe(140000);
    expect(overview.balances).toEqual([
      { envelope: voiture, balanceCents: 100000 },
      { envelope: vacances, balanceCents: 10000 },
    ]);
    expect(overview.unallocatedCents).toBe(30000);
  });

  it('le non-affecté peut être négatif — montré tel quel, jamais bloqué', () => {
    const epargne = category({ id: 'c1' });
    const depot = entry({ categoryId: 'c1', amountCents: -10000 });
    const voiture = envelope({ id: 'env-1' });
    const moves = [move({ envelopeId: 'env-1', amountCents: 15000 })];
    const overview = computeEnvelopesOverview([depot], [epargne], [voiture], moves);
    expect(overview.unallocatedCents).toBe(-5000);
  });

  it('les enveloppes sont triées par position', () => {
    const b = envelope({ id: 'env-b', name: 'B', position: 1 });
    const a = envelope({ id: 'env-a', name: 'A', position: 0 });
    const overview = computeEnvelopesOverview([], [], [b, a], []);
    expect(overview.balances.map((x) => x.envelope.name)).toEqual(['A', 'B']);
  });

  it('sans enveloppe, tout le total reste non affecté', () => {
    const epargne = category({ id: 'c1' });
    const depot = entry({ categoryId: 'c1', amountCents: -25000 });
    const overview = computeEnvelopesOverview([depot], [epargne], [], []);
    expect(overview.balances).toEqual([]);
    expect(overview.unallocatedCents).toBe(25000);
  });
});

describe('computeSavingsTimeline', () => {
  it('cumule les écritures épargne dans l’ordre chronologique', () => {
    const epargne = category({ id: 'c1' });
    const juin = entry({ id: 'e1', day: '2026-06-10', categoryId: 'c1', amountCents: -50000 });
    const juillet = entry({ id: 'e2', day: '2026-07-05', categoryId: 'c1', amountCents: -20000 });
    expect(computeSavingsTimeline([juillet, juin], [epargne])).toEqual([
      { day: '2026-06-10', changeCents: 50000, totalCents: 50000 },
      { day: '2026-07-05', changeCents: 20000, totalCents: 70000 },
    ]);
  });

  it('un retrait fait redescendre la courbe (etude-astra-epargne.md §3)', () => {
    const epargne = category({ id: 'c1' });
    const depot = entry({ id: 'e1', day: '2026-06-10', categoryId: 'c1', amountCents: -50000 });
    const retrait = entry({ id: 'e2', day: '2026-07-05', categoryId: 'c1', amountCents: 15000 });
    const timeline = computeSavingsTimeline([depot, retrait], [epargne]);
    expect(timeline[1]).toEqual({ day: '2026-07-05', changeCents: -15000, totalCents: 35000 });
  });

  it('plusieurs écritures le même jour se cumulent en un seul point', () => {
    const epargne = category({ id: 'c1' });
    const a = entry({ id: 'e1', day: '2026-07-05', categoryId: 'c1', amountCents: -1000 });
    const b = entry({ id: 'e2', day: '2026-07-05', categoryId: 'c1', amountCents: -2000 });
    expect(computeSavingsTimeline([a, b], [epargne])).toEqual([
      { day: '2026-07-05', changeCents: 3000, totalCents: 3000 },
    ]);
  });

  it('les écritures hors épargne ne créent pas de point', () => {
    const epargne = category({ id: 'c1', kind: 'epargne' });
    const depense = entry({ id: 'e1', day: '2026-07-05', categoryId: null, amountCents: -3000 });
    expect(computeSavingsTimeline([depense], [epargne])).toEqual([]);
  });

  it('sans écriture, la courbe est vide', () => {
    expect(computeSavingsTimeline([], [])).toEqual([]);
  });
});
