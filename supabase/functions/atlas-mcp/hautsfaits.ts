/**
 * Les outils de Hauts faits pour Claude (docs/connecteur-claude.md §19) —
 * règles pures, testées par Vitest (`src/modules/hautsfaits/lib/mcpTools.test.ts`).
 *
 * Dernier de la liste du 11/10/2026 : raconter un souvenir à Claude et qu'il
 * en fasse un haut fait — titre, catégorie, date **à la précision qu'on
 * connaît** (« 2019 », « 2019-06 », « 2019-06-14 »), lieu, avec qui, récit —
 * ou relire la frise (« qu'est-ce que j'ai fait en 2022 ? »). Les photos
 * restent à l'app : elles se choisissent, se réduisent et se rangent sur
 * l'appareil. Un haut fait qui a des photos ne se supprime donc pas ici
 * (ses fichiers resteraient dans le stockage).
 */
import type { Tool, ToolResult } from './mcp.ts';

export const FEAT_CATEGORIES = ['etudes', 'sport', 'voyage', 'chezsoi', 'travail', 'proches', 'creation', 'autre'] as const;
export type FeatCategory = (typeof FEAT_CATEGORIES)[number];
export const CATEGORY_LABELS: Record<FeatCategory, string> = {
  etudes: 'Études',
  sport: 'Sport',
  voyage: 'Voyage',
  chezsoi: 'Chez-soi',
  travail: 'Travail',
  proches: 'Famille & amis',
  creation: 'Création',
  autre: 'Autre',
};
export const DATE_PRECISIONS = ['day', 'month', 'year'] as const;
export type DatePrecision = (typeof DATE_PRECISIONS)[number];
export const FEAT_TITLE_MAX = 200;
export const FEAT_HIGHLIGHT_MAX = 60;
export const FEAT_PLACE_MAX = 120;
export const FEAT_PEOPLE_MAX = 200;
export const FEAT_STORY_MAX = 4000;

export interface FeatRow {
  id: string;
  title: string;
  category: FeatCategory;
  date_start: string;
  date_precision: DatePrecision;
  date_end: string | null;
  date_end_precision: DatePrecision | null;
  major: boolean;
  highlight: string;
  place: string;
  people: string;
  story: string;
  created_at: string;
}

export interface HautsFaitsData {
  listFeats(): Promise<FeatRow[]>;
  /** Le nombre de photos de chaque haut fait. */
  photoCounts(): Promise<Map<string, number>>;
  insertFeat(row: Record<string, unknown>): Promise<FeatRow>;
  updateFeat(id: string, row: Record<string, unknown>): Promise<FeatRow | null>;
  deleteFeat(id: string): Promise<boolean>;
}

export interface HautsFaitsContext {
  data: HautsFaitsData;
  today: string;
}

// --- Les dates (copies de `lib/dates.ts` et de `validateFeat`) ------------------

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const parts = (day: string) => day.split('-').map(Number) as [number, number, number];
const pad = (n: number) => String(n).padStart(2, '0');

export function alignDate(day: string, precision: DatePrecision): string {
  const [y, m] = parts(day);
  if (precision === 'year') return `${y}-01-01`;
  if (precision === 'month') return `${y}-${pad(m)}-01`;
  return day;
}

export function formatFeatDate(day: string, precision: DatePrecision): string {
  const [y, m, d] = parts(day);
  if (precision === 'year') return String(y);
  if (precision === 'month') return `${MONTHS[m - 1]} ${y}`;
  return `${d === 1 ? '1er' : d} ${MONTHS[m - 1]} ${y}`;
}

export function formatFeatSpan(feat: { dateStart: string; datePrecision: DatePrecision; dateEnd: string | null; dateEndPrecision: DatePrecision | null }): string {
  const start = formatFeatDate(feat.dateStart, feat.datePrecision);
  if (!feat.dateEnd) return start;
  const endPrecision = feat.dateEndPrecision ?? feat.datePrecision;
  const end = formatFeatDate(feat.dateEnd, endPrecision);
  if (start === end) return start;
  if (feat.datePrecision !== endPrecision || feat.datePrecision === 'year') return `${start} – ${end}`;
  const [ys, ms, ds] = parts(feat.dateStart);
  const [ye, me] = parts(feat.dateEnd);
  if (ys !== ye) return `${start} – ${end}`;
  if (feat.datePrecision === 'month') return `${MONTHS[ms - 1]} – ${end}`;
  if (ms === me) return `${ds === 1 ? '1er' : ds} – ${end}`;
  return `${ds === 1 ? '1er' : ds} ${MONTHS[ms - 1]} – ${end}`;
}

