import { centsToInputValue } from './amount';
import type { BudgetCategory, BudgetEntry, BudgetEnvelope, BudgetEnvelopeMove, BudgetEnvelopeMoveInput } from './types';

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

/** Un point de la courbe : le total mis de côté cumulé à la fin de ce jour-là. */
export interface SavingsPoint {
  day: string;
  /** Variation de ce jour, signée — plusieurs écritures le même jour se cumulent en un seul point. */
  changeCents: number;
  totalCents: number;
}

/**
 * L'évolution du total mis de côté dans le temps : un point par jour où au
 * moins une écriture `epargne` a été enregistrée, cumulés dans l'ordre
 * chronologique — même construction que `ppTimeline` côté Zénith
 * (`modules/objectifs/lib/progress.ts`), mais propre à Astra : un module
 * n'importe jamais depuis un autre (`conventions.test.ts`).
 */
export function computeSavingsTimeline(entries: BudgetEntry[], categories: BudgetCategory[]): SavingsPoint[] {
  const epargneIds = new Set(categories.filter((c) => c.kind === 'epargne').map((c) => c.id));
  const perDay = new Map<string, number>();
  for (const entry of entries) {
    if (entry.categoryId === null || !epargneIds.has(entry.categoryId)) continue;
    perDay.set(entry.day, (perDay.get(entry.day) ?? 0) - entry.amountCents);
  }
  let running = 0;
  return [...perDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, changeCents]) => {
      running += changeCents;
      return { day, changeCents, totalCents: running };
    });
}

/**
 * Un retrait ne peut pas dépasser le solde de l'enveloppe : il la ferait
 * passer sous zéro, ce qui ne veut rien dire (on ne réserve pas une somme
 * négative). Rend le message à afficher, ou `null`. Une affectation, elle,
 * n'a pas de plafond ici : le non-affecté négatif a déjà son alerte.
 */
export function withdrawalProblem(amountCents: number, balanceCents: number): string | null {
  if (amountCents <= balanceCents) return null;
  const euros = centsToInputValue(balanceCents);
  return balanceCents <= 0
    ? 'Cette enveloppe est vide : il n’y a rien à retirer.'
    : `Cette enveloppe ne contient que ${euros} € : tu ne peux pas en retirer plus.`;
}

/** Le retrait qui paie une dépense, s'il y en a un. */
export function linkedMove(moves: readonly BudgetEnvelopeMove[], entryId: string): BudgetEnvelopeMove | null {
  return moves.find((m) => m.entryId === entryId) ?? null;
}

/**
 * Ce qu'une enveloppe peut payer pour une dépense : son solde, sans compter
 * le retrait que cette même dépense y a déjà fait (le modifier ne doit pas
 * se compter deux fois).
 */
export function availableForEntry(envelopeId: string, moves: readonly BudgetEnvelopeMove[], entryId: string | null): number {
  return computeEnvelopeBalanceCents(
    envelopeId,
    moves.filter((m) => entryId === null || m.entryId !== entryId),
  );
}

export interface LinkPlan {
  /** Le retrait à retirer d'abord, s'il y a lieu. */
  remove: string | null;
  /** Le retrait à créer ensuite, s'il y a lieu. */
  create: BudgetEnvelopeMoveInput | null;
}

/**
 * Payer une dépense avec une enveloppe (docs/etude-astra-epargne.md §6 bis) :
 * le retrait suit la dépense — son montant, son jour. Changer d'enveloppe,
 * de montant ou de jour remplace le retrait ; n'en choisir aucune le retire ;
 * rien de changé, rien à écrire. Une entrée d'argent n'est jamais payée par
 * une enveloppe.
 */
export function linkPlan(
  existing: BudgetEnvelopeMove | null,
  envelopeId: string | null,
  entry: { id: string; amountCents: number; day: string; label: string },
): LinkPlan {
  const wanted =
    envelopeId && entry.amountCents < 0
      ? { envelopeId, amountCents: entry.amountCents, day: entry.day, note: `Payé : ${entry.label}`, entryId: entry.id }
      : null;
  if (existing && wanted && existing.envelopeId === wanted.envelopeId && existing.amountCents === wanted.amountCents && existing.day === wanted.day) {
    return { remove: null, create: null };
  }
  return { remove: existing?.id ?? null, create: wanted };
}
