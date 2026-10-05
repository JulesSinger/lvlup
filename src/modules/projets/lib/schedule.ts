/**
 * L'échéancier proposé à la création d'un projet — bibliothèque pure
 * (docs/etude-projets.md §3.8, §12).
 *
 * « 30 / 70 », décision de Jules (05/10/2026) : un acompte de 30 % à la
 * signature, le solde à la livraison. Proposé, jamais imposé : les deux
 * paiements restent modifiables (étape 5).
 */

export const DEPOSIT_RATE = 0.3;

export interface PlannedPayment {
  label: string;
  amountCents: number;
  /** Quand il est attendu : à la signature, ou à la livraison. */
  due: 'signature' | 'delivery';
}

/**
 * L'acompte est arrondi au centime, et le solde est ce qui reste : la somme
 * des deux vaut toujours le prix, au centime près. Sans prix, rien à proposer.
 */
export function defaultSchedule(priceCents: number | null): PlannedPayment[] {
  if (priceCents === null || priceCents <= 0) return [];
  const deposit = Math.round(priceCents * DEPOSIT_RATE);
  return [
    { label: 'Acompte 30 %', amountCents: deposit, due: 'signature' },
    { label: 'Solde', amountCents: priceCents - deposit, due: 'delivery' },
  ];
}
