/**
 * Le carnet des libellés — bibliothèque pure (docs/etude-astra.md §18).
 *
 * Une fiche (une `BudgetRule` qui a un nom ou une description) dit ce que cache
 * un libellé de banque : « COMPTOIR DE STA » = « Buvette ASNL ». On l'écrit une
 * fois ; ensuite chaque écriture dont le libellé contient le motif la montre,
 * passée comme à venir, et la recherche la trouve par le nom.
 *
 * Le libellé comparé est celui qu'on voit (rangé dans l'écriture), sans accents
 * ni casse — comme `unclassifiedMatching`. À l'import, le classement compare,
 * lui, le libellé brut de la banque (`matchRule`).
 */
import { validateRulePattern } from './classify';
import type { BudgetRule } from './types';
import { RULE_DESCRIPTION_MAX, RULE_LABEL_MAX } from './types';

const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Une règle qui a quelque chose à dire. */
export const isFiche = (rule: Pick<BudgetRule, 'label' | 'description'>) => rule.label.trim() !== '' || rule.description.trim() !== '';

/**
 * La fiche d'un libellé : parmi celles dont le motif y apparaît, la plus
 * prioritaire, puis la plus précise (le motif le plus long).
 */
export function knownFor(label: string, rules: readonly BudgetRule[]): BudgetRule | null {
  const haystack = fold(label);
  let best: BudgetRule | null = null;
  for (const rule of rules) {
    const pattern = fold(rule.pattern);
    if (!isFiche(rule) || pattern.length === 0 || !haystack.includes(pattern)) continue;
    if (!best || rule.priority > best.priority || (rule.priority === best.priority && pattern.length > fold(best.pattern).length)) best = rule;
  }
  return best;
}

/** La règle déjà là pour ce motif (même motif, sans casse) : une fiche s'y ajoute plutôt que d'en créer une seconde. */
export function ruleWithPattern(pattern: string, rules: readonly BudgetRule[]): BudgetRule | null {
  const p = fold(pattern);
  return rules.find((r) => fold(r.pattern) === p) ?? null;
}

/** Ce qui ne va pas dans une fiche, ou `null`. Une règle sans nom ni description doit au moins ranger. */
export function ficheProblem(
  input: { pattern: string; label: string; description: string; categoryId: string | null },
  rules: readonly BudgetRule[],
  selfId?: string,
): string | null {
  const patternProblem = validateRulePattern(input.pattern, rules, selfId);
  if (patternProblem) return patternProblem;
  if (input.label.trim().length > RULE_LABEL_MAX) return `Le nom est trop long (${RULE_LABEL_MAX} caractères au plus).`;
  if (input.description.trim().length > RULE_DESCRIPTION_MAX) return `La description est trop longue (${RULE_DESCRIPTION_MAX} caractères au plus).`;
  if (!input.label.trim() && !input.description.trim() && !input.categoryId) {
    return 'Donne un nom, une description ou une catégorie : sinon la fiche ne dit rien.';
  }
  return null;
}
