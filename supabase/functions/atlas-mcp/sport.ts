/**
 * Les outils de Sport pour Claude (docs/connecteur-claude.md §9) — règles
 * pures, testées par Vitest (`src/modules/sport/lib/mcpTools.test.ts`), qui
 * compare aussi ce qui est recopié ici (semaines du plan, allures, zones de
 * FC, bornes) à ce que fait le module.
 *
 * Le besoin de Jules (11/10/2026) : une conversation de Claude lui sert de
 * **coach** pour le marathon d'Annecy ; elle a tout le contexte et lui donne
 * les séances de la semaine. Ces séances doivent arriver **dans le plan de
 * Sport**, « et tout le reste de ce module » : lire ses sorties et le plan
 * pour que le coach voie ce qui a été fait, noter ou corriger une sortie,
 * créer ou ajuster le plan, régler la FC.
 *
 * Les sorties de Strava arrivent toujours par la synchronisation de l'app ;
 * les coches d'Objectifs se font à l'ouverture de Sport, comme pour toute
 * sortie. Les outils passent par `SportData`, limité au compte du jeton
 * (`index.ts`). Colonnes : `2026-10-07-sport-tables.sql`.
 */
import type { Tool, ToolResult } from './mcp.ts';

// --- Les bornes et règles du module, recopiées (le test les compare) ---------------------------

export const RUNNING_SESSION_KINDS = ['footing', 'fractionne', 'seuil', 'longue', 'allure', 'course'] as const;
/** Les séances d'à côté (12/10/2026) : cochées à la main, hors des kilomètres de course. */
export const CROSS_SESSION_KINDS = ['renfo', 'velo'] as const;
export const SESSION_KINDS = [...RUNNING_SESSION_KINDS, ...CROSS_SESSION_KINDS] as const;
const isRunning = (kind: string) => (RUNNING_SESSION_KINDS as readonly string[]).includes(kind);
export const RUN_KINDS = ['footing', 'fractionne', 'seuil', 'longue', 'allure', 'course', 'autre'] as const;
export const PLAN_STATUSES = ['actif', 'termine', 'abandonne'] as const;
export type SessionKind = (typeof SESSION_KINDS)[number];
export const PLAN_TITLE_MAX = 120;
export const SESSION_TITLE_MAX = 120;
export const INSTRUCTIONS_MAX = 1000;
export const RUN_TITLE_MAX = 120;
export const RUN_NOTE_MAX = 2000;
export const SESSIONS_PER_WEEK_MIN = 2;
export const SESSIONS_PER_WEEK_MAX = 6;
export const PLAN_WEEKS_MAX = 60;
export const MARATHON_M = 42_195;

const utc = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
export const daysBetween = (a: string, b: string) => Math.round((utc(b) - utc(a)) / 86_400_000);
export const shiftDay = (day: string, n: number) => new Date(utc(day) + n * 86_400_000).toISOString().slice(0, 10);
export const mondayOf = (day: string) => shiftDay(day, -((new Date(utc(day)).getUTCDay() + 6) % 7));
/** La semaine du plan d'un jour (1 = celle du début) ; 0 ou moins avant le plan. */
export const weekOfPlan = (startDay: string, day: string) => Math.floor(daysBetween(mondayOf(startDay), day) / 7) + 1;
export const planWeekCount = (startDay: string, raceDay: string) => Math.floor(daysBetween(mondayOf(startDay), mondayOf(raceDay)) / 7) + 1;
export const mondayOfWeek = (startDay: string, week: number) => shiftDay(mondayOf(startDay), 7 * (week - 1));

export function paceOf(distanceM: number, durationS: number): number | null {
  if (distanceM < 100 || durationS <= 0) return null;
  return Math.round(durationS / (distanceM / 1000));
}

/** « 5:30 » ; l'allure en minutes et secondes par kilomètre. */
export const formatPace = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

/** Les zones de FC (Karvonen avec la FC de repos, sinon en part du maximum), comme `hrZones`. */
export function hrZones(hrMax: number | null, hrRest: number | null): { zone: number; min: number; max: number }[] | null {
  if (!hrMax) return null;
  const floors = [0.5, 0.6, 0.7, 0.8, 0.9];
  const base = hrRest ?? 0;
  const at = (share: number) => Math.round(base + (hrMax - base) * share);
  return floors.map((f, i) => ({ zone: i + 1, min: at(f), max: i === 4 ? hrMax : at(floors[i + 1]) - 1 }));
}

// --- Les données ------------------------------------------------------------------------------

export interface PlanRow {
  id: string;
  title: string;
  race_distance_m: number;
  race_day: string;
  race_day_confirmed: boolean;
  target_s: number | null;
  sessions_per_week: number;
  start_day: string;
  status: string;
  created_at: string;
}

export interface SessionRow {
  id: string;
  plan_id: string;
  week: number;
  position: number;
  kind: SessionKind;
  title: string;
  distance_m: number | null;
  duration_s: number | null;
  pace_min_s: number | null;
  pace_max_s: number | null;
  hr_zone: number | null;
  instructions: string;
  day: string | null;
  done_at: string | null;
}

export interface RunRow {
  id: string;
  started_at: string;
  day: string;
  distance_m: number;
  duration_s: number;
  elevation_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  kind: string;
  effort: number | null;
  title: string;
  note: string;
  source: string;
  session_id: string | null;
  splits_s: number[] | null;
}

