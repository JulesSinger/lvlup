/**
 * Classer vite : les écritures « à classer » regroupées par libellé, et les
 * règles qui rangent les relevés suivants — bibliothèque pure.
 */
import { fold } from './search';
import type { BudgetEntry, BudgetRule } from './types';

/**
 * La clé d'un libellé, pour reconnaître le même commerçant d'un mois à
 * l'autre : sans accents ni casse, sans chiffres (dates, numéros de carte,
 * références) ni ponctuation. « CB AMAZON 12/09 » et « Amazon » se
 * rejoignent… quand le reste du libellé le permet.
 */
export function labelKey(label: string): string {
  return fold(label)
    .replace(/[0-9]/g, ' ')
    .replace(/[^a-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface UnclassifiedGroup {
  key: string;
  /** Le libellé le plus fréquent du groupe, tel qu'écrit. */
  label: string;
  entries: BudgetEntry[];
  /** La somme, signée (une dépense est négative). */
  totalCents: number;
}

/**
 * Les « à classer », tous mois confondus, regroupés par libellé : classer un
 * groupe range d'un coup toutes ses écritures. Les groupes les plus fournis
 * d'abord, puis les plus gros montants.
 */
export function unclassifiedGroups(entries: readonly BudgetEntry[]): UnclassifiedGroup[] {
  const groups = new Map<string, BudgetEntry[]>();
  for (const e of entries) {
    if (e.categoryId !== null) continue;
    const key = labelKey(e.label) || fold(e.label) || '—';
    groups.set(key, [...(groups.get(key) ?? []), e]);
  }
  return [...groups.entries()]
    .map(([key, list]) => {
      const counts = new Map<string, number>();
      for (const e of list) counts.set(e.label, (counts.get(e.label) ?? 0) + 1);
      const label = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'fr'))[0][0];
      return { key, label, entries: list, totalCents: list.reduce((s, e) => s + e.amountCents, 0) };
    })
    .sort((a, b) => b.entries.length - a.entries.length || Math.abs(b.totalCents) - Math.abs(a.totalCents) || a.label.localeCompare(b.label, 'fr'));
}

/** Le motif d'une règle proposé pour un libellé : le libellé lui-même, sans ses chiffres. */
export function suggestedPattern(label: string): string {
  return label
    .replace(/[0-9][0-9/.:-]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Trois caractères au moins : un motif plus court rangerait n'importe quoi (« a », « cb »). */
export const RULE_PATTERN_MIN = 3;

export function validateRulePattern(pattern: string, rules: readonly BudgetRule[], selfId?: string): string | null {
  const p = pattern.trim();
  if (p.length < RULE_PATTERN_MIN) return `Un motif fait au moins ${RULE_PATTERN_MIN} caractères : plus court, il rangerait n’importe quoi.`;
  if (p.length > 200) return 'Le motif est trop long (200 caractères au plus).';
  if (rules.some((r) => r.id !== selfId && r.pattern.trim().toLowerCase() === p.toLowerCase())) return 'Une règle existe déjà pour ce motif.';
  return null;
}

/**
 * Les écritures « à classer » qu'une règle rangerait : celles dont le libellé
 * contient le motif. L'import compare le libellé BRUT de la banque ; ici on
 * n'a que le libellé affiché — d'où une recherche sans accents ni casse, et
 * une proposition à confirmer, jamais un classement silencieux.
 */
export function unclassifiedMatching(entries: readonly BudgetEntry[], pattern: string): BudgetEntry[] {
  const p = fold(pattern);
  if (p.length < RULE_PATTERN_MIN) return [];
  return entries.filter((e) => e.categoryId === null && fold(e.label).includes(p));
}
