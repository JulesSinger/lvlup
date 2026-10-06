/**
 * L'argent d'un projet (docs/etude-projets.md §3.8) — bibliothèque pure.
 *
 * Rien n'est stocké en double : encaissé, reste et retards se calculent
 * depuis les paiements. Le prix est ce qui a été convenu ; s'il diffère de
 * la somme des paiements prévus, l'écart se dit en clair plutôt que d'être
 * corrigé en silence.
 */
import { defaultSchedule } from './schedule';
import { isClosed } from './status';
import { PAYMENT_LABEL_MAX, type Payment, type PaymentInput, type PaymentMethod, type Project } from './types';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  virement: 'Virement',
  carte: 'Carte',
  cheque: 'Chèque',
  especes: 'Espèces',
  autre: 'Autre',
};

const received = (p: Payment) => p.receivedDay !== null;

/** Un paiement attendu dont la date est passée sans qu'il soit reçu. */
export function isPaymentLate(p: Payment, today: string): boolean {
  return !received(p) && p.expectedDay !== null && p.expectedDay < today;
}

export interface MoneySummary {
  /** Le prix convenu, `null` s'il n'est pas fixé. */
  priceCents: number | null;
  /** La somme des paiements prévus. */
  plannedCents: number;
  receivedCents: number;
  /** Ce qui reste à encaisser : le prix (ou à défaut les paiements prévus) moins le reçu, jamais négatif. */
  remainingCents: number;
  /** Prix moins paiements prévus : positif, il manque des paiements ; négatif, ils dépassent le prix. */
  unplannedCents: number;
  late: Payment[];
}

export function moneySummary(project: Project, payments: readonly Payment[], today: string): MoneySummary {
  const own = payments.filter((p) => p.projectId === project.id);
  const plannedCents = own.reduce((sum, p) => sum + p.amountCents, 0);
  const receivedCents = own.filter(received).reduce((sum, p) => sum + p.amountCents, 0);
  const target = project.priceCents ?? plannedCents;
  return {
    priceCents: project.priceCents,
    plannedCents,
    receivedCents,
    remainingCents: Math.max(0, target - receivedCents),
    unplannedCents: project.priceCents === null ? 0 : project.priceCents - plannedCents,
    late: own.filter((p) => isPaymentLate(p, today)).sort((a, b) => (a.expectedDay ?? '').localeCompare(b.expectedDay ?? '')),
  };
}

/**
 * L'échéancier 30 / 70 en paiements à créer : l'acompte attendu au début
 * du projet (ou aujourd'hui), le solde à la mise en ligne prévue.
 */
export function schedulePayments(project: Project, today: string): PaymentInput[] {
  return defaultSchedule(project.priceCents).map((p, position) => ({
    projectId: project.id,
    label: p.label,
    amountCents: p.amountCents,
    expectedDay: p.due === 'signature' ? (project.startDay ?? today) : project.dueDay,
    position,
  }));
}

/** La référence d'un paiement envoyé à Budget : stable, préfixée par le module. */
export const budgetRef = (p: Payment) => `projets:paiement:${p.number}`;

/** La catégorie demandée à Budget ; inconnue de lui, l'entrée y sera « à classer ». */
export const BUDGET_CATEGORY = 'Revenus freelance';

export interface MoneyOverview {
  receivedThisMonthCents: number;
  receivedThisYearCents: number;
  /** Ce qui reste à encaisser sur les projets qui ne sont ni terminés ni perdus. */
  outstandingCents: number;
  late: { payment: Payment; project: Project }[];
}

/** L'argent tous projets confondus, pour le tableau de bord. */
export function moneyOverview(projects: readonly Project[], payments: readonly Payment[], today: string): MoneyOverview {
  const month = today.slice(0, 7);
  const year = today.slice(0, 4);
  const byId = new Map(projects.map((p) => [p.id, p]));
  let receivedThisMonthCents = 0;
  let receivedThisYearCents = 0;
  for (const p of payments) {
    if (!p.receivedDay || !byId.has(p.projectId)) continue;
    if (p.receivedDay.startsWith(year)) receivedThisYearCents += p.amountCents;
    if (p.receivedDay.startsWith(month)) receivedThisMonthCents += p.amountCents;
  }
  const open = projects.filter((p) => !isClosed(p.status));
  const outstandingCents = open.reduce((sum, project) => sum + moneySummary(project, payments, today).remainingCents, 0);
  const late = payments
    .filter((p) => isPaymentLate(p, today) && byId.has(p.projectId) && !isClosed(byId.get(p.projectId)!.status))
    .map((payment) => ({ payment, project: byId.get(payment.projectId)! }))
    .sort((a, b) => (a.payment.expectedDay ?? '').localeCompare(b.payment.expectedDay ?? ''));
  return { receivedThisMonthCents, receivedThisYearCents, outstandingCents, late };
}

export function validatePayment(input: { label: string; amountCents: number | null | undefined }): string | null {
  const label = input.label.trim();
  if (!label) return 'Donne un nom au paiement (« Acompte », « Solde »…).';
  if (label.length > PAYMENT_LABEL_MAX) return `Le nom est trop long (${PAYMENT_LABEL_MAX} caractères au plus).`;
  if (input.amountCents === undefined) return 'Le montant doit être un nombre positif, par exemple 270 ou 1 250,50.';
  if (input.amountCents === null || input.amountCents <= 0) return 'Indique le montant.';
  return null;
}
