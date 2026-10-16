/**
 * Les outils de Recettes pour Claude (docs/connecteur-claude.md §4) — règles
 * pures, testées par Vitest (`src/modules/recettes/lib/mcpTools.test.ts`),
 * qui compare aussi les bornes d'ici à celles du module.
 *
 * Tout le module, en lecture et en écriture (décision de Jules, 11/10/2026) :
 * le carnet, le menu de la semaine, « je l'ai faite » et les ingrédients
 * « toujours là ». Seule la photo reste à l'app (une image ne passe pas par
 * ici).
 *
 * Les outils ne touchent jamais la base directement : ils passent par
 * `RecettesData`, dont chaque méthode est limitée au compte du jeton
 * (`index.ts`). Les colonnes sont celles de `2026-10-08-recettes-tables.sql`.
 */
import type { Tool, ToolResult } from './mcp.ts';

// Les bornes de la base — `mcpTools.test.ts` les compare à `recettes/lib/types.ts`.
export const RECIPE_CATEGORIES = ['entree', 'plat', 'dessert', 'aperitif', 'petit-dejeuner', 'accompagnement', 'sauce', 'boisson', 'autre'] as const;
export const MEALS = ['midi', 'soir'] as const;
export const RECIPE_TITLE_MAX = 200;
export const SERVINGS_MAX = 100;
export const MINUTES_MAX = 10_080;
export const INGREDIENTS_MAX = 150;
export const STEPS_MAX = 80;
export const TAGS_MAX = 20;
export const PLAN_TITLE_MAX = 120;
export const PANTRY_MAX = 200;
/** Les postes proposés et la longueur d'un poste (`STATIONS`, `STATION_MAX` du module). */
export const STATIONS = ['Plan de travail', 'Casserole', 'Poêle', 'Four', 'Micro-ondes', 'Robot'] as const;
export const STATION_MAX = 40;
/** Au plus tant de recettes rendues par une recherche : au-delà, Claude affine. */
export const LIST_LIMIT = 100;

export interface RecipeRow {
  id: string;
  title: string;
  description: string;
  servings: number | null;
  yield_label: string;
  prep_minutes: number | null;
  cook_minutes: number | null;
  rest_minutes: number | null;
  category: string;
  tags: string[];
  source_url: string | null;
  source_name: string;
  note: string;
  favorite: boolean;
  ingredients: { text: string; section: string | null }[];
  steps: StepRow[];
  created_at: string;
  updated_at: string;
}

/**
 * Une étape, et son temps s'il est réglé (docs/etude-recettes.md §20) :
 * le même JSON que `Step` du module. `start.of` désigne l'`id` d'une autre étape.
 */
export interface StepRow {
  text: string;
  id?: string;
  station?: string | null;
  minutes?: number | null;
  hands?: boolean;
  start?: { after: 'launch' } | { after: 'end'; of: string } | { after: 'start'; of: string; offset: number };
}

export interface PlanRow {
  id: string;
  day: string;
  meal: string;
  recipe_id: string | null;
  title: string;
  servings: number | null;
  position: number;
}

export interface CookedRow {
  id: string;
  recipe_id: string;
  day: string;
  servings: number | null;
  rating: number | null;
  comment: string;
}

/** Ce que les outils peuvent faire, toujours sur le seul compte du jeton. */
export interface RecettesData {
  listRecipes(): Promise<RecipeRow[]>;
  getRecipe(id: string): Promise<RecipeRow | null>;
  insertRecipe(row: Record<string, unknown>): Promise<RecipeRow>;
  updateRecipe(id: string, row: Record<string, unknown>): Promise<RecipeRow | null>;
  /** Emporte photo (fichiers compris), historique et menu. */
  deleteRecipe(id: string): Promise<boolean>;
  photoRecipeIds(): Promise<Set<string>>;
  listCooked(recipeId: string): Promise<CookedRow[]>;
  getCooked(id: string): Promise<CookedRow | null>;
  insertCooked(row: Record<string, unknown>): Promise<CookedRow>;
  updateCooked(id: string, row: Record<string, unknown>): Promise<CookedRow | null>;
  deleteCooked(id: string): Promise<boolean>;
  listPlan(from: string, to: string): Promise<PlanRow[]>;
  getPlan(id: string): Promise<PlanRow | null>;
  insertPlan(row: Record<string, unknown>): Promise<PlanRow>;
  updatePlan(id: string, row: Record<string, unknown>): Promise<PlanRow | null>;
  deletePlan(id: string): Promise<boolean>;
  getPantry(): Promise<string[] | null>;
  setPantry(items: string[]): Promise<void>;
}

export interface RecettesContext {
  data: RecettesData;
  /** Aujourd'hui, AAAA-MM-JJ, à l'heure de Jules. */
  today: string;
}

