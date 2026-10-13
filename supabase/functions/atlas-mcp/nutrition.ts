/**
 * Les outils de Nutrition pour Claude (docs/connecteur-claude.md §17) —
 * règles pures, testées par Vitest (`src/modules/nutrition/lib/mcpTools.test.ts`).
 *
 * Priorité n° 7 de l'analyse du 11/10/2026 : « ce midi, 150 g de riz et un
 * filet de poulet », la photo d'une assiette, « où j'en suis aujourd'hui ? ».
 * Claude cherche d'abord dans les aliments de Jules et dans la table CIQUAL
 * (la même que l'app, copiée à côté et comparée par le test) : les valeurs
 * sont alors celles de la table, remises au poids. À défaut (un plat de
 * restaurant), il note une **estimation** qu'il dit comme telle, avec les
 * valeurs du plat entier.
 *
 * Comme dans l'app, les valeurs d'une entrée sont figées à la saisie
 * (`nutrition_entries`), et corriger le poids les remet à l'échelle.
 */
import type { Tool, ToolResult } from './mcp.ts';

export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type Meal = (typeof MEALS)[number];
export const MEAL_LABELS: Record<Meal, string> = { breakfast: 'Petit-déjeuner', lunch: 'Déjeuner', dinner: 'Dîner', snack: 'Collation' };
const LABEL_MAX = 160;
const GRAMS_MAX = 10000;
const RECENT_DAYS = 60;

/** Une ligne de la table embarquée : code, nom, kcal, protéines, glucides, lipides (dg / 100 g), fibres. */
export type CiqualRow = [string, string, number, number, number, number, number | null];

export interface NutrientValues {
  kcal: number;
  proteinDg: number;
  carbsDg: number;
  fatDg: number;
}

export interface EntryRow {
  id: string;
  day: string;
  meal: Meal;
  food_id: string | null;
  ciqual_code: string | null;
  label: string;
  grams: number;
  kcal: number;
  protein_dg: number;
  carbs_dg: number;
  fat_dg: number;
  created_at: string;
}

export interface FoodRow {
  id: string;
  name: string;
  brand: string | null;
  kcal: number;
  protein_dg: number;
  carbs_dg: number;
  fat_dg: number;
  serving_grams: number | null;
  favorite: boolean;
}

export interface TargetRow {
  effective_from: string;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface NutritionData {
  ciqual(): CiqualRow[];
  listEntries(from: string, to: string): Promise<EntryRow[]>;
  getEntry(id: string): Promise<EntryRow | null>;
  insertEntries(rows: Record<string, unknown>[]): Promise<EntryRow[]>;
  updateEntry(id: string, row: Record<string, unknown>): Promise<EntryRow | null>;
  deleteEntry(id: string): Promise<boolean>;
  listFoods(): Promise<FoodRow[]>;
  listTargets(): Promise<TargetRow[]>;
}

export interface NutritionContext {
  data: NutritionData;
  today: string;
}

// --- Les règles du module, recopiées (le test les compare) ----------------------

export function valuesForGrams(per100g: NutrientValues, grams: number): NutrientValues {
  const scale = (v: number) => Math.round((v * grams) / 100);
  return { kcal: scale(per100g.kcal), proteinDg: scale(per100g.proteinDg), carbsDg: scale(per100g.carbsDg), fatDg: scale(per100g.fatDg) };
}

export function rescale(entry: Pick<EntryRow, 'grams' | 'kcal' | 'protein_dg' | 'carbs_dg' | 'fat_dg'>, grams: number) {
  const scale = (v: number) => Math.round((v * grams) / entry.grams);
  return { grams, kcal: scale(entry.kcal), protein_dg: scale(entry.protein_dg), carbs_dg: scale(entry.carbs_dg), fat_dg: scale(entry.fat_dg) };
}

export function targetForDay(targets: readonly TargetRow[], day: string): TargetRow | null {
  let found: TargetRow | null = null;
  for (const target of targets) {
    if (target.effective_from <= day && (!found || target.effective_from > found.effective_from)) found = target;
  }
  return found;
}

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function stem(word: string): string {
  return word.length > 3 && /[sx]$/.test(word) ? word.slice(0, -1) : word;
}

function words(text: string): string[] {
  const norm = normalize(text);
  return norm ? norm.split(' ').map(stem) : [];
}

/** `searchFoods` du module : tous les mots tapés commencent un mot du nom ; priorité, puis position, puis nom court. */
export function searchFoods<T>(items: readonly T[], nameOf: (item: T) => string, query: string, priority: (item: T) => number = () => 0, limit = 30): T[] {
  const tokens = words(query);
  if (tokens.length === 0) return [];
  const matches: { item: T; position: number; priority: number; length: number }[] = [];
  for (const item of items) {
    const name = nameOf(item);
    const own = words(name);
    let firstPosition = -1;
    let all = true;
    for (let t = 0; t < tokens.length; t++) {
      const position = own.findIndex((w) => w.startsWith(tokens[t]));
      if (position === -1) {
        all = false;
        break;
      }
      if (t === 0) firstPosition = position;
    }
    if (all) matches.push({ item, position: firstPosition, priority: priority(item), length: name.length });
  }
  matches.sort((a, b) => b.priority - a.priority || a.position - b.position || a.length - b.length);
  return matches.slice(0, limit).map((m) => m.item);
}

// --- Les outils ---------------------------------------------------------------

class Refused extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const json = (value: unknown): ToolResult => ({ text: JSON.stringify(value, null, 2) });
const g = (dg: number) => Math.round(dg) / 10;

function shiftDay(day: string, offset: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

function day(v: unknown, today: string, what = 'day'): string {
  if (v === undefined) return today;
  if (typeof v !== 'string' || !DAY.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) throw new Refused(`${what} s’écrit AAAA-MM-JJ.`);
  return v;
}

const MEAL_WORDS: Record<string, Meal> = {
  breakfast: 'breakfast',
  'petit dejeuner': 'breakfast',
  petit_dejeuner: 'breakfast',
  lunch: 'lunch',
  dejeuner: 'lunch',
  midi: 'lunch',
  dinner: 'dinner',
  diner: 'dinner',
  soir: 'dinner',
  snack: 'snack',
  collation: 'snack',
  gouter: 'snack',
};

export function readMeal(v: unknown): Meal {
  const key = typeof v === 'string' ? normalize(v) : '';
  const meal = MEAL_WORDS[key] ?? MEAL_WORDS[key.replace(/ /g, '_')];
  if (!meal) throw new Refused('meal : breakfast (petit-déjeuner), lunch (déjeuner), dinner (dîner) ou snack (collation).');
  return meal;
}

function grams(v: unknown, what: string): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n < 1 || n > GRAMS_MAX) throw new Refused(`${what} : un poids en grammes, de 1 à ${GRAMS_MAX}.`);
  return Math.round(n);
}

