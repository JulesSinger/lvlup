import { monthKeyOf } from './month';
import type { BudgetCategory, BudgetEntry } from './types';

/** Couleur neutre pour la part « À classer » — elle n'a pas de catégorie, donc pas de couleur choisie. */
const UNCATEGORIZED_COLOR = '#8a8f98';

export interface BudgetSlice {
  /** `null` = « À classer ». */
  categoryId: string | null;
  label: string;
  emoji: string;
  color: string;
  /** Montant dépensé pour cette part, positif (magnitude). */
  cents: number;
}

export interface MonthlyBreakdown {
  /** Somme des parts, en positif — ce qui a été dépensé ce mois-ci. */
  totalSpentCents: number;
  slices: BudgetSlice[];
  /** Somme des parts d'entrées, en positif — ce qui est rentré ce mois-ci. */
  totalIncomeCents: number;
  incomeSlices: BudgetSlice[];
}

/**
 * Le camembert du mois (docs/etude-astra.md §5).
 *
 * Deux règles explicites dans l'étude : `kind === 'transfert'` (et, depuis
 * docs/etude-astra-epargne.md §5, `kind === 'epargne'` pour la même raison)
 * est exclu du camembert (§2 et §6 — sans quoi épargner ressemblerait à
 * dépenser), et une écriture non catégorisée doit apparaître sous
 * « À classer » plutôt que disparaître du total (§2 — « si on la masquait,
 * le total afficherait moins que ce qui a réellement quitté le compte »).
 *
 * Une troisième règle n'est *pas* explicite dans le texte et relève d'une
 * interprétation assumée ici : seuls les groupes au net **négatif** sur le
 * mois deviennent une part. Un camembert de "constat" (§1) répond à la
 * question « où est parti l'argent » ; un groupe au net positif — une
 * catégorie `revenu` comme Salaire, ou une catégorie entièrement remboursée
 * ce mois-ci — n'y a pas sa place, sans qu'il faille pour autant écrire un
 * cas particulier sur `kind === 'revenu'` : le signe suffit, et il reflète
 * exactement le remboursement décrit en §6 (« la catégorie totalise alors
 * 40 € de moins »). Cette règle n'exclut jamais une écriture non catégorisée
 * *dépensée* : une entrée d'argent isolée sans catégorie (ex. un
 * remboursement d'ami) nette positif et disparaît du camembert, mais rien
 * qui a quitté le compte ne peut y disparaître, ce qui respecte la garantie
 * du §2 ci-dessus.
 *
 * Depuis la V1, un second camembert symétrique répond à « d'où vient
 * l'argent » : mêmes catégories exclues (transfert, epargne), mais les
 * groupes au net **positif** cette fois — le salaire, un remboursement qui
 * dépasse la dépense d'origine, ou une entrée isolée sans catégorie, qui
 * apparaît sous « À classer » plutôt que d'y disparaître, exactement comme
 * une dépense non catégorisée le fait côté dépenses.
 *
 * Une sous-catégorie (« Restaurants & bars » → « Restaurants ») ne fait
 * jamais sa propre part : sa dépense remonte dans la part de son parent
 * (`rollupKey`), pour ne pas faire exploser le nombre de parts au fil des
 * sous-catégories créées — voir docs/etude-astra.md §3 (« une quinzaine de
 * catégories, c'est le bon ordre de grandeur »). Le détail par
 * sous-catégorie, quand on veut le voir, est le rôle de
 * `subcategoryBreakdown` ci-dessous.
 */
function rollupKey(categoryId: string | null, categoryById: Map<string, BudgetCategory>): string {
  if (!categoryId) return '';
  const category = categoryById.get(categoryId);
  if (!category) return categoryId;
  return category.parentId ?? categoryId;
}