/** Les « toujours là » d'un compte qui n'a encore rien réglé (`DEFAULT_PANTRY` du module). */
export const DEFAULT_PANTRY = ['sel', 'poivre', 'huile', 'huile d’olive', 'sucre', 'farine', 'eau', 'vinaigre'];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Une erreur dite à Claude, qui la lira et corrigera son appel. */
class Refused extends Error {}

const ok = (text: string): ToolResult => ({ text });
const json = (value: unknown): ToolResult => ({ text: JSON.stringify(value, null, 2) });

function realDay(v: unknown, what = 'jour'): string {
  if (typeof v !== 'string' || !DAY.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) {
    throw new Refused(`Le ${what} s’écrit AAAA-MM-JJ (par exemple 2026-10-14).`);
  }
  return v;
}

function id(v: unknown, what = 'identifiant'): string {
  if (typeof v !== 'string' || !UUID.test(v)) throw new Refused(`${what} invalide : prends-le dans le résultat d’un autre outil.`);
  return v.toLowerCase();
}

function text(v: unknown, what: string, max: number, required = false): string {
  if (v === undefined || v === null) {
    if (required) throw new Refused(`${what} manque.`);
    return '';
  }
  if (typeof v !== 'string') throw new Refused(`${what} doit être un texte.`);
  const t = v.trim();
  if (required && t.length === 0) throw new Refused(`${what} manque.`);
  if (t.length > max) throw new Refused(`${what} : ${max} caractères au plus.`);
  return t;
}

function int(v: unknown, what: string, min: number, max: number): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw new Refused(`${what} : un nombre entier de ${min} à ${max}.`);
  return v;
}

function stringList(v: unknown, what: string, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(v)) throw new Refused(`${what} : une liste de textes.`);
  const out = v.map((x) => text(x, what, maxLength)).filter((x) => x.length > 0);
  if (out.length > maxItems) throw new Refused(`${what} : ${maxItems} au plus.`);
  return out;
}

/**
 * Les ingrédients, tels qu'ils sont écrits (« 200 g de farine ») — l'app en
 * calcule la lecture. Un texte, ou `{ text, section }` pour un groupe
 * (« Pour la béchamel »).
 */
function ingredients(v: unknown): RecipeRow['ingredients'] {
  if (!Array.isArray(v)) throw new Refused('ingredients : une liste.');
  if (v.length > INGREDIENTS_MAX) throw new Refused(`${INGREDIENTS_MAX} ingrédients au plus.`);
  return v
    .map((item) => {
      if (typeof item === 'string') return { text: text(item, 'Un ingrédient', 500), section: null };
      if (typeof item === 'object' && item !== null) {
        const o = item as Record<string, unknown>;
        const section = text(o.section, 'Un groupe d’ingrédients', 120);
        return { text: text(o.text, 'Un ingrédient', 500), section: section || null };
      }
      throw new Refused('Un ingrédient : un texte, ou { text, section }.');
    })
    .filter((i) => i.text.length > 0);
}

function steps(v: unknown): RecipeRow['steps'] {
  return stringList(v, 'steps', STEPS_MAX, 4000).map((t) => ({ text: t }));
}

/**
 * Les étapes réécrites par Claude reprennent leurs réglages de temps : ceux de
 * l'ancienne étape au même texte, sinon de celle à la même place si son texte
 * a disparu. Un renvoi vers une étape disparue est retiré. Même règle que
 * `mergeStepTiming` du module, comparée par `mcpTools.test.ts`.
 */
export function keepTiming(previous: readonly StepRow[], next: readonly StepRow[]): StepRow[] {
  const used = new Set<number>();
  const timing = next.map(() => null as Omit<StepRow, 'text'> | null);
  const take = (i: number) => {
    used.add(i);
    const { text: _text, ...rest } = previous[i];
    return rest;
  };
  next.forEach((step, n) => {
    const same = previous.findIndex((p, i) => !used.has(i) && p.text === step.text);
    if (same >= 0) timing[n] = take(same);
  });
  next.forEach((_, n) => {
    if (!timing[n] && n < previous.length && !used.has(n) && !next.some((x) => x.text === previous[n].text)) timing[n] = take(n);
  });
  const out: StepRow[] = next.map((step, n) => (timing[n] ? { ...timing[n], text: step.text } : { text: step.text }));
  const ids = new Set(out.map((x) => x.id).filter(Boolean));
  return out.map((x) => {
    if (x.start && x.start.after !== 'launch' && !ids.has(x.start.of)) {
      const { start: _start, ...rest } = x;
      return rest;
    }
    return x;
  });
}

const newStepId = () => Math.random().toString(36).slice(2, 10);