function macro(v: unknown, what: string, max: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max) throw new Refused(`${what} : un nombre de 0 à ${max}.`);
  return n;
}

const entryOut = (e: EntryRow) => ({
  id: e.id,
  label: e.label,
  grams: e.grams,
  kcal: e.kcal,
  protein_g: g(e.protein_dg),
  carbs_g: g(e.carbs_dg),
  fat_g: g(e.fat_dg),
  source: e.ciqual_code ? 'CIQUAL' : e.food_id ? 'mon aliment' : 'estimation',
});

function totals(entries: readonly EntryRow[]) {
  const sum = (k: 'kcal' | 'protein_dg' | 'carbs_dg' | 'fat_dg') => entries.reduce((s, e) => s + e[k], 0);
  return { kcal: sum('kcal'), protein_g: g(sum('protein_dg')), carbs_g: g(sum('carbs_dg')), fat_g: g(sum('fat_dg')) };
}

/** Une référence d'aliment, telle que nutrition_chercher la rend. */
interface Candidate {
  ref: string;
  name: string;
  per100g: NutrientValues;
  ciqualCode: string | null;
  foodId: string | null;
  servingGrams: number | null;
  favorite: boolean;
}

function candidates(data: NutritionData, foods: FoodRow[]): Candidate[] {
  return [
    ...foods.map((f) => ({
      ref: `food:${f.id}`,
      name: f.brand ? `${f.name} (${f.brand})` : f.name,
      per100g: { kcal: f.kcal, proteinDg: f.protein_dg, carbsDg: f.carbs_dg, fatDg: f.fat_dg },
      ciqualCode: null,
      foodId: f.id,
      servingGrams: f.serving_grams,
      favorite: f.favorite,
    })),
    ...data.ciqual().map(([code, name, kcal, proteinDg, carbsDg, fatDg]) => ({
      ref: `ciqual:${code}`,
      name,
      per100g: { kcal, proteinDg, carbsDg, fatDg },
      ciqualCode: code,
      foodId: null,
      servingGrams: null,
      favorite: false,
    })),
  ];
}

const keyOf = (e: Pick<EntryRow, 'ciqual_code' | 'food_id'>) => (e.ciqual_code ? `ciqual:${e.ciqual_code}` : e.food_id ? `food:${e.food_id}` : null);

