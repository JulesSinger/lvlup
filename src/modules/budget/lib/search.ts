/**
 * Chercher dans toutes les écritures, tous mois confondus — bibliothèque pure.
 *
 * « Combien chez Amazon cette année ? » : l'écran du mois n'y répondait pas,
 * il ne montre qu'un mois à la fois.
 */
import type { BudgetCategory, BudgetEntry } from './types';

/** Minuscules, sans accents, espaces resserrés : « Électricité » trouve « electricite ». */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** « 12,50 », « 12.5 », « 12 » → centimes ; autre chose → `null`. */
function amountQuery(word: string): number | null {
  const m = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(word);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
}

/**
 * Les écritures dont le libellé, la note ou la catégorie contiennent TOUS les
 * mots cherchés ; un mot qui est un montant (« 12,50 ») trouve aussi les
 * écritures de ce montant, au signe près. Les plus récentes d'abord.
 */
export function searchEntries(entries: readonly BudgetEntry[], categories: readonly BudgetCategory[], query: string): BudgetEntry[] {
  const words = fold(query).split(' ').filter(Boolean);
  if (words.length === 0) return [];
  const name = new Map(categories.map((c) => [c.id, fold(c.name)]));
  return entries
    .filter((e) => {
      const haystack = `${fold(e.label)} ${fold(e.note)} ${e.categoryId ? (name.get(e.categoryId) ?? '') : 'a classer'}`;
      return words.every((w) => haystack.includes(w) || amountQuery(w) === Math.abs(e.amountCents));
    })
    .sort((a, b) => b.day.localeCompare(a.day) || b.createdAt.localeCompare(a.createdAt));
}

export interface SearchSummary {
  count: number;
  /** Ce qui est sorti, en positif. */
  spentCents: number;
  receivedCents: number;
  firstDay: string | null;
  lastDay: string | null;
}

export function summarize(entries: readonly BudgetEntry[]): SearchSummary {
  let spentCents = 0;
  let receivedCents = 0;
  for (const e of entries) {
    if (e.amountCents < 0) spentCents -= e.amountCents;
    else receivedCents += e.amountCents;
  }
  const days = entries.map((e) => e.day).sort();
  return { count: entries.length, spentCents, receivedCents, firstDay: days[0] ?? null, lastDay: days[days.length - 1] ?? null };
}
