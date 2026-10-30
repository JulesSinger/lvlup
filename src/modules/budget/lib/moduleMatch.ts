/**
 * Reconnaître, à l'import du relevé, un paiement déjà enregistré par un
 * autre module — bibliothèque pure (docs/etude-astra.md §16).
 *
 * Une course terminée (Courses, depuis l'app ou depuis un ticket donné à
 * Claude) crée sa dépense dans Budget le jour même ; le relevé bancaire
 * apporte ensuite le même paiement. Sans ce rapprochement, il comptait deux
 * fois (assumé le 26/09/2026, corrigé le 11/10/2026 à la demande de Jules).
 * Vaut aussi pour un paiement reçu d'un client de Projets.
 *
 * Une ligne du relevé est la même opération qu'une écriture d'un module si
 * elle a **le même montant au centime** et tombe **de deux jours avant à cinq
 * jours après** le jour noté (un paiement par carte apparaît un à trois jours
 * plus tard ; un virement reçu peut être noté le jour où on l'apprend). Une
 * écriture ne sert qu'une fois ; à plusieurs candidates, la plus proche en
 * date l'emporte.
 */
import type { BudgetEntry } from './types';

export const MATCH_DAYS_BEFORE = 2;
export const MATCH_DAYS_AFTER = 5;

/** Une écriture venue d'un module : sa référence est « module:chose:numéro », jamais une empreinte bancaire. */
export const isModuleEntry = (e: Pick<BudgetEntry, 'importKey'>) => e.importKey !== null && /^[a-z]+:[a-z]+:/.test(e.importKey);

const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / 86_400_000;

export interface ModuleMatch {
  /** L'empreinte de la ligne du relevé. */
  importKey: string;
  entry: BudgetEntry;
}

export function matchModuleEntries(
  rows: readonly { importKey: string; day: string; amountCents: number }[],
  entries: readonly BudgetEntry[],
): Map<string, ModuleMatch> {
  // Seulement les écritures du compte principal, celui du relevé : une course
  // payée avec la carte Pluxee (docs/etude-astra.md §17) n'est jamais sur le
  // relevé bancaire, elle ne doit pas en avaler une ligne du même montant.
  const candidates = entries.filter((e) => isModuleEntry(e) && (e.accountId ?? null) === null);
  const used = new Set<string>();
  const matches = new Map<string, ModuleMatch>();
  for (const row of [...rows].sort((a, b) => a.day.localeCompare(b.day))) {
    let best: { entry: BudgetEntry; gap: number } | null = null;
    for (const entry of candidates) {
      if (used.has(entry.id) || entry.amountCents !== row.amountCents) continue;
      const delta = dayNumber(row.day) - dayNumber(entry.day);
      if (delta < -MATCH_DAYS_BEFORE || delta > MATCH_DAYS_AFTER) continue;
      if (!best || Math.abs(delta) < best.gap) best = { entry, gap: Math.abs(delta) };
    }
    if (best) {
      used.add(best.entry.id);
      matches.set(row.importKey, { importKey: row.importKey, entry: best.entry });
    }
  }
  return matches;
}