export const nutritionTools: Tool<NutritionContext>[] = [
  {
    name: 'nutrition_journal',
    title: 'Le journal d’un jour',
    description:
      'Ce qui a été mangé un jour (aujourd’hui par défaut), repas par repas, avec le total, l’objectif du jour (en grammes de macros, kcal déduites) et ce qu’il reste. Avec from et to : le total de chaque jour de la période.',
    inputSchema: { type: 'object', properties: { day: { type: 'string' }, from: { type: 'string' }, to: { type: 'string' } } },
    annotations: { readOnlyHint: true },
    async run(args, { data, today }) {
      const targets = await data.listTargets();
      const goalOf = (d: string) => {
        const t = targetForDay(targets, d);
        return t ? { kcal: t.protein_g * 4 + t.carbs_g * 4 + t.fat_g * 9, protein_g: t.protein_g, carbs_g: t.carbs_g, fat_g: t.fat_g } : null;
      };
      if (args.from !== undefined || args.to !== undefined) {
        const from = day(args.from, today, 'from');
        const to = day(args.to, today, 'to');
        if (to < from) throw new Refused('to avant from.');
        const entries = await data.listEntries(from, to);
        const days: string[] = [];
        for (let d = from; d <= to && days.length < 93; d = shiftDay(d, 1)) days.push(d);
        return json({
          from,
          to,
          days: days.map((d) => {
            const mine = entries.filter((e) => e.day === d);
            return { day: d, logged: mine.length > 0, ...(mine.length ? totals(mine) : {}), target_kcal: goalOf(d)?.kcal };
          }),
        });
      }
      const at = day(args.day, today);
      const entries = await data.listEntries(at, at);
      const total = totals(entries);
      const target = goalOf(at);
      return json({
        day: at,
        meals: MEALS.map((m) => ({ meal: m, label: MEAL_LABELS[m], entries: entries.filter((e) => e.meal === m).map(entryOut) })).filter((m) => m.entries.length),
        total,
        target,
        remaining: target
          ? { kcal: target.kcal - total.kcal, protein_g: g(target.protein_g * 10 - total.protein_g * 10), carbs_g: g(target.carbs_g * 10 - total.carbs_g * 10), fat_g: g(target.fat_g * 10 - total.fat_g * 10) }
          : undefined,
      });
    },
  },
  {
    name: 'nutrition_chercher',
    title: 'Chercher un aliment',
    description:
      'Cherche un aliment dans ceux de Jules (favoris et récents d’abord) et dans la table CIQUAL de l’ANSES : ref à donner à nutrition_ajouter, valeurs pour 100 g, portion habituelle, dernier poids noté. Cherche par mots simples (« riz blanc cuit », « poulet filet »).',
    inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'integer', minimum: 1, maximum: 30 } }, required: ['query'] },
    annotations: { readOnlyHint: true },
    async run(args, { data, today }) {
      if (typeof args.query !== 'string' || !args.query.trim()) throw new Refused('query : quelques mots.');
      const [foods, recent] = await Promise.all([data.listFoods(), data.listEntries(shiftDay(today, -RECENT_DAYS), today)]);
      // Les plus récents d'abord, comme la fenêtre d'ajout de l'app.
      const order: string[] = [];
      const lastGrams = new Map<string, number>();
      for (const e of [...recent].sort((a, b) => b.day.localeCompare(a.day) || b.created_at.localeCompare(a.created_at))) {
        const key = keyOf(e);
        if (key && !lastGrams.has(key)) {
          lastGrams.set(key, e.grams);
          order.push(key);
        }
      }
      const rank = new Map(order.map((key, i) => [key, order.length - i]));
      const boost = order.length + 1;
      const found = searchFoods(candidates(data, foods), (c) => c.name, args.query, (c) => (c.favorite ? boost : 0) + (rank.get(c.ref) ?? 0), Number(args.limit ?? 15));
      return json({
        results: found.map((c) => ({
          ref: c.ref,
          name: c.name,
          per_100g: { kcal: c.per100g.kcal, protein_g: g(c.per100g.proteinDg), carbs_g: g(c.per100g.carbsDg), fat_g: g(c.per100g.fatDg) },
          serving_grams: c.servingGrams ?? undefined,
          last_grams: lastGrams.get(c.ref),
          mine: c.foodId ? true : undefined,
        })),
      });
    },
  },
  {
    name: 'nutrition_ajouter',
    title: 'Noter un repas',
    description:
      'Note ce qui a été mangé, à un repas (breakfast, lunch, dinner, snack) d’un jour (aujourd’hui par défaut). Chaque item : soit { ref, grams } (ref de nutrition_chercher : les valeurs viennent de la table), soit une estimation { label, grams, kcal, protein_g, carbs_g, fat_g } pour la portion entière — seulement si rien ne convient, et dis-le à Jules.',
    inputSchema: {
      type: 'object',
      properties: {
        day: { type: 'string' },
        meal: { type: 'string', enum: [...MEALS] },
        items: {
          type: 'array',
          minItems: 1,
          maxItems: 30,
          items: {
            type: 'object',
            properties: {
              ref: { type: 'string', description: 'ciqual:<code> ou food:<id>' },
              grams: { type: 'number' },
              label: { type: 'string', maxLength: LABEL_MAX },
              kcal: { type: 'number' },
              protein_g: { type: 'number' },
              carbs_g: { type: 'number' },
              fat_g: { type: 'number' },
            },
            required: ['grams'],
          },
        },
      },
      required: ['meal', 'items'],
    },
    annotations: {},
    async run(args, { data, today }) {
      const at = day(args.day, today);
      const meal = readMeal(args.meal);
      if (!Array.isArray(args.items) || args.items.length === 0) throw new Refused('items : au moins un aliment.');
      if (args.items.length > 30) throw new Refused('30 aliments au plus par envoi.');
      const pool = new Map(candidates(data, await data.listFoods()).map((c) => [c.ref, c]));
      const rows = args.items.map((raw, i) => {
        const o = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
        const weight = grams(o.grams, `items[${i}].grams`);
        if (typeof o.ref === 'string' && o.ref) {
          const c = pool.get(o.ref.trim().toLowerCase().startsWith('food:') ? `food:${o.ref.trim().slice(5).toLowerCase()}` : o.ref.trim());
          if (!c) throw new Refused(`items[${i}].ref « ${o.ref} » inconnue : prends-la dans nutrition_chercher.`);
          const v = valuesForGrams(c.per100g, weight);
          return { label: c.name.slice(0, LABEL_MAX), ciqual_code: c.ciqualCode, food_id: c.foodId, grams: weight, kcal: v.kcal, protein_dg: v.proteinDg, carbs_dg: v.carbsDg, fat_dg: v.fatDg };
        }
        const label = typeof o.label === 'string' ? o.label.trim() : '';
        if (!label) throw new Refused(`items[${i}] : une ref (nutrition_chercher), ou une estimation avec label, kcal, protein_g, carbs_g, fat_g.`);
        return {
          label: `${label} (estimation)`.slice(0, LABEL_MAX),
          ciqual_code: null,
          food_id: null,
          grams: weight,
          kcal: Math.round(macro(o.kcal, `items[${i}].kcal`, 20000)),
          protein_dg: Math.round(macro(o.protein_g, `items[${i}].protein_g`, 2000) * 10),
          carbs_dg: Math.round(macro(o.carbs_g, `items[${i}].carbs_g`, 2000) * 10),
          fat_dg: Math.round(macro(o.fat_g, `items[${i}].fat_g`, 2000) * 10),
        };
      });
      const created = await data.insertEntries(rows.map((r) => ({ ...r, day: at, meal })));
      const dayEntries = await data.listEntries(at, at);
      return json({ message: `${created.length} aliment${created.length > 1 ? 's' : ''} noté${created.length > 1 ? 's' : ''} au ${MEAL_LABELS[meal].toLowerCase()} du ${at}.`, added: created.map(entryOut), day_total: totals(dayEntries) });
    },
  },
  {
    name: 'nutrition_modifier',
    title: 'Corriger une entrée',
    description: 'Change le poids d’une entrée du journal (ses valeurs suivent, remises à l’échelle), ou la range dans un autre repas.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, grams: { type: 'number' }, meal: { type: 'string', enum: [...MEALS] } }, required: ['id'] },
    annotations: { idempotentHint: true },
    async run(args, { data }) {
      const id = typeof args.id === 'string' && UUID.test(args.id) ? args.id.toLowerCase() : null;
      if (!id) throw new Refused('id invalide : prends-le dans nutrition_journal.');
      const entry = await data.getEntry(id);
      if (!entry) throw new Refused('Aucune entrée avec cet id.');
      const row: Record<string, unknown> = {};
      if (args.grams !== undefined) Object.assign(row, rescale(entry, grams(args.grams, 'grams')));
      if (args.meal !== undefined) row.meal = readMeal(args.meal);
      if (Object.keys(row).length === 0) throw new Refused('Donne grams ou meal.');
      const updated = await data.updateEntry(id, row);
      return json({ message: 'Entrée corrigée.', entry: updated && entryOut(updated) });
    },
  },
  {
    name: 'nutrition_supprimer',
    title: 'Retirer une entrée',
    description: 'Retire une entrée du journal.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    annotations: { destructiveHint: true },
    async run(args, { data }) {
      const id = typeof args.id === 'string' && UUID.test(args.id) ? args.id.toLowerCase() : null;
      if (!id) throw new Refused('id invalide : prends-le dans nutrition_journal.');
      const entry = await data.getEntry(id);
      if (!entry || !(await data.deleteEntry(id))) throw new Refused('Aucune entrée avec cet id.');
      return { text: `« ${entry.label} » (${entry.grams} g) retiré du ${entry.day}.` };
    },
  },
];