/**
 * Le temps d'une étape, tel que Claude le donne : `step` (son numéro, à partir
 * de 1), puis les champs à régler. `starts` : `"launch"` (au lancement),
 * `"after_previous"` (après l'étape d'avant), `{ end_of: 3 }` (à la fin de
 * l'étape 3), `{ start_of: 1, offset_minutes: 3 }` (3 min après le début de
 * l'étape 1). Un champ à `null` est retiré ; un champ absent ne change pas.
 */
export function applyTiming(current: readonly StepRow[], items: unknown): StepRow[] {
  if (!Array.isArray(items) || items.length === 0) throw new Refused('steps_timing : une liste, une entrée par étape à régler.');
  if (items.length > STEPS_MAX) throw new Refused(`${STEPS_MAX} étapes au plus.`);
  const out = current.map((step) => ({ ...step, id: step.id ?? newStepId() }));
  const numberOf = (v: unknown, what: string) => {
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > out.length) throw new Refused(`${what} : un numéro d’étape de 1 à ${out.length}.`);
    return v - 1;
  };
  const minutesOf = (v: unknown, what: string, min: number) => {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > 1440) throw new Refused(`${what} : de ${min} à 1440 minutes.`);
    return Math.round(v * 2) / 2;
  };
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') throw new Refused('Chaque entrée de steps_timing est un objet { step, … }.');
    const item = raw as Record<string, unknown>;
    const n = numberOf(item.step, 'step');
    const step = out[n];
    if ('station' in item) {
      if (item.station === null) delete step.station;
      else step.station = text(item.station, 'Le poste', STATION_MAX, true);
    }
    if ('minutes' in item) {
      if (item.minutes === null) delete step.minutes;
      else step.minutes = minutesOf(item.minutes, 'minutes', 0.5);
    }
    if ('hands' in item) {
      if (item.hands === null) delete step.hands;
      else if (typeof item.hands === 'boolean') step.hands = item.hands;
      else throw new Refused('hands : vrai (tu es dessus) ou faux (ça cuit tout seul).');
    }
    if ('starts' in item) {
      const v = item.starts;
      if (v === null || v === 'after_previous') delete step.start;
      else if (v === 'launch') step.start = { after: 'launch' };
      else if (v && typeof v === 'object' && 'end_of' in v) {
        const ref = numberOf((v as Record<string, unknown>).end_of, 'end_of');
        if (ref === n) throw new Refused('Une étape ne peut pas attendre sa propre fin.');
        step.start = { after: 'end', of: out[ref].id! };
      } else if (v && typeof v === 'object' && 'start_of' in v) {
        const o = v as Record<string, unknown>;
        const ref = numberOf(o.start_of, 'start_of');
        if (ref === n) throw new Refused('Une étape ne peut pas partir de son propre début.');
        step.start = { after: 'start', of: out[ref].id!, offset: o.offset_minutes === undefined ? 0 : minutesOf(o.offset_minutes, 'offset_minutes', 0) };
      } else {
        throw new Refused('starts : "launch", "after_previous", { end_of: N } ou { start_of: N, offset_minutes: M }.');
      }
    }
  }
  return out;
}

/** Le temps des étapes, lisible par Claude : numéros d'étape plutôt qu'identifiants. */
function timingOut(list: readonly StepRow[]) {
  const numberOf = new Map(list.map((x, i) => [x.id, i + 1]));
  const timed = list.some((x) => (x.station ?? null) !== null || (x.minutes ?? null) !== null);
  if (!timed) return null;
  return list.map((x, i) => ({
    step: i + 1,
    station: x.station ?? null,
    minutes: x.minutes ?? null,
    hands: x.hands ?? null,
    starts: !x.start
      ? i === 0 ? 'launch' : 'after_previous'
      : x.start.after === 'launch'
        ? 'launch'
        : x.start.after === 'end'
          ? { end_of: numberOf.get(x.start.of) ?? null }
          : { start_of: numberOf.get(x.start.of) ?? null, offset_minutes: x.start.offset },
  }));
}

/**
 * Les arguments d'une recette → les colonnes de la base. `partial` : une
 * modification, seuls les champs donnés changent (une liste donnée remplace
 * la liste entière).
 */
