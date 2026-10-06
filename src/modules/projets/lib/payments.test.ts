import { describe, expect, it } from 'vitest';
import { budgetRef, isPaymentLate, moneyOverview, moneySummary, schedulePayments, validatePayment } from './payments';
import type { Payment, Project } from './types';

const TODAY = '2026-10-06';

function project(id: string, over: Partial<Project> = {}): Project {
  return {
    id,
    clientId: 'c',
    number: 1,
    title: id,
    template: '',
    status: 'production',
    waitingFor: null,
    waitingSince: null,
    startDay: null,
    dueDay: null,
    priceCents: 90_000,
    needs: {},
    design: {},
    note: '',
    createdAt: '',
    updatedAt: '',
    ...over,
  };
}

let seq = 0;
function payment(projectId: string, amountCents: number, over: Partial<Payment> = {}): Payment {
  seq += 1;
  return { id: `pay-${seq}`, projectId, number: seq, label: 'Paiement', amountCents, expectedDay: null, receivedDay: null, method: null, invoiceRef: '', position: 0, createdAt: '', ...over };
}

describe('l’argent d’un projet', () => {
  it('encaissé, reste, et les paiements en retard', () => {
    const lou = project('lou');
    const payments = [
      payment('lou', 27_000, { receivedDay: '2026-09-12', method: 'virement' }),
      payment('lou', 63_000, { expectedDay: '2026-10-01' }),
      payment('autre', 5_000, { receivedDay: '2026-09-01' }),
    ];
    const s = moneySummary(lou, payments, TODAY);
    expect(s).toMatchObject({ priceCents: 90_000, plannedCents: 90_000, receivedCents: 27_000, remainingCents: 63_000, unplannedCents: 0 });
    expect(s.late.map((p) => p.amountCents)).toEqual([63_000]);
  });

  it('l’écart entre le prix et les paiements prévus se dit, le reste ne passe jamais sous zéro', () => {
    const lou = project('lou', { priceCents: 100_000 });
    expect(moneySummary(lou, [payment('lou', 30_000)], TODAY).unplannedCents).toBe(70_000);
    const over = moneySummary(project('lou', { priceCents: 20_000 }), [payment('lou', 30_000, { receivedDay: TODAY })], TODAY);
    expect(over.remainingCents).toBe(0);
    expect(over.unplannedCents).toBe(-10_000);
  });

  it('sans prix, le reste se calcule sur les paiements prévus', () => {
    expect(moneySummary(project('lou', { priceCents: null }), [payment('lou', 40_000)], TODAY).remainingCents).toBe(40_000);
  });

  it('en retard : attendu avant aujourd’hui, pas reçu', () => {
    expect(isPaymentLate(payment('x', 1, { expectedDay: '2026-10-05' }), TODAY)).toBe(true);
    expect(isPaymentLate(payment('x', 1, { expectedDay: TODAY }), TODAY)).toBe(false);
    expect(isPaymentLate(payment('x', 1, { expectedDay: '2026-10-05', receivedDay: TODAY }), TODAY)).toBe(false);
  });
});

describe('l’échéancier 30 / 70 en paiements', () => {
  it('l’acompte au début (ou aujourd’hui), le solde à la mise en ligne', () => {
    expect(schedulePayments(project('lou', { dueDay: '2026-11-15' }), TODAY)).toEqual([
      { projectId: 'lou', label: 'Acompte 30 %', amountCents: 27_000, expectedDay: TODAY, position: 0 },
      { projectId: 'lou', label: 'Solde', amountCents: 63_000, expectedDay: '2026-11-15', position: 1 },
    ]);
    expect(schedulePayments(project('lou', { startDay: '2026-10-10' }), TODAY)[0].expectedDay).toBe('2026-10-10');
    expect(schedulePayments(project('lou', { priceCents: null }), TODAY)).toEqual([]);
  });
});

describe('l’argent tous projets confondus', () => {
  it('ce mois, cette année, le reste des projets ouverts, les retards', () => {
    const projects = [project('lou'), project('clos', { status: 'done' })];
    const payments = [
      payment('lou', 27_000, { receivedDay: '2026-10-02' }),
      payment('lou', 10_000, { receivedDay: '2026-03-02' }),
      payment('lou', 53_000, { expectedDay: '2026-10-01' }),
      payment('clos', 90_000, { receivedDay: '2025-12-20' }),
      payment('clos', 5_000, { expectedDay: '2026-01-01' }),
    ];
    const o = moneyOverview(projects, payments, TODAY);
    expect(o.receivedThisMonthCents).toBe(27_000);
    expect(o.receivedThisYearCents).toBe(37_000);
    expect(o.outstandingCents).toBe(53_000);
    expect(o.late.map((l) => l.project.id)).toEqual(['lou']);
  });
});

describe('les paiements', () => {
  it('une référence stable vers Budget', () => {
    expect(budgetRef(payment('x', 1, { number: 12 }))).toBe('projets:paiement:12');
  });

  it('un nom et un montant positif', () => {
    expect(validatePayment({ label: 'Solde', amountCents: 63_000 })).toBeNull();
    expect(validatePayment({ label: '', amountCents: 1 })).toMatch(/nom/);
    expect(validatePayment({ label: 'Solde', amountCents: undefined })).toMatch(/nombre positif/);
    expect(validatePayment({ label: 'Solde', amountCents: null })).toMatch(/montant/);
  });
});
