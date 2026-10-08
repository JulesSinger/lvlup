/**
 * Une recette collée en texte — bibliothèque pure (docs/etude-recettes.md §3.2).
 *
 * Instagram, un message, un PDF : pas de données structurées. On repère les
 * groupes « Ingrédients » et « Préparation » quand ils sont dits ; sinon,
 * une ligne qui commence par une quantité ou une puce est un ingrédient, une
 * ligne numérotée ou une phrase longue est une étape. Le résultat est un
 * brouillon, toujours montré et corrigeable avant d'enregistrer.
 */
import { fold, isSectionHeading, parseIngredient } from './ingredients';
import type { Ingredient, Step } from './types';

export interface PastedRecipe {
  title: string;
  servings: number | null;
  yieldLabel: string;
  ingredients: Ingredient[];
  steps: Step[];
}

const INGREDIENTS_HEAD = /^(ingredients?|liste des ingredients|il vous faut|pour \d+ personnes?)\s*:?\s*$/;
const STEPS_HEAD = /^(preparation|etapes?|instructions?|recette|deroule|methode|la recette)\s*:?\s*$/;

/** « Pour 4 personnes », « 6 parts », « 12 crêpes » → 4, « personnes ». */
export function readServings(text: string): { servings: number; yieldLabel: string } | null {
  const m = /(?:pour\s+)?(\d{1,3})\s+(personnes?|parts?|portions?|pers\.?|crepes?|pieces?|biscuits?|cookies?|muffins?|verrines?|bouchees?)/.exec(fold(text));
  if (!m) return null;
  const n = Number(m[1]);
  if (n < 1 || n > 100) return null;
  const word = m[2].replace(/\.$/, '');
  const label = word.startsWith('pers') ? 'personnes' : /^(part|portion)/.test(word) ? 'parts' : text.slice(m.index + m[0].length - m[2].length, m.index + m[0].length).replace(/\.$/, '');
  return { servings: n, yieldLabel: word.startsWith('pers') ? 'personnes' : label.toLowerCase() };
}

const looksLikeIngredient = (line: string) => {
  const t = line.replace(/^\s*[-•*·–]\s*/, '');
  return parseIngredient(t).quantity !== null || /^\s*[-•*·–]\s+/.test(line);
};

export function parsePastedRecipe(text: string): PastedRecipe {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0);
  let title = '';
  let servings: number | null = null;
  let yieldLabel = 'personnes';
  const ingredients: Ingredient[] = [];
  const steps: Step[] = [];
  let mode: 'auto' | 'ingredients' | 'steps' = 'auto';
  let section: string | null = null;

  for (const [i, line] of lines.entries()) {
    const f = fold(line);
    const yieldInfo = readServings(line);
    if (yieldInfo && servings === null && line.length < 60) {
      servings = yieldInfo.servings;
      yieldLabel = yieldInfo.yieldLabel;
      if (INGREDIENTS_HEAD.test(f)) mode = 'ingredients';
      continue;
    }
    if (INGREDIENTS_HEAD.test(f)) {
      mode = 'ingredients';
      section = null;
      continue;
    }
    if (STEPS_HEAD.test(f)) {
      mode = 'steps';
      continue;
    }
    // Le titre : la première ligne qui n'est ni un ingrédient ni une étape.
    if (i === 0 && !looksLikeIngredient(line) && !/^\d+[.)]/.test(line) && line.length <= 120) {
      title = line.replace(/[:.]$/, '');
      continue;
    }
    const numbered = /^(?:etape\s*)?\d+\s*[.)\-–:]\s*/i.exec(f);
    if (mode === 'ingredients' || (mode === 'auto' && looksLikeIngredient(line) && !numbered)) {
      if (isSectionHeading(line) && mode === 'ingredients') {
        section = line.replace(/\s*:\s*$/, '');
        continue;
      }
      // Une phrase longue dans les ingrédients annonce la préparation.
      if (mode === 'ingredients' && line.length > 90 && !looksLikeIngredient(line)) {
        mode = 'steps';
      } else {
        ingredients.push({ text: line.replace(/^\s*[-•*·–]\s*/, ''), section });
        continue;
      }
    }
    steps.push({ text: numbered ? line.slice(numbered[0].length) : line.replace(/^\s*[-•*·–]\s*/, '') });
  }
  return { title, servings, yieldLabel, ingredients, steps };
}
