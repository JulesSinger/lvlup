/**
 * Le mode cuisine — bibliothèque pure (docs/etude-recettes.md §5, §19).
 */
import { fold, isSectionHeading, parseIngredient, scaleIngredient } from './ingredients';
import type { Ingredient } from './types';

/** Mots trop courts ou trop vagues pour reconnaître un ingrédient dans une étape. */
const VAGUE = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'un', 'une', 'et', 'en', 'au', 'aux', 'eau', 'sel', 'pate', 'jus']);

/**
 * Les ingrédients dont parle une étape : son nom, ou son mot principal
 * (« Ajouter la viande et le céleri » → « 1 branche de céleri »). Le mot
 * principal est le premier mot de plus de trois lettres du nom (« boeuf »
 * de « boeuf haché »), comparé sans accents et au singulier près.
 */
export function stepIngredients(step: string, ingredients: Ingredient[]): Ingredient[] {
  const words = new Set(fold(step).split(/[^a-z0-9]+/).filter(Boolean).map(wordKey));
  return ingredients.filter((i) => {
    const main = mainWord(i);
    return main !== null && words.has(main);
  });
}

/** Un mot comparable : « bœuf » et « boeuf » (que `fold` rend « boeuf » ou « bouf »), au singulier près. */
const wordKey = (w: string) => w.replace(/oe/g, 'o').replace(/[sx]$/, '');

/** Le nom d'un ingrédient, en mots comparables. */
const nameWords = (i: Ingredient) =>
  fold(parseIngredient(i.text).name)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

/** Le mot qui reconnaît un ingrédient dans une étape, ou `null` s'il est trop vague. */
function mainWord(i: Ingredient): string | null {
  if (isSectionHeading(i.text)) return null;
  const parts = nameWords(i);
  // Un nom d'un seul mot court (« ail », « riz ») compte aussi.
  const main = parts.find((w) => w.length > 3 && !VAGUE.has(w)) ?? (parts.length === 1 && parts[0].length === 3 && !VAGUE.has(parts[0]) ? parts[0] : undefined);
  return main ? wordKey(main) : null;
}

/**
 * Ce qu'une ligne d'ingrédient dit de la quantité, ajustée au nombre de
 * personnes : « 1 c. à soupe », « 10 g », « 1/2 ». `null` sans quantité, et
 * pour « 1 » sans unité (« la côte (1) » n'apprend rien).
 */
export function amountOf(text: string, factor: number): string | null {
  const scaled = scaleIngredient(text, factor);
  const p = parseIngredient(scaled);
  if (p.quantity === null || p.span === null) return null;
  if (!p.unit && p.quantity === 1 && p.quantityMax === null) return null;
  return scaled.slice(p.span[0], p.unitSpan ? p.unitSpan[1] : p.span[1]).trim();
}

/** Un morceau du texte d'une étape, et la quantité à écrire juste après lui. */
export interface StepPiece {
  text: string;
  amount?: string;
}

/**
 * Le texte d'une étape avec ses quantités, là où l'ingrédient est nommé
 * (demande de Jules, 16/10/2026 : « pas assez de précision sur les
 * quantités ») : « chauffer l'huile (1 c. à soupe) et le beurre (10 g) ».
 * Une fois par ingrédient, à sa première mention, après tout son nom
 * (« la crème fraîche (4 c. à soupe) », pas « la crème (…) fraîche »).
 */
export function stepWithAmounts(step: string, ingredients: Ingredient[], factor: number): StepPiece[] {
  const folded = fold(step);
  const tokens = [...folded.matchAll(/[a-z0-9]+/g)].map((m) => ({ key: wordKey(m[0]), start: m.index!, end: m.index! + m[0].length }));
  const inserts: { at: number; amount: string }[] = [];
  const taken = new Set<number>();
  for (const i of ingredients) {
    const main = mainWord(i);
    const amount = main && amountOf(i.text, factor);
    if (!main || !amount) continue;
    const t = tokens.findIndex((tok, n) => tok.key === main && !taken.has(n));
    if (t < 0) continue;
    taken.add(t);
    // Les mots suivants qui font partie du nom : « crème » + « fraîche ».
    const name = new Set(nameWords(i).map(wordKey));
    let last = t;
    while (last + 1 < tokens.length && name.has(tokens[last + 1].key) && /^[\s'-]*$/.test(folded.slice(tokens[last].end, tokens[last + 1].start))) last++;
    inserts.push({ at: tokens[last].end, amount });
  }
  inserts.sort((a, b) => a.at - b.at);
  const pieces: StepPiece[] = [];
  let from = 0;
  for (const ins of inserts) {
    pieces.push({ text: step.slice(from, ins.at), amount: ins.amount });
    from = ins.at;
  }
  if (from < step.length || pieces.length === 0) pieces.push({ text: step.slice(from) });
  return pieces;
}

export interface RunningTimer {
  id: number;
  label: string;
  /** L'instant de fin, en millisecondes : mesuré contre l'horloge, il continue même quand le téléphone met l'app en veille. */
  endsAt: number;
  /** En pause : ce qu'il restait, en millisecondes. */
  pausedLeft: number | null;
}

/** Ce qu'il reste, en secondes entières (arrondi au-dessus : « 0:01 » jusqu'à la fin). */
export function remaining(timer: RunningTimer, now: number): number {
  const left = timer.pausedLeft ?? timer.endsAt - now;
  return Math.max(0, Math.ceil(left / 1000));
}

export function pause(timer: RunningTimer, now: number): RunningTimer {
  return timer.pausedLeft !== null ? timer : { ...timer, pausedLeft: Math.max(0, timer.endsAt - now) };
}

export function resume(timer: RunningTimer, now: number): RunningTimer {
  return timer.pausedLeft === null ? timer : { ...timer, endsAt: now + timer.pausedLeft, pausedLeft: null };
}

/** « 1 personne », « 2 personnes » : le nom de ce que donne la recette, accordé (16/10/2026). */
export function yieldText(count: number, label: string): string {
  return `${count} ${count < 2 && /[^s]s$/.test(label) ? label.slice(0, -1) : label}`;
}