export function computeMonthlyBreakdown(
  entries: BudgetEntry[],
  categories: BudgetCategory[],
  monthKey: string,
): MonthlyBreakdown {
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const netByKey = new Map<string, number>();

  for (const entry of entries) {
    if (monthKeyOf(entry.day) !== monthKey) continue;
    const category = entry.categoryId ? categoryById.get(entry.categoryId) : undefined;
    if (category?.kind === 'transfert' || category?.kind === 'epargne') continue;
    const key = rollupKey(entry.categoryId, categoryById);
    netByKey.set(key, (netByKey.get(key) ?? 0) + entry.amountCents);
  }

  const slices: BudgetSlice[] = [];
  const incomeSlices: BudgetSlice[] = [];
  for (const [key, net] of netByKey) {
    if (net === 0) continue;
    const category = key ? categoryById.get(key) : undefined;
    const slice: BudgetSlice = {
      categoryId: key || null,
      label: category ? category.name : 'À classer',
      emoji: category ? category.emoji : '❔',
      color: category ? category.color : UNCATEGORIZED_COLOR,
      cents: Math.abs(net),
    };
    (net < 0 ? slices : incomeSlices).push(slice);
  }

  slices.sort((a, b) => b.cents - a.cents);
  incomeSlices.sort((a, b) => b.cents - a.cents);
  const totalSpentCents = slices.reduce((sum, s) => sum + s.cents, 0);
  const totalIncomeCents = incomeSlices.reduce((sum, s) => sum + s.cents, 0);
  return { totalSpentCents, slices, totalIncomeCents, incomeSlices };
}

export interface SubcategorySlice {
  /** `null` = écriture posée directement sur le parent, sans sous-catégorie précise. */
  categoryId: string | null;
  label: string;
  emoji: string;
  color: string;
  cents: number;
}

export interface SubcategoryBreakdown {
  slices: SubcategorySlice[];
  incomeSlices: SubcategorySlice[];
}

/**
 * Le détail d'une catégorie qui a des sous-catégories, pour le mois donné —
 * ce que sa part unique du camembert (voir `rollupKey` ci-dessus) ne montre
 * pas. Une écriture posée directement sur le parent, sans sous-catégorie
 * précisée, devient une part « Non précisé » plutôt que de disparaître —
 * même garantie que « À classer » au niveau du camembert.
 *
 * Même construction à deux temps (dépenses / entrées) que
 * `computeMonthlyBreakdown`, pour la même raison : un remboursement dans une
 * sous-catégorie peut légitimement en réduire la part sans devenir un
 * revenu.
 */
export function subcategoryBreakdown(
  entries: BudgetEntry[],
  categories: BudgetCategory[],
  parentId: string,
  monthKey: string,
): SubcategoryBreakdown {
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const netByKey = new Map<string, number>();

  for (const entry of entries) {
    if (monthKeyOf(entry.day) !== monthKey) continue;
    if (!entry.categoryId) continue;
    if (entry.categoryId === parentId) {
      netByKey.set('', (netByKey.get('') ?? 0) + entry.amountCents);
      continue;
    }
    const category = categoryById.get(entry.categoryId);
    if (category?.parentId !== parentId) continue;
    netByKey.set(entry.categoryId, (netByKey.get(entry.categoryId) ?? 0) + entry.amountCents);
  }

  // La couleur du parent, pas le gris neutre de « À classer » : « Non
  // précisé » reste une écriture de Loisirs, juste pas détaillée plus loin —
  // rien à voir avec une écriture qui n'a aucune catégorie du tout.
  const parentColor = categoryById.get(parentId)?.color ?? UNCATEGORIZED_COLOR;

  const slices: SubcategorySlice[] = [];
  const incomeSlices: SubcategorySlice[] = [];
  for (const [key, net] of netByKey) {
    if (net === 0) continue;
    const category = key ? categoryById.get(key) : undefined;
    const slice: SubcategorySlice = {
      categoryId: key || null,
      label: category ? category.name : 'Non précisé',
      emoji: category ? category.emoji : '—',
      color: category ? category.color : parentColor,
      cents: Math.abs(net),
    };
    (net < 0 ? slices : incomeSlices).push(slice);
  }

  slices.sort((a, b) => b.cents - a.cents);
  incomeSlices.sort((a, b) => b.cents - a.cents);
  return { slices, incomeSlices };
}