export interface SettingsRow {
  hr_max: number | null;
  hr_rest: number | null;
}

/** Ce que les outils peuvent faire, toujours sur le seul compte du jeton. */
export interface SportData {
  listPlans(): Promise<PlanRow[]>;
  insertPlan(row: Record<string, unknown>): Promise<PlanRow>;
  updatePlan(id: string, row: Record<string, unknown>): Promise<PlanRow | null>;
  listSessions(planId: string): Promise<SessionRow[]>;
  insertSessions(rows: Record<string, unknown>[]): Promise<SessionRow[]>;
  updateSession(id: string, row: Record<string, unknown>): Promise<SessionRow | null>;
  deleteSessions(ids: string[]): Promise<number>;
  listRuns(from: string, to: string): Promise<RunRow[]>;
  getRun(id: string): Promise<RunRow | null>;
  insertRun(row: Record<string, unknown>): Promise<RunRow>;
  updateRun(id: string, row: Record<string, unknown>): Promise<RunRow | null>;
  deleteRun(id: string): Promise<boolean>;
  getSettings(): Promise<SettingsRow | null>;
  saveSettings(row: Record<string, unknown>): Promise<void>;
}

export interface SportContext {
  data: SportData;
  today: string;
}

// --- Lire les arguments -----------------------------------------------------------------------

class Refused extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const json = (value: unknown): ToolResult => ({ text: JSON.stringify(value, null, 2) });

function id(v: unknown, what = 'identifiant'): string {
  if (typeof v !== 'string' || !UUID.test(v)) throw new Refused(`${what} invalide : prends-le dans le résultat d’un autre outil.`);
  return v.toLowerCase();
}

function day(v: unknown, what = 'Le jour'): string {
  if (typeof v !== 'string' || !DAY.test(v) || Number.isNaN(utc(v))) throw new Refused(`${what} s’écrit AAAA-MM-JJ (par exemple 2026-10-14).`);
  return v;
}

function text(v: unknown, what: string, max: number, required = false): string {
  if (v === undefined || v === null) {
    if (required) throw new Refused(`${what} manque.`);
    return '';
  }
  if (typeof v !== 'string') throw new Refused(`${what} doit être un texte.`);
  const t = v.trim();
  if (required && !t) throw new Refused(`${what} manque.`);
  if (t.length > max) throw new Refused(`${what} : ${max} caractères au plus.`);
  return t;
}

function number(v: unknown, what: string, min: number, max: number): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.replace(',', '.')) : NaN;
  if (!Number.isFinite(n) || n < min || n > max) throw new Refused(`${what} : un nombre de ${min} à ${max}.`);
  return n;
}

