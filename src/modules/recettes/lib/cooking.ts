/**
 * Le mode cuisine — bibliothèque pure (docs/etude-recettes.md §5, §19).
 */
import { fold, isSectionHeading, parseIngredient } from './ingredients';
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
  // « bœuf » et « boeuf » sont le même mot.
  const plain = (t: string) => fold(t.replace(/œ/g, 'oe').replace(/Œ/g, 'Oe'));
  const words = new Set(
    plain(step)
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .flatMap((w) => [w, w.replace(/[sx]$/, '')]),
  );
  return ingredients.filter((i) => {
    if (isSectionHeading(i.text)) return false;
    const name = plain(parseIngredient(i.text).name);
    const parts = name.split(/[^a-z0-9]+/).filter(Boolean);
    // Un nom d'un seul mot court (« ail », « riz ») compte aussi.
    const main = parts.find((w) => w.length > 3 && !VAGUE.has(w)) ?? (parts.length === 1 && parts[0].length === 3 && !VAGUE.has(parts[0]) ? parts[0] : undefined);
    if (!main) return false;
    return words.has(main) || words.has(main.replace(/[sx]$/, ''));
  });
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