function isRealDay(day: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export interface FeatInput {
  title: string;
  category: FeatCategory;
  dateStart: string;
  datePrecision: DatePrecision;
  dateEnd?: string | null;
  dateEndPrecision?: DatePrecision | null;
  highlight?: string;
  place?: string;
  people?: string;
  story?: string;
}

export function validateFeat(input: FeatInput, today: string): string | null {
  const title = input.title.trim();
  if (!title) return 'Donne un titre à ce haut fait.';
  if (title.length > FEAT_TITLE_MAX) return `Le titre est trop long (${FEAT_TITLE_MAX} caractères au plus).`;
  if (!(FEAT_CATEGORIES as readonly string[]).includes(input.category)) return 'Choisis une catégorie.';
  if (!(DATE_PRECISIONS as readonly string[]).includes(input.datePrecision)) return 'Précision de date inconnue.';
  if (!isRealDay(input.dateStart)) return 'Date invalide.';
  if (alignDate(input.dateStart, input.datePrecision) !== input.dateStart) return 'La date doit être rangée au début de sa période.';
  if (input.dateStart > today) return 'Un haut fait est déjà arrivé : sa date ne peut pas être après aujourd’hui.';
  if (input.dateEnd) {
    const endPrecision = input.dateEndPrecision ?? input.datePrecision;
    if (!isRealDay(input.dateEnd)) return 'Date de fin invalide.';
    if (alignDate(input.dateEnd, endPrecision) !== input.dateEnd) return 'La date de fin doit être rangée au début de sa période.';
    if (input.dateEnd < input.dateStart) return 'La fin est avant le début.';
    if (input.dateEnd === input.dateStart && endPrecision === input.datePrecision) return 'La fin est la même que le début : retire-la.';
  } else if (input.dateEndPrecision) {
    return 'Une précision de fin sans date de fin.';
  }
  if ((input.highlight ?? '').trim().length > FEAT_HIGHLIGHT_MAX) return `Le chiffre clé est trop long (${FEAT_HIGHLIGHT_MAX} caractères au plus).`;
  if ((input.place ?? '').trim().length > FEAT_PLACE_MAX) return `Le lieu est trop long (${FEAT_PLACE_MAX} caractères au plus).`;
  if ((input.people ?? '').trim().length > FEAT_PEOPLE_MAX) return `« Avec qui » est trop long (${FEAT_PEOPLE_MAX} caractères au plus).`;
  if ((input.story ?? '').length > FEAT_STORY_MAX) return `Le récit est trop long (${FEAT_STORY_MAX} caractères au plus).`;
  return null;
}

class Refused extends Error {}

/** « 2019 », « 2019-06 », « 2019-06-14 » → la date rangée au début de sa période, et sa précision. */
export function readFeatDate(v: unknown, what: string): { day: string; precision: DatePrecision } {
  const s = typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '';
  if (/^\d{4}$/.test(s)) return { day: `${s}-01-01`, precision: 'year' };
  if (/^\d{4}-\d{2}$/.test(s) && isRealDay(`${s}-01`)) return { day: `${s}-01`, precision: 'month' };
  if (isRealDay(s)) return { day: s, precision: 'day' };
  throw new Refused(`${what} : « AAAA » si tu ne sais que l’année, « AAAA-MM » le mois, « AAAA-MM-JJ » le jour.`);
}

// --- Les outils ---------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (value: unknown): ToolResult => ({ text: JSON.stringify(value, null, 2) });
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const CATEGORY_IN: Record<string, FeatCategory> = Object.fromEntries([
  ...FEAT_CATEGORIES.map((c) => [c, c]),
  ...FEAT_CATEGORIES.map((c) => [fold(CATEGORY_LABELS[c]), c]),
  ['chez soi', 'chezsoi'],
  ['famille', 'proches'],
  ['amis', 'proches'],
]);

function category(v: unknown): FeatCategory {
  const c = CATEGORY_IN[fold(String(v ?? ''))];
  if (!c) throw new Refused(`category : ${FEAT_CATEGORIES.map((k) => `${k} (${CATEGORY_LABELS[k]})`).join(', ')}.`);
  return c;
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

const featOut = (f: FeatRow, photos: Map<string, number>, full = true) => ({
  id: f.id,
  title: f.title,
  when: formatFeatSpan({ dateStart: f.date_start, datePrecision: f.date_precision, dateEnd: f.date_end, dateEndPrecision: f.date_end_precision }),
  category: CATEGORY_LABELS[f.category],
  major: f.major || undefined,
  highlight: f.highlight || undefined,
  place: f.place || undefined,
  people: f.people || undefined,
  story: f.story ? (full || f.story.length <= 200 ? f.story : `${f.story.slice(0, 199)}…`) : undefined,
  photos: photos.get(f.id) || undefined,
});

/** Les champs d'un haut fait → colonnes, validées par la règle du module. */
function columns(args: Record<string, unknown>, current: FeatRow | null, today: string): Record<string, unknown> {
  const has = (k: string) => args[k] !== undefined;
  const start = has('date') ? readFeatDate(args.date, 'date') : current ? { day: current.date_start, precision: current.date_precision } : readFeatDate(undefined, 'date');
  const end =
    has('date_end') && args.date_end !== null
      ? readFeatDate(args.date_end, 'date_end')
      : has('date_end')
        ? null
        : current?.date_end
          ? { day: current.date_end, precision: current.date_end_precision ?? current.date_precision }
          : null;
  const input: FeatInput = {
    title: has('title') ? str(args.title) : (current?.title ?? ''),
    category: has('category') ? category(args.category) : (current?.category ?? category(undefined)),
    dateStart: start.day,
    datePrecision: start.precision,
    dateEnd: end?.day ?? null,
    dateEndPrecision: end?.precision ?? null,
    highlight: has('highlight') ? str(args.highlight) : (current?.highlight ?? ''),
    place: has('place') ? str(args.place) : (current?.place ?? ''),
    people: has('people') ? str(args.people) : (current?.people ?? ''),
    story: has('story') ? (typeof args.story === 'string' ? args.story.trim() : '') : (current?.story ?? ''),
  };
  const problem = validateFeat(input, today);
  if (problem) throw new Refused(problem);
  return {
    title: input.title.trim(),
    category: input.category,
    date_start: input.dateStart,
    date_precision: input.datePrecision,
    date_end: input.dateEnd,
    date_end_precision: input.dateEndPrecision,
    major: has('major') ? args.major === true : (current?.major ?? false),
    highlight: input.highlight!.trim(),
    place: input.place!.trim(),
    people: input.people!.trim(),
    story: input.story,
    updated_at: new Date().toISOString(),
  };
}

const FIELDS = {
  title: { type: 'string', maxLength: FEAT_TITLE_MAX },
  category: { type: 'string', enum: [...FEAT_CATEGORIES] },
  date: { type: 'string', description: '« AAAA », « AAAA-MM » ou « AAAA-MM-JJ » : la précision qu’on connaît vraiment.' },
  date_end: { type: ['string', 'null'], description: 'Pour une période (six mois à l’étranger), même format.' },
  major: { type: 'boolean', description: 'Un moment majeur, mis en avant sur la frise.' },
  highlight: { type: 'string', maxLength: FEAT_HIGHLIGHT_MAX, description: 'Le chiffre clé (« 1 h 52 », « mention bien »).' },
  place: { type: 'string', maxLength: FEAT_PLACE_MAX },
  people: { type: 'string', maxLength: FEAT_PEOPLE_MAX, description: 'Avec qui.' },
  story: { type: 'string', maxLength: FEAT_STORY_MAX, description: 'Le récit, à la première personne si Jules le raconte ainsi.' },
};

export const hautsfaitsTools: Tool<HautsFaitsContext>[] = [
  {
    name: 'hautsfaits_frise',
    title: 'La frise des hauts faits',
    description: 'Les hauts faits, du plus récent au plus ancien : titre, date (à sa précision), catégorie, chiffre clé, lieu, avec qui, récit, nombre de photos. Filtres : year, category, query.',
    inputSchema: { type: 'object', properties: { year: { type: 'integer' }, category: { type: 'string', enum: [...FEAT_CATEGORIES] }, query: { type: 'string' } } },
    annotations: { readOnlyHint: true },
    async run(args, { data }) {
      const [feats, photos] = await Promise.all([data.listFeats(), data.photoCounts()]);
      const cat = args.category === undefined ? null : category(args.category);
      const words = typeof args.query === 'string' ? fold(args.query).split(/\s+/).filter(Boolean) : [];
      const year = typeof args.year === 'number' ? args.year : null;
      const shown = feats
        .filter((f) => !cat || f.category === cat)
        .filter((f) => year === null || (Number(f.date_start.slice(0, 4)) <= year && Number((f.date_end ?? f.date_start).slice(0, 4)) >= year))
        .filter((f) => words.every((w) => fold(`${f.title} ${f.place} ${f.people} ${f.story} ${f.highlight}`).includes(w)))
        .sort((a, b) => b.date_start.localeCompare(a.date_start) || b.created_at.localeCompare(a.created_at));
      return json({ total: shown.length, feats: shown.map((f) => featOut(f, photos, shown.length <= 30)) });
    },
  },
  {
    name: 'hautsfaits_ajouter',
    title: 'Ajouter un haut fait',
    description:
      'Ajoute un grand moment de la vie de Jules (un diplôme, une course, un voyage, un appartement…), jamais à venir. Ne mets que ce qui a été dit ; la date à la précision connue. Les photos s’ajoutent ensuite dans l’app.',
    inputSchema: { type: 'object', properties: FIELDS, required: ['title', 'category', 'date'] },
    annotations: {},
    async run(args, { data, today }) {
      const created = await data.insertFeat(columns(args, null, today));
      return json({ message: `Haut fait ajouté à la frise : « ${created.title} ».`, feat: featOut(created, new Map()) });
    },
  },
  {
    name: 'hautsfaits_modifier',
    title: 'Modifier un haut fait',
    description: 'Change un haut fait (id dans hautsfaits_frise) : ne donne que les champs à changer ; date_end: null retire la fin.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' }, ...FIELDS }, required: ['id'] },
    annotations: { idempotentHint: true },
    async run(args, { data, today }) {
      const id = typeof args.id === 'string' && UUID.test(args.id) ? args.id.toLowerCase() : null;
      if (!id) throw new Refused('id invalide : prends-le dans hautsfaits_frise.');
      const current = (await data.listFeats()).find((f) => f.id === id);
      if (!current) throw new Refused('Aucun haut fait avec cet id.');
      const updated = await data.updateFeat(id, columns(args, current, today));
      return json({ message: 'Haut fait modifié.', feat: updated && featOut(updated, await data.photoCounts()) });
    },
  },
  {
    name: 'hautsfaits_supprimer',
    title: 'Supprimer un haut fait',
    description: 'Supprime un haut fait sans photos. Demande confirmation avant : c’est un souvenir.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    annotations: { destructiveHint: true },
    async run(args, { data }) {
      const id = typeof args.id === 'string' && UUID.test(args.id) ? args.id.toLowerCase() : null;
      if (!id) throw new Refused('id invalide : prends-le dans hautsfaits_frise.');
      const feat = (await data.listFeats()).find((f) => f.id === id);
      if (!feat) throw new Refused('Aucun haut fait avec cet id.');
      if ((await data.photoCounts()).get(id)) throw new Refused('Ce haut fait a des photos : il se supprime dans l’app, qui retire aussi leurs fichiers.');
      await data.deleteFeat(id);
      return { text: `« ${feat.title} » retiré de la frise.` };
    },
  },
];