/** Une allure « 5:30 » (min:s par km) ou un nombre de secondes → secondes par km. */
export function readPace(v: unknown, what: string): number | null {
  if (v === undefined || v === null || v === '') return null;
  let s: number;
  if (typeof v === 'number') s = Math.round(v);
  else if (typeof v === 'string' && /^\d{1,2}[:'’]\d{2}("|''|’’)?$/.test(v.trim())) {
    const [m, sec] = v.trim().replace(/["'’]+$/, '').split(/[:'’]/).map(Number);
    s = m * 60 + sec;
  } else throw new Refused(`${what} : une allure « 5:30 » (minutes:secondes par km).`);
  if (s < 120 || s > 1200) throw new Refused(`${what} : une allure entre 2:00 et 20:00 par km.`);
  return s;
}

/** Une durée « 1:05:00 », « 45:00 », ou un nombre de minutes → secondes. */
export function readDuration(v: unknown, what: string, min: number, max: number): number | null {
  if (v === undefined || v === null || v === '') return null;
  let s: number;
  if (typeof v === 'number') s = Math.round(v * 60);
  else if (typeof v === 'string' && /^\d+(:\d{2}){1,2}$/.test(v.trim())) {
    const parts = v.trim().split(':').map(Number);
    s = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts[0] * 60 + parts[1];
  } else throw new Refused(`${what} : en minutes (45), ou « 1:05:00 ».`);
  if (s < min || s > max) throw new Refused(`${what} : hors des bornes.`);
  return s;
}

const km = (m: number | null) => (m === null ? null : Math.round(m / 10) / 100);
const clock = (s: number | null) => {
  if (s === null) return null;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
};

/** Le plan en cours : le dernier plan actif. */
async function activePlan(data: SportData): Promise<PlanRow | null> {
  const plans = (await data.listPlans()).filter((p) => p.status === 'actif');
  return plans.sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
}

async function requirePlan(data: SportData): Promise<PlanRow> {
  const plan = await activePlan(data);
  if (!plan) throw new Refused('Aucun plan en cours : crée-le d’abord avec sport_plan_creer (ou dans l’app).');
  return plan;
}

const sessionOut = (s: SessionRow, plan: PlanRow) => ({
  id: s.id,
  ...(isRunning(s.kind) ? {} : { done: s.done_at !== null }),
  week: s.week,
  week_monday: mondayOfWeek(plan.start_day, s.week),
  day: s.day,
  kind: s.kind,
  title: s.title,
  distance_km: km(s.distance_m),
  duration: clock(s.duration_s),
  pace: s.pace_min_s && s.pace_max_s ? `${formatPace(s.pace_min_s)}–${formatPace(s.pace_max_s)} /km` : s.pace_min_s ? `${formatPace(s.pace_min_s)} /km` : null,
  hr_zone: s.hr_zone,
  instructions: s.instructions,
});

const runOut = (r: RunRow) => {
  const pace = paceOf(r.distance_m, r.duration_s);
  return {
    id: r.id,
    day: r.day,
    started_at: r.started_at,
    kind: r.kind,
    title: r.title,
    distance_km: km(r.distance_m),
    duration: clock(r.duration_s),
    pace: pace ? `${formatPace(pace)} /km` : null,
    elevation_m: r.elevation_m,
    avg_hr: r.avg_hr,
    max_hr: r.max_hr,
    effort: r.effort,
    note: r.note,
    source: r.source,
    splits_per_km: r.splits_s?.map((s) => formatPace(s)) ?? null,
  };
};

/**
 * Une séance donnée par le coach → les colonnes de la base. Le jour est la
 * clé : il dit la semaine du plan. Sans jour, la semaine doit être donnée
 * (« dans la semaine, quand tu veux », comme le générateur).
 */
export function sessionColumns(raw: unknown, plan: PlanRow, i: number): Record<string, unknown> {
  if (typeof raw !== 'object' || raw === null) throw new Refused(`Séance n° ${i + 1} : un objet { day, kind, title, … }.`);
  const o = raw as Record<string, unknown>;
  const what = `Séance n° ${i + 1}`;
  const d = o.day === undefined || o.day === null ? null : day(o.day, `${what} : le jour`);
  let week: number;
  if (d) week = weekOfPlan(plan.start_day, d);
  else {
    const w = number(o.week, `${what} : la semaine du plan`, 1, PLAN_WEEKS_MAX);
    if (w === null || !Number.isInteger(w)) throw new Refused(`${what} : donne son jour (AAAA-MM-JJ), ou sa semaine du plan.`);
    week = w;
  }
  const total = planWeekCount(plan.start_day, plan.race_day);
  if (week < 1) throw new Refused(`${what} : le ${d} tombe avant le début du plan (${mondayOf(plan.start_day)}).`);
  if (week > total) throw new Refused(`${what} : après la course (${plan.race_day}).`);
  if (!(SESSION_KINDS as readonly string[]).includes(String(o.kind))) {
    throw new Refused(`${what} : la sorte est l’une de ${SESSION_KINDS.join(', ')}.`);
  }
  const running = isRunning(String(o.kind));
  const distance = o.kind === 'renfo' ? null : number(o.distance_km, `${what} : la distance (km)`, 0.1, 500);
  // Une allure de course n'a pas de sens pour un renforcement ou du vélo.
  const paceMin = running ? readPace(o.pace_min, `${what} : l’allure la plus rapide`) : null;
  const paceMax = running ? readPace(o.pace_max, `${what} : l’allure la plus lente`) : null;
  if (paceMin !== null && paceMax !== null && paceMin > paceMax) throw new Refused(`${what} : pace_min est l’allure la plus RAPIDE (le plus petit nombre).`);
  const zone = number(o.hr_zone, `${what} : la zone de FC`, 1, 5);
  return {
    plan_id: plan.id,
    week,
    kind: o.kind,
    title: text(o.title, `${what} : le titre`, SESSION_TITLE_MAX, true),
    distance_m: distance === null ? null : Math.round(distance * 1000),
    duration_s: readDuration(o.duration, `${what} : la durée`, 60, 259_200),
    pace_min_s: paceMin,
    pace_max_s: paceMax,
    hr_zone: zone === null ? null : Math.round(zone),
    instructions: text(o.instructions, `${what} : les consignes`, INSTRUCTIONS_MAX),
    day: d,
  };
}

// --- Les outils --------------------------------------------------------------------------------

const S = {
  id: { type: 'string', description: 'Identifiant (uuid), tel que rendu par un autre outil.' },
  day: { type: 'string', description: 'AAAA-MM-JJ' },
};

const SESSION_SCHEMA = {
  type: 'object',
  properties: {
    day: { type: 'string', description: 'Le jour prévu, AAAA-MM-JJ. Sans jour : donner « week ».' },
    week: { type: 'integer', minimum: 1, maximum: PLAN_WEEKS_MAX, description: 'La semaine du plan, si la séance n’a pas de jour fixe.' },
    kind: {
      type: 'string',
      enum: [...SESSION_KINDS],
      description:
        'Course : footing (endurance), fractionne, seuil, longue (sortie longue), allure (allure marathon), course (une compétition). À côté : renfo (renforcement, gainage, PPG — une durée et les exercices dans les consignes), velo (une durée, une distance si tu veux). Renfo et vélo ne comptent pas dans les km de course et se cochent à la main (sport_seance_cocher).',
    },
    title: { type: 'string', maxLength: SESSION_TITLE_MAX, description: '« Footing en aisance », « 6 × 1 000 m », « Sortie longue 24 km dont 8 à allure marathon ».' },
    distance_km: { type: 'number', minimum: 0.1 },
    duration: { type: ['number', 'string'], description: 'En minutes (45), ou « 1:05:00 ».' },
    pace_min: { type: 'string', description: 'L’allure la plus rapide, « 5:05 » par km.' },
    pace_max: { type: 'string', description: 'L’allure la plus lente, « 5:20 » par km.' },
    hr_zone: { type: 'integer', minimum: 1, maximum: 5, description: 'La zone de FC visée (Karvonen, voir sport_resume).' },
    instructions: { type: 'string', maxLength: INSTRUCTIONS_MAX, description: 'Le détail : échauffement, répétitions, récupérations, retour au calme, consignes.' },
  },
  required: ['kind', 'title'],
};

const RUN_FIELDS = {
  kind: { type: 'string', enum: [...RUN_KINDS] },
  title: { type: 'string', maxLength: RUN_TITLE_MAX },
  note: { type: 'string', maxLength: RUN_NOTE_MAX, description: 'Le ressenti, ce qui s’est passé.' },
  effort: { type: ['integer', 'null'], minimum: 1, maximum: 10, description: 'Le ressenti de l’effort, de 1 à 10.' },
  session_id: { type: ['string', 'null'], description: 'La séance du plan que cette sortie a faite (sinon Sport la rattache seul).' },
};

export const sportTools: Tool<SportContext>[] = [
  {
    name: 'sport_resume',
    title: 'Résumé de Sport : plan, semaine, volume, FC',
    description:
      'À lire en premier : le plan en cours (course, date, objectif, semaine actuelle sur le total), les séances de la semaine en cours et de la suivante, les kilomètres des 8 dernières semaines, les sorties des 14 derniers jours, la FC max et de repos et les zones de FC.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    async run(_args, { data, today }) {
      const [plan, settings] = await Promise.all([activePlan(data), data.getSettings()]);
      const from = shiftDay(mondayOf(today), -7 * 7);
      const runs = await data.listRuns(from, today);
      const weeks = Array.from({ length: 8 }, (_, i) => {
        const monday = shiftDay(mondayOf(today), -7 * (7 - i));
        const inWeek = runs.filter((r) => r.day >= monday && r.day <= shiftDay(monday, 6));
        return { monday, km: km(inWeek.reduce((s, r) => s + r.distance_m, 0)), runs: inWeek.length };
      });
      let planOut = null;
      if (plan) {
        const sessions = await data.listSessions(plan.id);
        const current = weekOfPlan(plan.start_day, today);
        planOut = {
          id: plan.id,
          title: plan.title,
          race_day: plan.race_day,
          race_day_confirmed: plan.race_day_confirmed,
          race_distance_km: km(plan.race_distance_m),
          target: clock(plan.target_s),
          target_pace: plan.target_s ? `${formatPace(Math.round(plan.target_s / (plan.race_distance_m / 1000)))} /km` : null,
          sessions_per_week: plan.sessions_per_week,
          start_day: plan.start_day,
          current_week: current,
          total_weeks: planWeekCount(plan.start_day, plan.race_day),
          days_to_race: daysBetween(today, plan.race_day),
          this_week: sessions.filter((s) => s.week === current).sort((a, b) => a.position - b.position).map((s) => sessionOut(s, plan)),
          next_week: sessions.filter((s) => s.week === current + 1).sort((a, b) => a.position - b.position).map((s) => sessionOut(s, plan)),
        };
      }
      return json({
        today,
        plan: planOut,
        weekly_km: weeks,
        last_14_days: runs.filter((r) => r.day >= shiftDay(today, -13)).sort((a, b) => b.started_at.localeCompare(a.started_at)).map(runOut),
        heart_rate: { max: settings?.hr_max ?? null, rest: settings?.hr_rest ?? null, zones: hrZones(settings?.hr_max ?? null, settings?.hr_rest ?? null) },
      });
    },
  },
  {
    name: 'sport_plan_lire',
    title: 'Lire le plan',
    description: 'Les séances du plan en cours entre deux semaines (par défaut, toutes), avec les sorties faites ces semaines-là pour comparer.',
    inputSchema: {
      type: 'object',
      properties: {
        from_week: { type: 'integer', minimum: 1 },
        to_week: { type: 'integer', minimum: 1 },
      },
    },
    annotations: { readOnlyHint: true },
    async run(args, { data }) {
      const plan = await requirePlan(data);
      const total = planWeekCount(plan.start_day, plan.race_day);
      const fromWeek = Math.max(1, Math.round(number(args.from_week, 'from_week', 1, PLAN_WEEKS_MAX) ?? 1));
      const toWeek = Math.min(total, Math.round(number(args.to_week, 'to_week', 1, PLAN_WEEKS_MAX) ?? total));
      const sessions = (await data.listSessions(plan.id)).filter((s) => s.week >= fromWeek && s.week <= toWeek);
      const runs = await data.listRuns(mondayOfWeek(plan.start_day, fromWeek), shiftDay(mondayOfWeek(plan.start_day, toWeek), 6));
      const weeks = [];
      for (let w = fromWeek; w <= toWeek; w++) {
        const monday = mondayOfWeek(plan.start_day, w);
        weeks.push({
          week: w,
          monday,
          sessions: sessions.filter((s) => s.week === w).sort((a, b) => a.position - b.position).map((s) => sessionOut(s, plan)),
          runs: runs.filter((r) => r.day >= monday && r.day <= shiftDay(monday, 6)).map(runOut),
        });
      }
      return json({ plan: { id: plan.id, title: plan.title, race_day: plan.race_day, total_weeks: total }, weeks });
    },
  },
  {
    name: 'sport_semaine_programmer',
    title: 'Programmer les séances d’une semaine',
    description: [
      'Met dans le plan de Sport les séances que tu as préparées pour une semaine : elles REMPLACENT celles déjà prévues cette semaine-là (celles du générateur, ou une version précédente).',
      'Donne n’importe quel jour de la semaine visée (week_of) et les séances, chacune avec son jour, sa sorte, un titre court, et ce que tu sais : distance, durée, allures, zone de FC, consignes détaillées.',
      'Course à pied, renforcement (renfo) et vélo (velo) : mets toute la semaine, les séances d’à côté comprises.',
    ].join(' '),
    inputSchema: {
      type: 'object',
      properties: {
        week_of: { ...S.day, description: 'Un jour de la semaine à programmer (le lundi, par exemple).' },
        sessions: { type: 'array', minItems: 1, maxItems: 10, items: SESSION_SCHEMA },
      },
      required: ['week_of', 'sessions'],
    },
    annotations: { idempotentHint: true },
    async run(args, { data }) {
      const plan = await requirePlan(data);
      const anchor = day(args.week_of, 'week_of');
      const week = weekOfPlan(plan.start_day, anchor);
      const total = planWeekCount(plan.start_day, plan.race_day);
      if (week < 1 || week > total) throw new Refused(`Le ${anchor} est hors du plan (du ${mondayOf(plan.start_day)} au ${plan.race_day}).`);
      if (!Array.isArray(args.sessions) || args.sessions.length === 0) throw new Refused('sessions : la liste des séances de la semaine.');
      if (args.sessions.length > 10) throw new Refused('10 séances au plus par semaine.');
      const rows = args.sessions.map((raw, i) => sessionColumns(raw, plan, i));
      const outside = rows.findIndex((r) => r.week !== week);
      if (outside >= 0) throw new Refused(`Séance n° ${outside + 1} : son jour n’est pas dans la semaine du ${mondayOfWeek(plan.start_day, week)}.`);
      // Dans l'ordre des jours ; les séances sans jour à la fin, dans l'ordre donné.
      const ordered = rows
        .map((r, i) => ({ r, i }))
        .sort((a, b) => String(a.r.day ?? '9999').localeCompare(String(b.r.day ?? '9999')) || a.i - b.i)
        .map(({ r }, position) => ({ ...r, position }));
      const before = (await data.listSessions(plan.id)).filter((s) => s.week === week);
      // Les nouvelles d'abord, les anciennes ensuite : une coupure laisse au pire un doublon, jamais une semaine vide.
      const created = await data.insertSessions(ordered);
      await data.deleteSessions(before.map((s) => s.id));
      return json({
        message: `Semaine ${week} du plan (du ${mondayOfWeek(plan.start_day, week)}) : ${created.length} séance${created.length > 1 ? 's' : ''} programmée${created.length > 1 ? 's' : ''}${before.length ? `, à la place de ${before.length}` : ''}.`,
        sessions: created.sort((a, b) => a.position - b.position).map((s) => sessionOut(s, plan)),
      });
    },
  },
  {
    name: 'sport_seance_ajouter',
    title: 'Ajouter une séance au plan',
    description: 'Ajoute une séance au plan, sans toucher aux autres de sa semaine.',
    inputSchema: SESSION_SCHEMA,
    annotations: {},
    async run(args, { data }) {
      const plan = await requirePlan(data);
      const row = sessionColumns(args, plan, 0);
      const same = (await data.listSessions(plan.id)).filter((s) => s.week === row.week);
      const [created] = await data.insertSessions([{ ...row, position: same.length ? Math.max(...same.map((s) => s.position)) + 1 : 0 }]);
      return json({ message: `Séance ajoutée en semaine ${created.week}.`, session: sessionOut(created, plan) });
    },
  },
  {
    name: 'sport_seance_modifier',
    title: 'Modifier une séance du plan',
    description: 'Change une séance : seuls les champs donnés changent. Changer le jour peut la faire passer dans une autre semaine.',
    inputSchema: { type: 'object', properties: { id: S.id, ...SESSION_SCHEMA.properties }, required: ['id'] },
    annotations: { idempotentHint: true },
    async run(args, { data }) {
      const plan = await requirePlan(data);
      const session = (await data.listSessions(plan.id)).find((s) => s.id === id(args.id));
      if (!session) throw new Refused('Aucune séance du plan en cours avec cet identifiant : relis le plan.');
      const merged = {
        day: session.day,
        week: session.week,
        kind: session.kind,
        title: session.title,
        distance_km: session.distance_m === null ? null : session.distance_m / 1000,
        duration: session.duration_s === null ? null : clock(session.duration_s),
        pace_min: session.pace_min_s,
        pace_max: session.pace_max_s,
        hr_zone: session.hr_zone,
        instructions: session.instructions,
      } as Record<string, unknown>;
      for (const [k, v] of Object.entries(args)) if (k !== 'id' && v !== undefined) merged[k] = v;
      // Un jour donné l'emporte sur la semaine ; retirer le jour garde la semaine.
      if (args.day !== undefined && args.day !== null) delete merged.week;
      const row = sessionColumns(merged, plan, 0);
      const updated = await data.updateSession(session.id, row);
      if (!updated) throw new Refused('La séance n’existe plus.');
      return json({ message: 'Séance modifiée.', session: sessionOut(updated, plan) });
    },
  },
  {
    name: 'sport_seance_supprimer',
    title: 'Supprimer des séances du plan',
    description: 'Retire des séances du plan. Les sorties déjà faites restent ; elles ne sont simplement plus rattachées.',
    inputSchema: { type: 'object', properties: { ids: { type: 'array', items: S.id, minItems: 1 } }, required: ['ids'] },
    annotations: { destructiveHint: true },
    async run(args, { data }) {
      const plan = await requirePlan(data);
      if (!Array.isArray(args.ids) || args.ids.length === 0) throw new Refused('ids : les séances à retirer.');
      const mine = new Set((await data.listSessions(plan.id)).map((s) => s.id));
      const ids = args.ids.map((v) => id(v));
      const unknown = ids.filter((x) => !mine.has(x));
      if (unknown.length) throw new Refused(`${unknown.length} identifiant(s) ne sont pas des séances du plan en cours.`);
      const gone = await data.deleteSessions(ids);
      return { text: `${gone} séance${gone > 1 ? 's' : ''} retirée${gone > 1 ? 's' : ''} du plan.` };
    },
  },
  {
    name: 'sport_seance_cocher',
    title: 'Cocher une séance de renforcement ou de vélo',
    description:
      'Marque faite (ou pas faite) une séance de renforcement ou de vélo : aucune sortie ne la fait. Les séances de course, elles, sont faites par les sorties (Strava), rattachées toutes seules.',
    inputSchema: { type: 'object', properties: { id: S.id, done: { type: 'boolean', description: 'Faite (par défaut), ou false pour décocher.' } }, required: ['id'] },
    annotations: { idempotentHint: true },
    async run(args, { data }) {
      const plan = await requirePlan(data);
      const session = (await data.listSessions(plan.id)).find((s) => s.id === id(args.id));
      if (!session) throw new Refused('Aucune séance du plan en cours avec cet identifiant : relis le plan.');
      if (isRunning(session.kind)) throw new Refused('Une séance de course est faite par une sortie : note la sortie (sport_sortie_ajouter) ou laisse Strava l’apporter.');
      const done = args.done !== false;
      const updated = await data.updateSession(session.id, { done_at: done ? (session.done_at ?? new Date().toISOString()) : null });
      return json({ message: `« ${session.title} » ${done ? 'faite' : 'à faire'}.`, session: updated && sessionOut(updated, plan) });
    },
  },
  {
    name: 'sport_plan_creer',
    title: 'Créer le plan',
    description:
      'Crée un plan vide (sans séances générées) vers une course : nom, distance, date, objectif. Les séances se programment ensuite semaine par semaine. Un plan déjà en cours est d’abord marqué « terminé » ou « abandonné » dans l’app ou avec sport_plan_modifier.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', maxLength: PLAN_TITLE_MAX, description: '« Marathon d’Annecy »' },
        race_day: S.day,
        race_day_confirmed: { type: 'boolean' },
        race_distance_km: { type: 'number', description: '42.195 pour un marathon.' },
        target: { type: 'string', description: 'Le temps visé, « 3:45:00 ».' },
        sessions_per_week: { type: 'integer', minimum: SESSIONS_PER_WEEK_MIN, maximum: SESSIONS_PER_WEEK_MAX },
        start_day: { ...S.day, description: 'Le début du plan ; aujourd’hui par défaut.' },
      },
      required: ['title', 'race_day'],
    },
    annotations: {},
    async run(args, { data, today }) {
      if (await activePlan(data)) throw new Refused('Un plan est déjà en cours : marque-le terminé ou abandonné avant d’en créer un autre (sport_plan_modifier, status).');
      const raceDay = day(args.race_day, 'La date de la course');
      const startDay = args.start_day === undefined ? today : day(args.start_day, 'Le début du plan');
      if (startDay > raceDay) throw new Refused('Le plan commence avant la course.');
      if (planWeekCount(startDay, raceDay) > PLAN_WEEKS_MAX) throw new Refused(`${PLAN_WEEKS_MAX} semaines au plus : commence le plan plus tard.`);
      const distance = number(args.race_distance_km, 'La distance de la course (km)', 1, 500) ?? MARATHON_M / 1000;
      const spw = number(args.sessions_per_week, 'Les séances par semaine', SESSIONS_PER_WEEK_MIN, SESSIONS_PER_WEEK_MAX) ?? 4;
      const created = await data.insertPlan({
        title: text(args.title, 'Le nom du plan', PLAN_TITLE_MAX, true),
        race_day: raceDay,
        race_day_confirmed: args.race_day_confirmed === true,
        race_distance_m: Math.round(distance * 1000),
        target_s: readDuration(args.target, 'Le temps visé', 60, 259_200),
        sessions_per_week: Math.round(spw),
        start_day: startDay,
      });
      return json({ message: `Plan « ${created.title} » créé : ${planWeekCount(startDay, raceDay)} semaines, sans séances pour l’instant.`, plan_id: created.id });
    },
  },
  {
    name: 'sport_plan_modifier',
    title: 'Modifier le plan',
    description:
      'Change le plan en cours : nom, date de la course (et si elle est confirmée), objectif de temps, séances par semaine, ou son état (« termine », « abandonne »). Changer la date ici ne recale pas les séances (l’app, elle, le propose).',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', maxLength: PLAN_TITLE_MAX },
        race_day: S.day,
        race_day_confirmed: { type: 'boolean' },
        target: { type: ['string', 'null'], description: '« 3:45:00 », ou null pour retirer l’objectif.' },
        sessions_per_week: { type: 'integer', minimum: SESSIONS_PER_WEEK_MIN, maximum: SESSIONS_PER_WEEK_MAX },
        status: { type: 'string', enum: [...PLAN_STATUSES] },
      },
    },
    annotations: { idempotentHint: true },
    async run(args, { data }) {
      const plan = await requirePlan(data);
      const row: Record<string, unknown> = {};
      if (args.title !== undefined) row.title = text(args.title, 'Le nom', PLAN_TITLE_MAX, true);
      if (args.race_day !== undefined) {
        const raceDay = day(args.race_day, 'La date de la course');
        if (raceDay < plan.start_day) throw new Refused('La course ne peut pas tomber avant le début du plan.');
        if (planWeekCount(plan.start_day, raceDay) > PLAN_WEEKS_MAX) throw new Refused(`${PLAN_WEEKS_MAX} semaines de plan au plus.`);
        row.race_day = raceDay;
      }
      if (args.race_day_confirmed !== undefined) row.race_day_confirmed = args.race_day_confirmed === true;
      if (args.target !== undefined) row.target_s = args.target === null ? null : readDuration(args.target, 'Le temps visé', 60, 259_200);
      if (args.sessions_per_week !== undefined) row.sessions_per_week = Math.round(number(args.sessions_per_week, 'Les séances par semaine', SESSIONS_PER_WEEK_MIN, SESSIONS_PER_WEEK_MAX) ?? 3);
      if (args.status !== undefined) {
        if (!(PLAN_STATUSES as readonly string[]).includes(String(args.status))) throw new Refused(`État : ${PLAN_STATUSES.join(', ')}.`);
        row.status = args.status;
      }
      if (Object.keys(row).length === 0) throw new Refused('Rien à modifier : donne au moins un champ.');
      const updated = await data.updatePlan(plan.id, row);
      return json({ message: 'Plan modifié.', plan: updated && { title: updated.title, race_day: updated.race_day, target: clock(updated.target_s), status: updated.status } });
    },
  },
  {
    name: 'sport_sorties_lister',
    title: 'Lire les sorties',
    description: 'Les sorties entre deux jours (par défaut les 28 derniers), avec allure, FC, dénivelé, ressenti, note et temps au kilomètre.',
    inputSchema: { type: 'object', properties: { from: S.day, to: S.day } },
    annotations: { readOnlyHint: true },
    async run(args, { data, today }) {
      const to = args.to === undefined ? today : day(args.to);
      const from = args.from === undefined ? shiftDay(to, -27) : day(args.from);
      if (from > to) throw new Refused('Le premier jour vient après le dernier.');
      if (daysBetween(from, to) > 400) throw new Refused('Un peu plus d’un an au plus à la fois.');
      const runs = await data.listRuns(from, to);
      return json({ from, to, count: runs.length, km: km(runs.reduce((s, r) => s + r.distance_m, 0)), runs: runs.sort((a, b) => b.started_at.localeCompare(a.started_at)).map(runOut) });
    },
  },
  {
    name: 'sport_sortie_ajouter',
    title: 'Noter une sortie',
    description: 'Note une sortie à la main (sans montre, ou oubliée par Strava). Celles de Strava arrivent seules : ne les recopie pas.',
    inputSchema: {
      type: 'object',
      properties: {
        day: S.day,
        start_time: { type: 'string', description: 'L’heure de départ, « 18:30 » (heure de Paris) ; midi par défaut.' },
        distance_km: { type: 'number', minimum: 0 },
        duration: { type: ['number', 'string'], description: 'En minutes (52), ou « 1:05:30 ».' },
        avg_hr: { type: 'integer', minimum: 30, maximum: 250 },
        max_hr: { type: 'integer', minimum: 30, maximum: 250 },
        elevation_m: { type: 'integer', minimum: 0 },
        ...RUN_FIELDS,
      },
      required: ['day', 'distance_km', 'duration'],
    },
    annotations: {},
    async run(args, { data }) {
      const d = day(args.day);
      const time = args.start_time === undefined ? '12:00' : text(args.start_time, 'L’heure de départ', 5);
      if (!/^\d{1,2}:\d{2}$/.test(time)) throw new Refused('L’heure de départ s’écrit « 18:30 ».');
      const [h, m] = time.split(':').map(Number);
      // Heure de Paris : un décalage d'été (+2) ou d'hiver (+1), lu par Intl pour ce jour-là.
      const offset = parisOffsetMinutes(d);
      const startedAt = new Date(utc(d) + ((h * 60 + m - offset) * 60_000)).toISOString();
      const distance = number(args.distance_km, 'La distance (km)', 0, 500);
      const duration = readDuration(args.duration, 'La durée', 1, 259_200);
      if (distance === null || duration === null) throw new Refused('La distance et la durée sont nécessaires.');
      const avg = number(args.avg_hr, 'La FC moyenne', 30, 250);
      const max = number(args.max_hr, 'La FC max', 30, 250);
      if (avg !== null && max !== null && avg > max) throw new Refused('La FC moyenne dépasse la FC max.');
      const created = await data.insertRun({
        started_at: startedAt,
        day: d,
        distance_m: Math.round(distance * 1000),
        duration_s: duration,
        avg_hr: avg === null ? null : Math.round(avg),
        max_hr: max === null ? null : Math.round(max),
        elevation_m: args.elevation_m === undefined ? null : Math.round(number(args.elevation_m, 'Le dénivelé', 0, 20_000) ?? 0),
        ...(await runPatch(args, data)),
        source: 'manuel',
      });
      return json({ message: 'Sortie notée.', run: runOut(created) });
    },
  },
  {
    name: 'sport_sortie_modifier',
    title: 'Modifier une sortie',
    description: 'Change la sorte, le titre, la note, le ressenti ou la séance du plan d’une sortie (les chiffres de Strava restent ceux de Strava).',
    inputSchema: { type: 'object', properties: { id: S.id, ...RUN_FIELDS }, required: ['id'] },
    annotations: { idempotentHint: true },
    async run(args, { data }) {
      const run = await data.getRun(id(args.id));
      if (!run) throw new Refused('Aucune sortie avec cet identifiant : relis les sorties.');
      const row = await runPatch(args, data);
      if (Object.keys(row).length === 0) throw new Refused('Rien à modifier : donne au moins un champ.');
      const updated = await data.updateRun(run.id, row);
      return json({ message: 'Sortie modifiée.', run: updated && runOut(updated) });
    },
  },
  {
    name: 'sport_sortie_supprimer',
    title: 'Supprimer une sortie',
    description: 'Supprime une sortie notée par erreur. Une sortie de Strava supprimée ici reviendra à la prochaine synchronisation : à supprimer chez Strava. Demande confirmation avant.',
    inputSchema: { type: 'object', properties: { id: S.id }, required: ['id'] },
    annotations: { destructiveHint: true },
    async run(args, { data }) {
      const run = await data.getRun(id(args.id));
      if (!run) throw new Refused('Aucune sortie avec cet identifiant.');
      await data.deleteRun(run.id);
      return { text: `Sortie du ${run.day} (${km(run.distance_m)} km) supprimée.` };
    },
  },
  {
    name: 'sport_reglages',
    title: 'FC maximale et de repos',
    description: 'Sans argument, rend la FC max, la FC de repos et les zones. Avec, les modifie (les zones se recalculent, méthode de Karvonen).',
    inputSchema: {
      type: 'object',
      properties: {
        hr_max: { type: ['integer', 'null'], minimum: 100, maximum: 250 },
        hr_rest: { type: ['integer', 'null'], minimum: 25, maximum: 120 },
      },
    },
    annotations: {},
    async run(args, { data }) {
      const current = (await data.getSettings()) ?? { hr_max: null, hr_rest: null };
      if (args.hr_max === undefined && args.hr_rest === undefined) return json({ ...current, zones: hrZones(current.hr_max, current.hr_rest) });
      const next = {
        hr_max: args.hr_max === undefined ? current.hr_max : args.hr_max === null ? null : Math.round(number(args.hr_max, 'La FC max', 100, 250) ?? 0),
        hr_rest: args.hr_rest === undefined ? current.hr_rest : args.hr_rest === null ? null : Math.round(number(args.hr_rest, 'La FC de repos', 25, 120) ?? 0),
      };
      if (next.hr_max !== null && next.hr_rest !== null && next.hr_rest >= next.hr_max) throw new Refused('La FC de repos doit être sous la FC max.');
      await data.saveSettings(next);
      return json({ message: 'Fréquences enregistrées.', ...next, zones: hrZones(next.hr_max, next.hr_rest) });
    },
  },
];