export function recipeColumns(args: Record<string, unknown>, partial: boolean): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const has = (k: string) => args[k] !== undefined;
  if (!partial || has('title')) row.title = text(args.title, 'Le titre', RECIPE_TITLE_MAX, true);
  if (has('description')) row.description = text(args.description, 'La description', 2000);
  if (has('servings')) row.servings = int(args.servings, 'servings (personnes)', 1, SERVINGS_MAX);
  if (has('yield_label')) row.yield_label = text(args.yield_label, 'yield_label', 40) || 'personnes';
  for (const [k, what] of [
    ['prep_minutes', 'Le temps de préparation'],
    ['cook_minutes', 'Le temps de cuisson'],
    ['rest_minutes', 'Le temps de repos'],
  ] as const) {
    if (has(k)) row[k] = int(args[k], `${what} (minutes)`, 0, MINUTES_MAX);
  }
  if (has('category')) {
    if (!(RECIPE_CATEGORIES as readonly string[]).includes(String(args.category))) {
      throw new Refused(`Catégorie inconnue ; au choix : ${RECIPE_CATEGORIES.join(', ')}.`);
    }
    row.category = args.category;
  }
  if (has('tags')) row.tags = [...new Set(stringList(args.tags, 'tags', TAGS_MAX, 40).map((t) => t.toLowerCase()))];
  if (has('source_url')) {
    const url = args.source_url === null || args.source_url === '' ? null : text(args.source_url, 'Le lien de la source', 1000);
    if (url && !/^https?:\/\//.test(url)) throw new Refused('Le lien de la source commence par http:// ou https://.');
    row.source_url = url;
  }
  if (has('source_name')) row.source_name = text(args.source_name, 'La source', 200);
  if (has('note')) row.note = text(args.note, 'La note', 4000);
  if (has('favorite')) {
    if (typeof args.favorite !== 'boolean') throw new Refused('favorite : vrai ou faux.');
    row.favorite = args.favorite;
  }
  if (has('ingredients')) row.ingredients = ingredients(args.ingredients);
  if (has('steps')) row.steps = steps(args.steps);
  return row;
}

/** Sans accents ni majuscules, pour chercher comme on tape. */
export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[œ]/g, 'oe')
    .toLowerCase();

/** Une recherche : chaque mot doit se trouver dans le titre, les étiquettes ou les ingrédients. */
export function matches(recipe: RecipeRow, query: string): boolean {
  const haystack = fold([recipe.title, recipe.tags.join(' '), recipe.ingredients.map((i) => i.text).join(' '), recipe.source_name].join(' '));
  return fold(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word));
}

const totalMinutes = (r: RecipeRow) =>
  r.prep_minutes === null && r.cook_minutes === null && r.rest_minutes === null
    ? null
    : (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0) + (r.rest_minutes ?? 0);

/** Une recette telle que Claude la lit : sans l'identifiant du compte, avec ses dates. */
const recipeOut = (r: RecipeRow, extra: Record<string, unknown> = {}) => ({
  id: r.id,
  title: r.title,
  description: r.description,
  servings: r.servings,
  yield_label: r.yield_label,
  prep_minutes: r.prep_minutes,
  cook_minutes: r.cook_minutes,
  rest_minutes: r.rest_minutes,
  category: r.category,
  tags: r.tags,
  source_url: r.source_url,
  source_name: r.source_name,
  note: r.note,
  favorite: r.favorite,
  ingredients: r.ingredients,
  steps: r.steps.map((s) => s.text),
  // Le temps des étapes, seulement pour une recette minutée (§20).
  steps_timing: timingOut(r.steps),
  updated_at: r.updated_at,
  ...extra,
});

async function ownRecipe(data: RecettesData, value: unknown): Promise<RecipeRow> {
  const recipe = await data.getRecipe(id(value, 'recipe_id'));
  if (!recipe) throw new Refused('Aucune recette avec cet identifiant : cherche-la d’abord avec recettes_lister.');
  return recipe;
}

const mondayOf = (day: string) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// --- Les schémas des arguments, que Claude lit pour appeler les outils ---------------------------

const S = {
  id: { type: 'string', description: 'Identifiant (uuid), tel que rendu par un autre outil.' },
  day: { type: 'string', description: 'Jour au format AAAA-MM-JJ.' },
  servings: { type: 'integer', minimum: 1, maximum: SERVINGS_MAX },
};

