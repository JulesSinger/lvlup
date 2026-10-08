/**
 * Le menu de la semaine et la liste de courses qu'on en tire — bibliothèque
 * pure (docs/etude-recettes.md §5, §6.1, §12).
 *
 * Rien ne part vers Courses tout seul (décision de Jules) : ces règles
 * préparent une liste **à relire**, où les ingrédients « toujours là » sont
 * décochés d'office.
 */
import { mondayOf, shiftDay } from '../../../core/lib/day';
import { formatQuantity, ingredientKey, isSectionHeading, parseIngredient, unitById } from './ingredients';
import type { Meal, PlanEntry, Recipe } from './types';

/** Les sept jours de la semaine de `day`, du lundi au dimanche. */
export function weekDays(day: string): string[] {
  const monday = mondayOf(day);
  return Array.from({ length: 7 }, (_, i) => shiftDay(monday, i));
}

/** Les entrées d'une case du menu, dans leur ordre. */
export function slot(entries: PlanEntry[], day: string, meal: Meal): PlanEntry[] {
  return entries.filter((e) => e.day === day && e.meal === meal).sort((a, b) => a.position - b.position);
}

/** La position d'une nouvelle entrée : après les autres de la case. */
export function nextPosition(entries: PlanEntry[], day: string, meal: Meal): number {
  return slot(entries, day, meal).reduce((m, e) => Math.max(m, e.position + 1), 0);
}

/** Le facteur d'une recette faite pour `servings` personnes ; 1 quand l'un des deux manque. */
export function factorFor(recipe: Pick<Recipe, 'servings'>, servings: number | null): number {
  return recipe.servings && servings ? servings / recipe.servings : 1;
}

export interface ShoppingLine {
  key: string;
  /** Le nom tel qu'écrit dans la première recette qui le demande. */
  name: string;
  /** « 900 g », « 3 + 200 g », « 2 gousses » ; vide quand aucune recette ne dit combien. */
  quantity: string;
  /** Les recettes qui le demandent (« lasagnes, curry »). */
  sources: string[];
  /** Un ingrédient « toujours là » : décoché d'office. */
  pantry: boolean;
}

interface Totals {
  name: string;
  massG: number;
  volumeMl: number;
  /** Les pièces et cuillères, par unité (`''` : sans unité, « 3 oignons »). */
  counts: Map<string, number>;
  unknown: boolean;
  sources: string[];
}

function formatMass(g: number): string {
  return g >= 1000 ? `${formatQuantity(g / 1000, 'kg')} kg` : `${formatQuantity(g, 'g')} g`;
}

function formatVolume(ml: number): string {
  if (ml >= 1000) return `${formatQuantity(ml / 1000, 'l')} l`;
  if (ml >= 10) return `${formatQuantity(ml / 10, 'cl')} cl`;
  return `${formatQuantity(ml, 'ml')} ml`;
}

/** Un ingrédient « toujours là » : le même nom, ou fait seulement de tels noms (« Sel poivre »). */
export function isPantry(key: string, pantry: string[]): boolean {
  const keys = new Set(pantry.map(ingredientKey));
  if (keys.has(key)) return true;
  const parts = key.split(' ').filter((w) => !['et', 'de', 'du'].includes(w));
  return parts.length > 0 && parts.every((w) => keys.has(w));
}

/**
 * La liste de courses de plusieurs recettes, chacune pour son nombre de
 * personnes. Un même ingrédient s'additionne : les masses ensemble, les
 * volumes ensemble, les pièces par unité ; ce qui ne s'additionne pas se met
 * bout à bout (« 3 + 200 g »).
 */
export function shoppingLines(items: { recipe: Recipe; servings: number | null }[], pantry: string[]): ShoppingLine[] {
  const byKey = new Map<string, Totals>();
  for (const { recipe, servings } of items) {
    const factor = factorFor(recipe, servings);
    for (const ingredient of recipe.ingredients) {
      if (isSectionHeading(ingredient.text)) continue;
      const p = parseIngredient(ingredient.text);
      if (!p.key) continue;
      const t: Totals = byKey.get(p.key) ?? { name: p.name, massG: 0, volumeMl: 0, counts: new Map(), unknown: false, sources: [] };
      if (!t.sources.includes(recipe.title)) t.sources.push(recipe.title);
      if (p.quantity === null) t.unknown = true;
      else {
        const amount = (p.quantityMax ?? p.quantity) * factor;
        const unit = p.unit ? unitById(p.unit) : null;
        if (unit?.kind === 'masse') t.massG += amount * unit.base!;
        else if (unit?.kind === 'volume') t.volumeMl += amount * unit.base!;
        else t.counts.set(p.unit ?? '', (t.counts.get(p.unit ?? '') ?? 0) + amount);
      }
      byKey.set(p.key, t);
    }
  }
  return [...byKey.entries()].map(([key, t]) => {
    const parts: string[] = [];
    for (const [unitId, n] of t.counts) {
      const unit = unitId ? unitById(unitId) : null;
      parts.push(unit ? `${formatQuantity(n, unitId)} ${n >= 2 ? unit.plural : unit.singular}` : formatQuantity(n, null));
    }
    if (t.massG > 0) parts.push(formatMass(t.massG));
    if (t.volumeMl > 0) parts.push(formatVolume(t.volumeMl));
    return { key, name: t.name, quantity: parts.join(' + '), sources: t.sources, pantry: isPantry(key, pantry) };
  });
}