/** Les champs d'une sortie qu'on peut toujours écrire (sorte, titre, note, ressenti, séance). */
async function runPatch(args: Record<string, unknown>, data: SportData): Promise<Record<string, unknown>> {
  const row: Record<string, unknown> = {};
  if (args.kind !== undefined) {
    if (!(RUN_KINDS as readonly string[]).includes(String(args.kind))) throw new Refused(`La sorte : ${RUN_KINDS.join(', ')}.`);
    row.kind = args.kind;
  }
  if (args.title !== undefined) row.title = text(args.title, 'Le titre', RUN_TITLE_MAX);
  if (args.note !== undefined) row.note = text(args.note, 'La note', RUN_NOTE_MAX);
  if (args.effort !== undefined) row.effort = args.effort === null ? null : Math.round(number(args.effort, 'Le ressenti', 1, 10) ?? 0);
  if (args.session_id !== undefined) {
    if (args.session_id === null) row.session_id = null;
    else {
      const plan = await requirePlan(data);
      const sessionId = id(args.session_id, 'session_id');
      if (!(await data.listSessions(plan.id)).some((s) => s.id === sessionId)) throw new Refused('session_id : pas une séance du plan en cours.');
      row.session_id = sessionId;
    }
  }
  return row;
}

/** Le décalage de Paris avec UTC ce jour-là, en minutes (60 l'hiver, 120 l'été). */
export function parisOffsetMinutes(d: string): number {
  const noon = new Date(utc(d) + 12 * 3_600_000);
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hourCycle: 'h23' }).format(noon);
  return (Number(parts) - 12) * 60;
}