const RECIPE_FIELDS = {
  title: { type: 'string', maxLength: RECIPE_TITLE_MAX, description: 'Le titre de la recette.' },
  description: { type: 'string', description: 'Une phrase de présentation (facultative).' },
  servings: { ...S.servings, description: 'Pour combien de personnes (ou de pièces, voir yield_label).' },
  yield_label: { type: 'string', description: 'Ce que compte servings : « personnes » par défaut, ou « crêpes », « moule »…' },
  prep_minutes: { type: 'integer', minimum: 0, maximum: MINUTES_MAX, description: 'Préparation, en minutes.' },
  cook_minutes: { type: 'integer', minimum: 0, maximum: MINUTES_MAX, description: 'Cuisson, en minutes.' },
  rest_minutes: { type: 'integer', minimum: 0, maximum: MINUTES_MAX, description: 'Repos, en minutes.' },
  category: { type: 'string', enum: [...RECIPE_CATEGORIES] },
  tags: { type: 'array', items: { type: 'string' }, maxItems: TAGS_MAX, description: 'Étiquettes libres, en minuscules : « végétarien », « rapide »…' },
  source_url: { type: ['string', 'null'], description: 'Le lien d’où vient la recette.' },
  source_name: { type: 'string', description: 'D’où elle vient, sans lien : un livre, « Maman ».' },
  note: { type: 'string', description: 'La note personnelle : « doubler l’ail ».' },
  favorite: { type: 'boolean' },
  ingredients: {
    type: 'array',
    maxItems: INGREDIENTS_MAX,
    description:
      'Un ingrédient par ligne, écrit comme dans un livre de cuisine, quantité en tête : « 200 g de farine », « 3 œufs », « 1 c. à soupe d’huile d’olive ». L’app lit les quantités pour ajuster au nombre de personnes et faire la liste de courses. Pour un groupe : { "text": "…", "section": "Pour la sauce" }.',
    items: {
      anyOf: [
        { type: 'string' },
        { type: 'object', properties: { text: { type: 'string' }, section: { type: 'string' } }, required: ['text'] },
      ],
    },
  },
  steps: { type: 'array', items: { type: 'string' }, maxItems: STEPS_MAX, description: 'Les étapes, une par élément, dans l’ordre, sans numéro.' },
};

// --- Les outils --------------------------------------------------------------------------------------

