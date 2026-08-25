import type { BudgetCategory, BudgetEntry, BudgetEnvelope, BudgetEnvelopeMove } from './types';

/**
 * Le total mis de côté (docs/etude-astra-epargne.md §3) : la somme, signe
 * inversé, de toutes les écritures catégorisées `epargne`, tous mois
 * confondus. Un virement vers l'épargne est une sortie du compte courant
 * (négatif) et fait donc monter le total ; un retrait de l'épargne est une
 * entrée sur le compte courant (positif) et le fait mécaniquement
 * descendre — les deux sont la même catégorie, seul le signe change,
 * exactement comme `amountCents` fonctionne déjà partout dans Astra.
 */
export function computeSavingsTotalCents(entries: BudgetEntry[], categories: BudgetCategory[]): number {
  const epargneIds = new Set(categories.filter((c) => c.kind === 'epargne').map((c) => c.id));
  let total = 0;
  for (const entry of entries) {
    if (entry.categoryId !== null && epargneIds.has(entry.categoryId)) {
      total -= entry.amountCents;
    }
  }
  return total;
}

/**
 * Le solde d'une enveloppe : la somme de ses mouvements, jamais stocké
 * (§4.3) — un solde recalculé ne peut pas diverger.
 */
export function computeEnvelopeBalanceCents(envelopeId: string, moves: BudgetEnvelopeMove[]): number {
  return moves
    .filter((m) => m.envelopeId === envelopeId)
    .reduce((sum, m) => sum + m.amountCents, 0);
}

export interface EnvelopeBalance {
  envelope: BudgetEnvelope;
  balanceCents: number;
}

export interface EnvelopesOverview {
  /** Toujours positif ou nul — voir `computeSavingsTotalCents`. */
  totalCents: number;
  balances: EnvelopeBalance[];
  /**
   * Total moins la somme de tous les mouvements — jamais stocké non plus.
   * L'invariant « la somme des enveloppes égale le total » tient par
   * construction : le non-affecté absorbe tout écart, y compris négatif si
   * on a affecté plus que ce qui est disponible (§4.3 — montré tel quel,
   * jamais bloqué, même philosophie que la part « à classer » du camembert).
   */
  unallocatedCents: number;
}

export function computeEnvelopesOverview(
  entries: BudgetEntry[],
  categories: BudgetCategory[],
  envelopes: BudgetEnvelope[],
  moves: BudgetEnvelopeMove[],
): EnvelopesOverview {
  const totalCents = computeSavingsTotalCents(entries, categories);
  const balances = envelopes
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((envelope) => ({ envelope, balanceCents: computeEnvelopeBalanceCents(envelope.id, moves) }));
  const allocatedCents = moves.reduce((sum, m) => sum + m.amountCents, 0);
  return { totalCents, balances, unallocatedCents: totalCents - allocatedCents };
}
