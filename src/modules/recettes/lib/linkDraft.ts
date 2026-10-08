/**
 * Ce que rend la fonction `recettes-import`, ramené à une recette à relire —
 * bibliothèque pure (docs/etude-recettes.md §16). Relu champ par champ : la
 * réponse vient d'un site qu'on ne maîtrise pas.
 */
import { INGREDIENTS_MAX, RECIPE_CATEGORIES, STEPS_MAX, type RecipeCategory, type RecipeInput } from './types';

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const minutes = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 10_080 ? v : null);

export function draftToInput(draft: unknown): RecipeInput | null {
  if (typeof draft !== 'object' || draft === null) return null;
  const d = draft as Record<string, unknown>;
  const title = str(d.title, 200).trim();
  if (!title) return null;
  const servings = typeof d.servings === 'number' && Number.isInteger(d.servings) && d.servings >= 1 && d.servings <= 100 ? d.servings : null;
  const category = (RECIPE_CATEGORIES as readonly string[]).includes(d.category as string) ? (d.category as RecipeCategory) : 'plat';
  const ingredients = (Array.isArray(d.ingredients) ? d.ingredients : [])
    .filter((i): i is { text: string; section?: unknown } => typeof i === 'object' && i !== null && typeof (i as { text?: unknown }).text === 'string')
    .slice(0, INGREDIENTS_MAX)
    .map((i) => ({ text: i.text.slice(0, 300), section: typeof i.section === 'string' && i.section ? i.section.slice(0, 120) : null }));
  const steps = (Array.isArray(d.steps) ? d.steps : [])
    .filter((s): s is { text: string } => typeof s === 'object' && s !== null && typeof (s as { text?: unknown }).text === 'string')
    .slice(0, STEPS_MAX)
    .map((s) => ({ text: s.text.slice(0, 2000) }));
  const url = str(d.sourceUrl, 1000);
  return {
    title,
    description: str(d.description, 2000),
    servings,
    yieldLabel: str(d.yieldLabel, 40) || 'personnes',
    prepMinutes: minutes(d.prepMinutes),
    cookMinutes: minutes(d.cookMinutes),
    restMinutes: minutes(d.restMinutes),
    category,
    tags: (Array.isArray(d.tags) ? d.tags : []).filter((t): t is string => typeof t === 'string').map((t) => t.slice(0, 40)).slice(0, 20),
    sourceUrl: /^https?:\/\//.test(url) ? url : null,
    sourceName: str(d.sourceName, 200),
    ingredients,
    steps,
  };
}

/** La photo rapportée (base64) en fichier, comme si Jules l'avait choisie. */
export function base64ToFile(base64: string, type: string, name = 'photo.jpg'): File {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type: type.startsWith('image/') ? type : 'image/jpeg' });
}