export const recettesTools: Tool<RecettesContext>[] = [
  {
    name: 'recettes_lister',
    title: 'Chercher dans le carnet de recettes',
    description:
      'Liste les recettes du carnet d’Atlas, en résumé (id, titre, catégorie, personnes, temps total, étiquettes, favori). Sans « query », tout le carnet ; avec, seulement celles dont le titre, les étiquettes ou les ingrédients contiennent tous les mots.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Mots à chercher : « poulet citron », « végétarien ».' },
        category: { type: 'string', enum: [...RECIPE_CATEGORIES] },
        favorite: { type: 'boolean', description: 'Seulement les favorites.' },
      },
    },
    annotations: { readOnlyHint: true },
    async run(args, { data }) {
      const query = text(args.query, 'query', 200);
      const all = await data.listRecipes();
      const found = all
        .filter((r) => (!query || matches(r, query)) && (!args.category || r.category === args.category) && (args.favorite !== true || r.favorite))
        .sort((a, b) => a.title.localeCompare(b.title, 'fr'));
      return json({
        total: found.length,
        shown: Math.min(found.length, LIST_LIMIT),
        recipes: found.slice(0, LIST_LIMIT).map((r) => ({
          id: r.id,
          title: r.title,
          category: r.category,
          servings: r.servings,
          total_minutes: totalMinutes(r),
          tags: r.tags,
          favorite: r.favorite,
        })),
      });
    },
  },
  {
    name: 'recettes_lire',
    title: 'Lire une recette',
    description: 'Une recette entière : ingrédients, étapes, temps, note, et les fois où elle a été faite.',
    inputSchema: { type: 'object', properties: { id: S.id }, required: ['id'] },
    annotations: { readOnlyHint: true },
    async run(args, { data }) {
      const recipe = await ownRecipe(data, args.id);
      const [cooked, photos] = await Promise.all([data.listCooked(recipe.id), data.photoRecipeIds()]);
      return json(recipeOut(recipe, { has_photo: photos.has(recipe.id), cooked: cooked.sort((a, b) => b.day.localeCompare(a.day)) }));
    },
  },
  {
    name: 'recettes_creer',
    title: 'Ajouter une recette',
    description:
      'Ajoute une recette au carnet. Seul le titre est obligatoire ; donne autant que possible les ingrédients (un par ligne, quantité en tête), les étapes, les personnes et les temps. La photo s’ajoute depuis l’app.',
    inputSchema: { type: 'object', properties: RECIPE_FIELDS, required: ['title'] },
    annotations: {},
    async run(args, { data }) {
      const created = await data.insertRecipe(recipeColumns(args, false));
      return json({ message: `Recette « ${created.title} » ajoutée.`, recipe: recipeOut(created) });
    },
  },
  {
    name: 'recettes_modifier',
    title: 'Modifier une recette',
    description:
      'Modifie une recette : seuls les champs donnés changent. Une liste donnée (ingredients, steps, tags) remplace la liste entière : lis d’abord la recette pour la reprendre.',
    inputSchema: { type: 'object', properties: { id: S.id, ...RECIPE_FIELDS }, required: ['id'] },
    annotations: { idempotentHint: true },
    async run(args, { data }) {
      const recipe = await ownRecipe(data, args.id);
      const { id: _id, ...rest } = args;
      const row = recipeColumns(rest, true);
      if (Object.keys(row).length === 0) throw new Refused('Rien à modifier : donne au moins un champ.');
      // Des étapes réécrites gardent leur temps (§20.7).
      if (row.steps) row.steps = keepTiming(recipe.steps ?? [], row.steps as StepRow[]);
      const updated = await data.updateRecipe(recipe.id, { ...row, updated_at: new Date().toISOString() });
      if (!updated) throw new Refused('La recette n’existe plus.');
      return json({ message: `Recette « ${updated.title} » modifiée.`, recipe: recipeOut(updated) });
    },
  },
  {
    name: 'recettes_minuter',
    title: 'Régler les temps d’une recette',
    description:
      'Règle le temps des étapes, pour les recettes où plusieurs choses se font en parallèle (l’eau qui chauffe pendant qu’on émince) : l’app en tire un plan et l’écran « En cuisine ». ' +
      'Pour chaque étape (son numéro, à partir de 1) : station (le poste : ' +
      STATIONS.join(', ') +
      ', ou autre), minutes (la durée de TOUTE l’étape : chauffer la poêle compris, les deux faces d’une viande « 6 à 7 min par face » = 15, « 2 min puis 3 min » = 5 ; dans une fourchette, le haut), hands (vrai : on est dessus ; faux : ça cuit tout seul), starts ("launch", "after_previous", { end_of: N } — « quand l’eau bout » —, ou { start_of: N, offset_minutes: M }). ' +
      'Seules les étapes données changent ; un champ à null est retiré. Lis d’abord la recette.',
    inputSchema: {
      type: 'object',
      properties: {
        id: S.id,
        steps_timing: {
          type: 'array',
          maxItems: STEPS_MAX,
          items: {
            type: 'object',
            properties: {
              step: { type: 'integer', minimum: 1, maximum: STEPS_MAX },
              station: { type: ['string', 'null'], maxLength: STATION_MAX },
              minutes: { type: ['number', 'null'], minimum: 0.5, maximum: 1440 },
              hands: { type: ['boolean', 'null'] },
              starts: {},
            },
            required: ['step'],
          },
        },
      },
      required: ['id', 'steps_timing'],
    },
    annotations: { idempotentHint: true },
    async run(args, { data }) {
      const recipe = await ownRecipe(data, args.id);
      if (recipe.steps.length === 0) throw new Refused('Cette recette n’a pas d’étapes : ajoute-les d’abord (recettes_modifier).');
      const steps = applyTiming(recipe.steps, args.steps_timing);
      const updated = await data.updateRecipe(recipe.id, { steps, updated_at: new Date().toISOString() });
      if (!updated) throw new Refused('La recette n’existe plus.');
      return json({ message: `Temps de « ${updated.title} » réglés : le plan est dans l’app.`, steps_timing: timingOut(updated.steps) });
    },
  },
  {
    name: 'recettes_supprimer',
    title: 'Supprimer une recette',
    description: 'Supprime une recette pour de bon, avec sa photo, son historique et ses places dans le menu. Demande confirmation avant.',
    inputSchema: { type: 'object', properties: { id: S.id }, required: ['id'] },
    annotations: { destructiveHint: true },
    async run(args, { data }) {
      const recipe = await ownRecipe(data, args.id);
      await data.deleteRecipe(recipe.id);
      return ok(`Recette « ${recipe.title} » supprimée, avec sa photo, son historique et ses places dans le menu.`);
    },
  },
  {
    name: 'recettes_menu_lister',
    title: 'Lire le menu',
    description:
      'Le menu prévu entre deux jours (par défaut, la semaine en cours, du lundi au dimanche) : pour chaque entrée, le jour, le repas (midi ou soir), la recette ou un simple titre (« Restes »), pour combien.',
    inputSchema: { type: 'object', properties: { from: S.day, to: S.day } },
    annotations: { readOnlyHint: true },
    async run(args, { data, today }) {
      const from = args.from === undefined ? mondayOf(today) : realDay(args.from, 'premier jour');
      const to = args.to === undefined ? addDays(from, 6) : realDay(args.to, 'dernier jour');
      if (to < from) throw new Refused('Le dernier jour vient avant le premier.');
      if (Date.parse(to) - Date.parse(from) > 92 * 86_400_000) throw new Refused('Trois mois au plus à la fois.');
      const [plan, recipes] = await Promise.all([data.listPlan(from, to), data.listRecipes()]);
      const titles = new Map(recipes.map((r) => [r.id, r.title]));
      const order = (m: string) => (m === 'midi' ? 0 : 1);
      return json({
        from,
        to,
        entries: plan
          .sort((a, b) => a.day.localeCompare(b.day) || order(a.meal) - order(b.meal) || a.position - b.position)
          .map((e) => ({ id: e.id, day: e.day, meal: e.meal, recipe_id: e.recipe_id, title: e.recipe_id ? titles.get(e.recipe_id) ?? e.title : e.title, servings: e.servings })),
      });
    },
  },
  {
    name: 'recettes_menu_ajouter',
    title: 'Ajouter au menu',
    description:
      'Prévoit un repas : une recette du carnet (recipe_id), ou un simple titre quand il n’y a rien à cuisiner (« Restes », « Resto »). Plusieurs entrées par repas sont possibles (un plat puis un dessert) : chacune s’ajoute à la suite.',
    inputSchema: {
      type: 'object',
      properties: {
        day: S.day,
        meal: { type: 'string', enum: [...MEALS] },
        recipe_id: S.id,
        title: { type: 'string', maxLength: PLAN_TITLE_MAX, description: 'Sans recette : ce qu’on mange.' },
        servings: { ...S.servings, description: 'Pour combien ; par défaut, celui de la recette.' },
      },
      required: ['day', 'meal'],
    },
    annotations: {},
    async run(args, { data }) {
      const day = realDay(args.day);
      const meal = String(args.meal);
      if (!(MEALS as readonly string[]).includes(meal)) throw new Refused('Le repas : midi ou soir.');
      const recipe = args.recipe_id === undefined || args.recipe_id === null ? null : await ownRecipe(data, args.recipe_id);
      const title = text(args.title, 'Le titre', PLAN_TITLE_MAX);
      if (!recipe && !title) throw new Refused('Donne une recette (recipe_id) ou un titre (« Restes »).');
      const servings = int(args.servings, 'servings (personnes)', 1, SERVINGS_MAX);
      const cell = (await data.listPlan(day, day)).filter((e) => e.meal === meal);
      const created = await data.insertPlan({
        day,
        meal,
        recipe_id: recipe?.id ?? null,
        title: recipe ? '' : title,
        servings,
        position: cell.length ? Math.max(...cell.map((e) => e.position)) + 1 : 0,
      });
      return json({ message: `Ajouté au menu du ${day}, ${meal} : ${recipe?.title ?? title}.`, entry: created });
    },
  },
  {
    name: 'recettes_menu_modifier',
    title: 'Modifier une entrée du menu',
    description: 'Déplace une entrée du menu (autre jour, autre repas), change sa recette, son titre ou pour combien.',
    inputSchema: {
      type: 'object',
      properties: {
        id: S.id,
        day: S.day,
        meal: { type: 'string', enum: [...MEALS] },
        recipe_id: { type: ['string', 'null'], description: 'Une autre recette, ou null pour un simple titre.' },
        title: { type: 'string', maxLength: PLAN_TITLE_MAX },
        servings: { type: ['integer', 'null'], minimum: 1, maximum: SERVINGS_MAX },
      },
      required: ['id'],
    },
    annotations: { idempotentHint: true },
    async run(args, { data }) {
      const entry = await data.getPlan(id(args.id));
      if (!entry) throw new Refused('Aucune entrée du menu avec cet identifiant : lis le menu d’abord.');
      const row: Record<string, unknown> = {};
      if (args.day !== undefined) row.day = realDay(args.day);
      if (args.meal !== undefined) {
        if (!(MEALS as readonly string[]).includes(String(args.meal))) throw new Refused('Le repas : midi ou soir.');
        row.meal = args.meal;
      }
      if (args.recipe_id !== undefined) row.recipe_id = args.recipe_id === null ? null : (await ownRecipe(data, args.recipe_id)).id;
      if (args.title !== undefined) row.title = text(args.title, 'Le titre', PLAN_TITLE_MAX);
      if (args.servings !== undefined) row.servings = int(args.servings, 'servings (personnes)', 1, SERVINGS_MAX);
      if (Object.keys(row).length === 0) throw new Refused('Rien à modifier : donne au moins un champ.');
      const recipeId = row.recipe_id !== undefined ? row.recipe_id : entry.recipe_id;
      const title = row.title !== undefined ? row.title : entry.title;
      if (!recipeId && !title) throw new Refused('Sans recette, l’entrée a besoin d’un titre (« Restes »).');
      const updated = await data.updatePlan(entry.id, row);
      return json({ message: 'Entrée du menu modifiée.', entry: updated });
    },
  },
  {
    name: 'recettes_menu_retirer',
    title: 'Retirer une entrée du menu',
    description: 'Retire une entrée du menu. La recette, elle, reste dans le carnet.',
    inputSchema: { type: 'object', properties: { id: S.id }, required: ['id'] },
    annotations: { destructiveHint: true },
    async run(args, { data }) {
      const entry = await data.getPlan(id(args.id));
      if (!entry) throw new Refused('Aucune entrée du menu avec cet identifiant.');
      await data.deletePlan(entry.id);
      return ok(`Entrée du ${entry.day}, ${entry.meal}, retirée du menu.`);
    },
  },
  {
    name: 'recettes_faite_ajouter',
    title: 'Noter une recette faite',
    description: '« Je l’ai faite » : le jour (aujourd’hui par défaut), pour combien, une note de 1 à 5 et un mot.',
    inputSchema: {
      type: 'object',
      properties: {
        recipe_id: S.id,
        day: S.day,
        servings: S.servings,
        rating: { type: 'integer', minimum: 1, maximum: 5 },
        comment: { type: 'string', maxLength: 1000 },
      },
      required: ['recipe_id'],
    },
    annotations: {},
    async run(args, { data, today }) {
      const recipe = await ownRecipe(data, args.recipe_id);
      const created = await data.insertCooked({
        recipe_id: recipe.id,
        day: args.day === undefined ? today : realDay(args.day),
        servings: int(args.servings, 'servings (personnes)', 1, SERVINGS_MAX),
        rating: int(args.rating, 'La note', 1, 5),
        comment: text(args.comment, 'Le commentaire', 1000),
      });
      return json({ message: `« ${recipe.title} » notée comme faite le ${created.day}.`, cooked: created });
    },
  },
  {
    name: 'recettes_faite_modifier',
    title: 'Modifier une fois où la recette a été faite',
    description: 'Change le jour, pour combien, la note ou le commentaire d’une fois notée (son id est dans recettes_lire).',
    inputSchema: {
      type: 'object',
      properties: {
        id: S.id,
        day: S.day,
        servings: { type: ['integer', 'null'], minimum: 1, maximum: SERVINGS_MAX },
        rating: { type: ['integer', 'null'], minimum: 1, maximum: 5 },
        comment: { type: 'string', maxLength: 1000 },
      },
      required: ['id'],
    },
    annotations: { idempotentHint: true },
    async run(args, { data }) {
      const cooked = await data.getCooked(id(args.id));
      if (!cooked) throw new Refused('Aucune fois notée avec cet identifiant.');
      const row: Record<string, unknown> = {};
      if (args.day !== undefined) row.day = realDay(args.day);
      if (args.servings !== undefined) row.servings = int(args.servings, 'servings (personnes)', 1, SERVINGS_MAX);
      if (args.rating !== undefined) row.rating = int(args.rating, 'La note', 1, 5);
      if (args.comment !== undefined) row.comment = text(args.comment, 'Le commentaire', 1000);
      if (Object.keys(row).length === 0) throw new Refused('Rien à modifier : donne au moins un champ.');
      return json({ message: 'Modifié.', cooked: await data.updateCooked(cooked.id, row) });
    },
  },
  {
    name: 'recettes_faite_retirer',
    title: 'Retirer une fois où la recette a été faite',
    description: 'Retire une fois notée par erreur (son id est dans recettes_lire).',
    inputSchema: { type: 'object', properties: { id: S.id }, required: ['id'] },
    annotations: { destructiveHint: true },
    async run(args, { data }) {
      const cooked = await data.getCooked(id(args.id));
      if (!cooked) throw new Refused('Aucune fois notée avec cet identifiant.');
      await data.deleteCooked(cooked.id);
      return ok(`La fois du ${cooked.day} est retirée.`);
    },
  },
  {
    name: 'recettes_toujours_la',
    title: 'Ingrédients « toujours là »',
    description:
      'Les ingrédients qu’on a toujours chez soi (sel, huile…), décochés d’office quand une recette part dans la liste de courses. Sans argument, rend la liste ; avec « add » et « remove », la modifie ; « replace » la remplace entière.',
    inputSchema: {
      type: 'object',
      properties: {
        add: { type: 'array', items: { type: 'string' } },
        remove: { type: 'array', items: { type: 'string' } },
        replace: { type: 'array', items: { type: 'string' } },
      },
    },
    annotations: {},
    async run(args, { data }) {
      const current = (await data.getPantry()) ?? DEFAULT_PANTRY;
      if (args.add === undefined && args.remove === undefined && args.replace === undefined) return json({ pantry: current });
      let next = args.replace === undefined ? [...current] : stringList(args.replace, 'replace', PANTRY_MAX, 80);
      if (args.add !== undefined) {
        for (const item of stringList(args.add, 'add', PANTRY_MAX, 80)) if (!next.some((p) => fold(p) === fold(item))) next.push(item);
      }
      if (args.remove !== undefined) {
        const gone = new Set(stringList(args.remove, 'remove', PANTRY_MAX, 80).map(fold));
        next = next.filter((p) => !gone.has(fold(p)));
      }
      if (next.length > PANTRY_MAX) throw new Refused(`${PANTRY_MAX} ingrédients au plus.`);
      await data.setPantry(next);
      return json({ message: 'Liste mise à jour.', pantry: next });
    },
  },
];
