/**
 * Les outils de Tâches pour Claude (docs/connecteur-claude.md §11) — règles
 * pures, testées par Vitest (`src/modules/taches/lib/mcpTools.test.ts`), qui
 * compare ce qui est recopié ici (cocher une tâche répétée, les vues, les
 * bornes) à ce que fait le module.
 *
 * Priorité n° 1 de l'analyse du 11/10/2026 : « ajoute appeler le garage
 * demain 9 h », « qu'est-ce que j'ai aujourd'hui ? », « fais le point sur mes
 * retards », ou les tâches tirées des mails de la semaine. Claude comprend
 * lui-même les dates en français : il donne des champs déjà lus (jour, heure,
 * répétition), pas une phrase à analyser.
 *
 * Les rappels se recalculent à l'ouverture de Tâches dans l'app (comme ceux
 * de Sport) : une tâche ajoutée ici prévient à son heure une fois l'app
 * ouverte. Colonnes : `2026-09-27-taches-tables.sql` et suivantes.
 */
import type { Tool, ToolResult } from './mcp.ts';
import { zonedDay, zonedInstant } from './zone.ts';
import { daysBetween, describeRecurrence, maxDay, ruleDays, shiftDay, validateRecurrence, FREQUENCIES, type Recurrence } from './recurrence.ts';

export const TASK_TITLE_MAX = 1000;
export const NOTE_MAX = 2000;
export const LIST_NAME_MAX = 60;
export const DURATION_MIN = 5;
export const DURATION_MAX = 1440;
export const PRIORITIES = ['normale', 'importante', 'urgente'] as const;
export const REPEAT_FROM = ['schedule', 'completion'] as const;
export const LIST_COLORS = ['bleu', 'vert', 'orange', 'rose', 'violet', 'gris'] as const;
export const TASK_REMINDERS = [0, 5, 10, 15, 30, 60, 120, 1440] as const;
export const MAX_TASK_REMINDERS = 2;
const UPCOMING_DAYS = 14;
const DUE_SOON_DAYS = 2;

export interface TaskRow {
  id: string;
  list_id: string | null;
  parent_id: string | null;
  title: string;
  note: string;
  planned_day: string | null;
  planned_time: string | null;
  duration_minutes: number | null;
  reminders: number[] | null;
  due_day: string | null;
  priority: (typeof PRIORITIES)[number];
  recurrence: Recurrence | null;
  repeat_from: (typeof REPEAT_FROM)[number];
  position: number;
  completed_at: string | null;
  created_at: string;
}

export interface ListRow {
  id: string;
  name: string;
  color: string;
  position: number;
  archived: boolean;
}

export interface TachesData {
  listTasks(): Promise<TaskRow[]>;
  insertTask(row: Record<string, unknown>): Promise<TaskRow>;
  updateTask(id: string, row: Record<string, unknown>): Promise<TaskRow | null>;
  /** Emporte ses sous-tâches. */
  deleteTask(id: string): Promise<boolean>;
  listLists(): Promise<ListRow[]>;
  insertList(row: Record<string, unknown>): Promise<ListRow>;
  updateList(id: string, row: Record<string, unknown>): Promise<ListRow | null>;
  getSettings(): Promise<TachesSettings>;
  /** Remplace les rappels à venir de Tâches (`coreStore.scheduleReminders('taches', …)`). */
  scheduleReminders(reminders: ReminderInput[]): Promise<void>;
}

export interface TachesSettings {
  taskReminders: boolean;
  morningEnabled: boolean;
  morningTime: string;
}

export interface ReminderInput {
  ref: string;
  fireAt: string;
  title: string;
  body: string;
}

export interface TachesContext {
  data: TachesData;
  /** Aujourd'hui à Paris, AAAA-MM-JJ. */
  today: string;
  /** Maintenant, ISO. */
  now: string;
  newId: () => string;
  /** Le fuseau de Jules : celui où tombent les heures des tâches. */
  timezone: string;
}

// --- Les règles du module, recopiées (le test les compare) ------------------------------------

const SEARCH_DAYS = 366 * 9;

function addMonths(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`;
}

/** La prochaine occurrence d'une tâche répétée cochée le jour `doneDay` (`nextOccurrence` du module). */
export function nextOccurrence(
  task: { planned_day: string | null; recurrence: Recurrence | null; repeat_from: string },
  doneDay: string,
): { plannedDay: string; recurrence: Recurrence } | null {
  const rule = task.recurrence;
  if (!rule || !task.planned_day) return null;
  const interval = Math.max(1, rule.interval || 1);
  if (task.repeat_from === 'completion') {
    const next =
      rule.freq === 'daily'
        ? shiftDay(doneDay, interval)
        : rule.freq === 'weekly'
          ? shiftDay(doneDay, 7 * interval)
          : addMonths(doneDay, rule.freq === 'monthly' ? interval : 12 * interval);
    if (rule.until && next > rule.until) return null;
    if (rule.count !== undefined) {
      if (rule.count <= 1) return null;
      return { plannedDay: next, recurrence: { ...rule, count: rule.count - 1 } };
    }
    return { plannedDay: next, recurrence: rule };
  }
  const series = { startDay: task.planned_day, recurrence: rule };
  const after = maxDay(task.planned_day, doneDay);
  const [next] = ruleDays(series, shiftDay(after, 1), shiftDay(after, SEARCH_DAYS));
  if (!next) return null;
  if (rule.count !== undefined) {
    const used = ruleDays(series, task.planned_day, shiftDay(next, -1)).length;
    return { plannedDay: next, recurrence: { ...rule, count: rule.count - used } };
  }
  return { plannedDay: next, recurrence: rule };
}

const RANK: Record<string, number> = { urgente: 0, importante: 1, normale: 2 };

/** L'ordre d'une journée (`compareTasks` du module) : heure, priorité, échéance, ordre choisi. */
export function compareTasks(a: TaskRow, b: TaskRow): number {
  if (a.planned_time && b.planned_time && a.planned_time !== b.planned_time) return a.planned_time.localeCompare(b.planned_time);
  if (!!a.planned_time !== !!b.planned_time) return a.planned_time ? -1 : 1;
  if (RANK[a.priority] !== RANK[b.priority]) return RANK[a.priority] - RANK[b.priority];
  if (a.due_day !== b.due_day) {
    if (!a.due_day) return 1;
    if (!b.due_day) return -1;
    return a.due_day.localeCompare(b.due_day);
  }
  return a.position - b.position || a.created_at.localeCompare(b.created_at);
}

function dueStatus(task: Pick<TaskRow, 'due_day'>, today: string): 'overdue' | 'today' | 'soon' | null {
  if (!task.due_day) return null;
  const left = daysBetween(today, task.due_day);
  if (left < 0) return 'overdue';
  if (left === 0) return 'today';
  return left <= DUE_SOON_DAYS ? 'soon' : null;
}

const open = (t: TaskRow) => !t.completed_at && !t.parent_id;

/** « Aujourd'hui » : les retards, puis ce qui est prévu aujourd'hui ou dont l'échéance approche (`todayView`). */
export function todayView(tasks: readonly TaskRow[], today: string): { overdue: TaskRow[]; today: TaskRow[] } {
  const overdue: TaskRow[] = [];
  const current: TaskRow[] = [];
  for (const t of tasks) {
    if (!open(t)) continue;
    const due = dueStatus(t, today);
    if ((t.planned_day && t.planned_day < today) || due === 'overdue') overdue.push(t);
    else if (t.planned_day === today || due === 'today' || due === 'soon') current.push(t);
  }
  return { overdue: overdue.sort(compareTasks), today: current.sort(compareTasks) };
}

// --- Lire les arguments -----------------------------------------------------------------------

class Refused extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const json = (value: unknown): ToolResult => ({ text: JSON.stringify(value, null, 2) });

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
  if (required && !t) throw new Refused(`${what} manque.`);
  if (t.length > max) throw new Refused(`${what} : ${max} caractères au plus.`);
  return t;
}

function dayOrNull(v: unknown, what: string): string | null {
  if (v === null || v === '') return null;
  if (typeof v !== 'string' || !DAY.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) throw new Refused(`${what} s’écrit AAAA-MM-JJ.`);
  return v;
}

function timeOrNull(v: unknown): string | null {
  if (v === null || v === '') return null;
  const t = typeof v === 'string' ? v.trim().replace(/h$/, ':00').replace('h', ':').padStart(5, '0') : '';
  if (!TIME.test(t)) throw new Refused('L’heure s’écrit « 09:30 ».');
  return t;
}

/** Une répétition donnée par Claude → la règle du moteur commun. */
// --- Les rappels (copie de `lib/reminders.ts`, l'heure lue dans le fuseau de Jules) -----------
//
// Recalculés après chaque écriture, comme l'écran à chaque chargement : une tâche notée à 9 h
// par Claude prévient même si l'app n'est pas rouverte.

export const REMINDER_HORIZON_DAYS = 7;
const REMINDER_TEXT_MAX = 1000;
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;
const clip = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);

function shortDate(day: string, today: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const text = `${d === 1 ? '1er' : d} ${MONTHS[m - 1]}`;
  return y === Number(today.slice(0, 4)) ? text : `${text} ${y}`;
}

function timeLabel(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

function dueLabel(day: string, today: string): string {
  const diff = daysBetween(today, day);
  if (diff < 0) return `échéance dépassée (${shortDate(day, today)})`;
  if (diff === 0) return 'à faire aujourd’hui';
  if (diff === 1) return 'à faire d’ici demain';
  return `avant le ${shortDate(day, today)}`;
}

function effectiveTaskReminders(task: Pick<TaskRow, 'reminders'>, settings: Pick<TachesSettings, 'taskReminders'>): number[] {
  if (task.reminders === null || task.reminders === undefined) return settings.taskReminders ? [0] : [];
  return [...new Set(task.reminders.filter((r) => (TASK_REMINDERS as readonly number[]).includes(r)))];
}

/** Les rappels à venir de Tâches, comme `plannedReminders` du module. */
export function plannedTaskReminders(tasks: readonly TaskRow[], settings: TachesSettings, now: Date, timeZone: string): ReminderInput[] {
  const horizonDays = REMINDER_HORIZON_DAYS;
  const today = zonedDay(now, timeZone);
  const last = shiftDay(today, horizonDays - 1);
  const reminders: ReminderInput[] = [];

  for (const task of tasks) {
    if (task.completed_at || task.parent_id || !task.planned_day || !task.planned_time) continue;
    if (task.planned_day > last) continue;
    const start = zonedInstant(task.planned_day, task.planned_time, timeZone);
    for (const offset of effectiveTaskReminders(task, settings)) {
      const at = new Date(start.getTime() - offset * 60_000);
      if (at <= now) continue;
      reminders.push({
        ref: offset === 0 ? `task:${task.id}:${task.planned_day}` : `task:${task.id}:${task.planned_day}:${offset}`,
        fireAt: at.toISOString(),
        title: clip(task.title, REMINDER_TEXT_MAX),
        body: `Prévue à ${timeLabel(task.planned_time)}${task.due_day ? ` · ${dueLabel(task.due_day, task.planned_day)}` : ''}`,
      });
    }
  }

  if (settings.morningEnabled) {
    for (let i = 0; i < horizonDays; i++) {
      const day = shiftDay(today, i);
      const at = zonedInstant(day, settings.morningTime, timeZone);
      if (at <= now) continue;
      const view = todayView(tasks, day);
      const all = [...view.overdue, ...view.today];
      if (all.length === 0) continue;
      const urgent = all.filter((t) => t.priority === 'urgente').length;
      const shown = all.slice(0, 3).map((t) => clip(t.title, 80));
      reminders.push({
        ref: `morning:${day}`,
        fireAt: at.toISOString(),
        title: `☀️ ${plural(all.length, 'tâche')} aujourd’hui${urgent > 0 ? `, dont ${urgent} urgente${urgent > 1 ? 's' : ''}` : ''}`,
        body: `${shown.join(' · ')}${all.length > 3 ? ` et ${plural(all.length - 3, 'autre')}` : ''}`,
      });
    }
  }

  return reminders.sort((a, b) => a.fireAt.localeCompare(b.fireAt));
}

/** Après une écriture : un échec n'annule pas l'écriture, il est dit. */
async function resync(ctx: TachesContext): Promise<string | null> {
  try {
    const [tasks, settings] = await Promise.all([ctx.data.listTasks(), ctx.data.getSettings()]);
    await ctx.data.scheduleReminders(plannedTaskReminders(tasks, settings, new Date(ctx.now), ctx.timezone));
    return null;
  } catch (err) {
    return `Les rappels n’ont pas pu être recalculés (${err instanceof Error ? err.message : 'erreur'}) : ils le seront à la prochaine ouverture de Tâches.`;
  }
}

export function readRecurrence(v: unknown, plannedDay: string | null): Recurrence | null {
  if (v === null) return null;
  if (typeof v !== 'object') throw new Refused('repeat : un objet { freq, interval, … }, ou null.');
  const o = v as Record<string, unknown>;
  if (!(FREQUENCIES as readonly string[]).includes(String(o.freq))) throw new Refused(`repeat.freq : ${FREQUENCIES.join(', ')}.`);
  const rule: Recurrence = { freq: o.freq as Recurrence['freq'], interval: o.interval === undefined ? 1 : Number(o.interval) };
  if (Array.isArray(o.by_weekday)) rule.byWeekday = o.by_weekday.map(Number);
  if (o.nth !== undefined && o.nth_weekday !== undefined) rule.byNthWeekday = { nth: Number(o.nth) as 1, weekday: Number(o.nth_weekday) };
  if (o.until !== undefined && o.until !== null) rule.until = dayOrNull(o.until, 'repeat.until') ?? undefined;
  if (o.count !== undefined && o.count !== null) rule.count = Number(o.count);
  if (!plannedDay) throw new Refused('Une tâche répétée a besoin d’un jour prévu (planned_day).');
  const problem = validateRecurrence(rule, plannedDay);
  if (problem) throw new Refused(problem);
  return rule;
}

async function resolveList(data: TachesData, v: unknown): Promise<string | null> {
  if (v === null || v === '') return null;
  if (typeof v !== 'string') throw new Refused('list : le nom ou l’id d’une liste, ou null pour « À faire ».');
  const lists = await data.listLists();
  if (UUID.test(v)) {
    const found = lists.find((l) => l.id === v.toLowerCase());
    if (!found) throw new Refused('Aucune liste avec cet id : relis les listes.');
    return found.id;
  }
  const key = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
  const found = lists.find((l) => !l.archived && key(l.name) === key(v));
  if (!found) throw new Refused(`Aucune liste « ${v} » : crée-la d’abord (taches_liste_creer), ou ne donne pas de liste.`);
  return found.id;
}

/**
 * Les champs d'une tâche → colonnes, avec les règles de `validateTask` du
 * module : une heure a besoin d'un jour, une durée d'une heure, une
 * répétition d'un jour et pas de parent.
 */
async function taskColumns(args: Record<string, unknown>, data: TachesData, current: TaskRow | null): Promise<Record<string, unknown>> {
  const row: Record<string, unknown> = {};
  const has = (k: string) => args[k] !== undefined;
  if (!current || has('title')) row.title = text(args.title, 'Le titre', TASK_TITLE_MAX, true);
  if (has('note')) row.note = text(args.note, 'La note', NOTE_MAX);
  if (has('list')) row.list_id = await resolveList(data, args.list);
  if (has('planned_day')) row.planned_day = dayOrNull(args.planned_day, 'planned_day');
  if (has('planned_time')) row.planned_time = timeOrNull(args.planned_time);
  if (has('duration_minutes')) {
    const d = args.duration_minutes;
    if (d !== null && (typeof d !== 'number' || !Number.isInteger(d) || d < DURATION_MIN || d > DURATION_MAX)) throw new Refused('La durée va de 5 minutes à 24 heures (en minutes).');
    row.duration_minutes = d;
  }
  if (has('due_day')) row.due_day = dayOrNull(args.due_day, 'due_day');
  if (has('priority')) {
    if (!(PRIORITIES as readonly string[]).includes(String(args.priority))) throw new Refused(`La priorité : ${PRIORITIES.join(', ')}.`);
    row.priority = args.priority;
  }
  if (has('reminders')) {
    const r = args.reminders;
    if (r !== null && (!Array.isArray(r) || r.length > MAX_TASK_REMINDERS || r.some((x) => !(TASK_REMINDERS as readonly number[]).includes(Number(x))))) {
      throw new Refused(`reminders : au plus ${MAX_TASK_REMINDERS}, parmi ${TASK_REMINDERS.join(', ')} minutes avant ; null pour celui par défaut.`);
    }
    row.reminders = r === null ? null : (r as unknown[]).map(Number);
  }
  if (has('repeat_from')) {
    if (!(REPEAT_FROM as readonly string[]).includes(String(args.repeat_from))) throw new Refused('repeat_from : schedule (à date fixe) ou completion (après l’avoir faite).');
    row.repeat_from = args.repeat_from;
  }
  // La journée telle qu'elle sera, pour les règles qui lient les champs.
  const plannedDay = row.planned_day !== undefined ? (row.planned_day as string | null) : (current?.planned_day ?? null);
  const plannedTime = row.planned_time !== undefined ? (row.planned_time as string | null) : (current?.planned_time ?? null);
  if (has('repeat')) row.recurrence = readRecurrence(args.repeat, plannedDay);
  if (plannedTime && !plannedDay) throw new Refused('Une heure a besoin d’un jour (planned_day).');
  // Une heure retirée emporte sa durée, comme dans l'app.
  if (!plannedTime && (row.duration_minutes ?? current?.duration_minutes)) row.duration_minutes = null;
  const recurrence = row.recurrence !== undefined ? row.recurrence : (current?.recurrence ?? null);
  if (recurrence && !plannedDay) throw new Refused('Une tâche répétée a besoin d’un jour prévu.');
  if (recurrence && (current?.parent_id ?? null)) throw new Refused('Une sous-tâche ne se répète pas : c’est sa tâche qui se répète.');
  return row;
}

const taskOut = (t: TaskRow, all: readonly TaskRow[], lists: readonly ListRow[]) => {
  const subs = all.filter((s) => s.parent_id === t.id).sort((a, b) => a.position - b.position);
  return {
    id: t.id,
    title: t.title,
    list: t.list_id ? (lists.find((l) => l.id === t.list_id)?.name ?? null) : null,
    planned_day: t.planned_day,
    planned_time: t.planned_time ? t.planned_time.slice(0, 5) : null,
    duration_minutes: t.duration_minutes,
    due_day: t.due_day,
    priority: t.priority,
    repeat: t.recurrence && t.planned_day ? describeRecurrence(t.recurrence, t.planned_day) + (t.repeat_from === 'completion' ? ' (après l’avoir faite)' : '') : null,
    note: t.note || undefined,
    done: t.completed_at !== null,
    subtasks: subs.length ? subs.map((s) => ({ id: s.id, title: s.title, done: s.completed_at !== null })) : undefined,
  };
};

// --- Les outils --------------------------------------------------------------------------------

const S = { id: { type: 'string', description: 'Identifiant (uuid), tel que rendu par un autre outil.' } };

const TASK_FIELDS = {
  title: { type: 'string', maxLength: TASK_TITLE_MAX },
  note: { type: 'string', maxLength: NOTE_MAX },
  list: { type: ['string', 'null'], description: 'Le nom (ou l’id) d’une liste ; sans liste, la tâche va dans « À faire ».' },
  planned_day: { type: ['string', 'null'], description: 'Le jour où la faire, AAAA-MM-JJ : c’est lui qui la met dans « Aujourd’hui ».' },
  planned_time: { type: ['string', 'null'], description: 'L’heure, « 09:30 » (avec un jour).' },
  duration_minutes: { type: ['integer', 'null'], minimum: DURATION_MIN, maximum: DURATION_MAX, description: 'Avec une heure : sa durée dans le calendrier.' },
  due_day: { type: ['string', 'null'], description: 'L’échéance, si elle a une vraie date limite (AAAA-MM-JJ).' },
  priority: { type: 'string', enum: [...PRIORITIES] },
  reminders: { type: ['array', 'null'], items: { type: 'integer', enum: [...TASK_REMINDERS] }, description: 'Minutes avant l’heure (0 = à l’heure), deux au plus ; null : celui par défaut.' },
  repeat: {
    type: ['object', 'null'],
    description:
      'Une répétition (avec un jour prévu) : { freq: daily|weekly|monthly|yearly, interval: 1, by_weekday: [1,2,3,4,5] (0 = dimanche), nth + nth_weekday pour « le 1er lundi » (nth -1 = le dernier), until: AAAA-MM-JJ ou count }. null pour ne plus répéter.',
  },
  repeat_from: { type: 'string', enum: [...REPEAT_FROM], description: 'schedule : à date fixe ; completion : N jours/semaines… après l’avoir faite.' },
};

const baseTools: Tool<TachesContext>[] = [
  {
    name: 'taches_lister',
    title: 'Lire les tâches',
    description:
      'Les tâches, comme dans l’app : « aujourdhui » (les retards à part, puis ce qui est prévu aujourd’hui ou dont l’échéance approche), « a_venir » (les 14 jours suivants), « a_faire » (sans liste), « liste » (avec list), « terminees » (les 50 dernières), ou « toutes » (à faire). « query » filtre par mots.',
    inputSchema: {
      type: 'object',
      properties: {
        view: { type: 'string', enum: ['aujourdhui', 'a_venir', 'a_faire', 'liste', 'terminees', 'toutes'] },
        list: { type: 'string', description: 'Le nom ou l’id de la liste, avec view « liste ».' },
        query: { type: 'string' },
      },
      required: ['view'],
    },
    annotations: { readOnlyHint: true },
    async run(args, { data, today }) {
      const [all, lists] = await Promise.all([data.listTasks(), data.listLists()]);
      const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const words = fold(text(args.query, 'query', 200)).split(/\s+/).filter(Boolean);
      const hit = (t: TaskRow) => words.every((w) => fold(`${t.title} ${t.note}`).includes(w));
      const out = (ts: TaskRow[]) => ts.filter(hit).map((t) => taskOut(t, all, lists));
      switch (args.view) {
        case 'aujourdhui': {
          const v = todayView(all, today);
          return json({ today, overdue: out(v.overdue), today_tasks: out(v.today) });
        }
        case 'a_venir': {
          const days = Array.from({ length: UPCOMING_DAYS }, (_, i) => shiftDay(today, i + 1));
          const upcoming = days.map((day) => ({
            day,
            tasks: out(all.filter((t) => open(t) && (t.planned_day ?? t.due_day) === day).sort(compareTasks)),
          }));
          return json({ today, days: upcoming.filter((d) => d.tasks.length > 0) });
        }
        case 'a_faire':
          return json({ tasks: out(all.filter((t) => open(t) && t.list_id === null).sort(compareTasks)) });
        case 'liste': {
          const listId = await resolveList(data, args.list ?? '');
          if (!listId) throw new Refused('Donne la liste (list).');
          return json({ tasks: out(all.filter((t) => open(t) && t.list_id === listId).sort((a, b) => a.position - b.position)) });
        }
        case 'terminees':
          return json({
            tasks: out(
              all
                .filter((t) => t.completed_at && !t.parent_id)
                .sort((a, b) => (b.completed_at as string).localeCompare(a.completed_at as string))
                .slice(0, 50),
            ),
          });
        case 'toutes':
          return json({ tasks: out(all.filter(open).sort(compareTasks)) });
        default:
          throw new Refused('view : aujourdhui, a_venir, a_faire, liste, terminees ou toutes.');
      }
    },
  },
  {
    name: 'taches_ajouter',
    title: 'Ajouter une tâche',
    description:
      'Ajoute une tâche. Lis toi-même la demande : « demain 9 h » donne planned_day et planned_time, « avant vendredi » une échéance (due_day), « tous les lundis » une répétition. Sans liste, elle va dans « À faire ». Des sous-tâches peuvent être données d’un coup (subtasks), ou la tâche peut être la sous-tâche d’une autre (parent_id).',
    inputSchema: {
      type: 'object',
      properties: {
        ...TASK_FIELDS,
        parent_id: { type: 'string', description: 'Pour une sous-tâche : la tâche parente (un seul niveau).' },
        subtasks: { type: 'array', items: { type: 'string' }, maxItems: 30 },
      },
      required: ['title'],
    },
    annotations: {},
    async run(args, { data, newId }) {
      const all = await data.listTasks();
      let parent: TaskRow | null = null;
      if (args.parent_id !== undefined && args.parent_id !== null) {
        parent = all.find((t) => t.id === id(args.parent_id, 'parent_id')) ?? null;
        if (!parent) throw new Refused('La tâche parente n’existe pas.');
        if (parent.parent_id) throw new Refused('Une sous-tâche ne peut pas avoir de sous-tâches : un seul niveau.');
        if (args.repeat) throw new Refused('Une sous-tâche ne se répète pas : c’est sa tâche qui se répète.');
      }
      const row = await taskColumns(args, data, null);
      if (parent) row.list_id = parent.list_id;
      const siblings = all.filter((t) => (parent ? t.parent_id === parent.id : !t.parent_id && t.list_id === (row.list_id ?? null)));
      const created = await data.insertTask({
        id: newId(),
        ...row,
        parent_id: parent?.id ?? null,
        position: siblings.length ? Math.max(...siblings.map((t) => t.position)) + 1 : 0,
      });
      const subs: TaskRow[] = [];
      if (Array.isArray(args.subtasks)) {
        if (parent) throw new Refused('Une sous-tâche ne peut pas avoir de sous-tâches.');
        for (const [i, title] of args.subtasks.entries()) {
          subs.push(
            await data.insertTask({ id: newId(), title: text(title, 'Une sous-tâche', TASK_TITLE_MAX, true), parent_id: created.id, list_id: created.list_id, position: i }),
          );
        }
      }
      const lists = await data.listLists();
      return json({ message: 'Tâche ajoutée.', task: taskOut(created, [...all, created, ...subs], lists) });
    },
  },
  {
    name: 'taches_modifier',
    title: 'Modifier une tâche',
    description: 'Modifie une tâche : seuls les champs donnés changent ; null retire un jour, une heure, une échéance ou une répétition.',
    inputSchema: { type: 'object', properties: { id: S.id, ...TASK_FIELDS }, required: ['id'] },
    annotations: { idempotentHint: true },
    async run(args, { data }) {
      const all = await data.listTasks();
      const task = all.find((t) => t.id === id(args.id));
      if (!task) throw new Refused('Aucune tâche avec cet identifiant : relis les tâches.');
      const { id: _id, ...rest } = args;
      const row = await taskColumns(rest, data, task);
      if (Object.keys(row).length === 0) throw new Refused('Rien à modifier : donne au moins un champ.');
      // Changer de liste emmène les sous-tâches.
      const updated = await data.updateTask(task.id, row);
      if (row.list_id !== undefined) for (const s of all.filter((x) => x.parent_id === task.id)) await data.updateTask(s.id, { list_id: row.list_id });
      return json({ message: 'Tâche modifiée.', task: updated && taskOut(updated, all, await data.listLists()) });
    },
  },
  {
    name: 'taches_cocher',
    title: 'Cocher une tâche',
    description:
      'Marque une tâche faite (done, par défaut) ou la remet à faire (done: false). Une tâche répétée cochée garde une trace dans « Terminées » et passe à sa prochaine fois, comme dans l’app ; elle ne se décoche pas d’ici.',
    inputSchema: { type: 'object', properties: { id: S.id, done: { type: 'boolean' } }, required: ['id'] },
    annotations: {},
    async run(args, { data, today, now, newId }) {
      const all = await data.listTasks();
      const task = all.find((t) => t.id === id(args.id));
      if (!task) throw new Refused('Aucune tâche avec cet identifiant : relis les tâches.');
      if (args.done === false) {
        if (!task.completed_at) return { text: `« ${task.title} » était déjà à faire.` };
        await data.updateTask(task.id, { completed_at: null });
        return { text: `« ${task.title} » est de nouveau à faire.` };
      }
      if (task.completed_at) return { text: `« ${task.title} » était déjà faite.` };
      const next = nextOccurrence(task, today);
      if (!next) {
        await data.updateTask(task.id, { completed_at: now });
        return { text: `« ${task.title} » est faite.` };
      }
      // Une tâche répétée : la copie terminée d'abord (au pire un doublon, jamais une occurrence perdue), puis la tâche avance.
      const { id: _id, completed_at: _c, created_at: _cr, recurrence: _r, ...fields } = task;
      await data.insertTask({ ...fields, id: newId(), recurrence: null, completed_at: now });
      const shift = daysBetween(task.planned_day as string, next.plannedDay);
      await data.updateTask(task.id, {
        planned_day: next.plannedDay,
        due_day: task.due_day ? shiftDay(task.due_day, shift) : null,
        recurrence: next.recurrence,
      });
      for (const s of all.filter((x) => x.parent_id === task.id && x.completed_at)) await data.updateTask(s.id, { completed_at: null });
      return { text: `« ${task.title} » est faite ; prochaine fois le ${next.plannedDay}.` };
    },
  },
  {
    name: 'taches_supprimer',
    title: 'Supprimer une tâche',
    description: 'Supprime une tâche pour de bon, avec ses sous-tâches. Demande confirmation avant.',
    inputSchema: { type: 'object', properties: { id: S.id }, required: ['id'] },
    annotations: { destructiveHint: true },
    async run(args, { data }) {
      const task = (await data.listTasks()).find((t) => t.id === id(args.id));
      if (!task) throw new Refused('Aucune tâche avec cet identifiant.');
      await data.deleteTask(task.id);
      return { text: `« ${task.title} » supprimée.` };
    },
  },
  {
    name: 'taches_listes',
    title: 'Lire les listes',
    description: 'Les listes de tâches (nom, couleur, archivée ou non) et le nombre de tâches à faire dans chacune.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true },
    async run(_args, { data }) {
      const [lists, tasks] = await Promise.all([data.listLists(), data.listTasks()]);
      return json({
        a_faire_sans_liste: tasks.filter((t) => open(t) && !t.list_id).length,
        lists: lists
          .sort((a, b) => a.position - b.position)
          .map((l) => ({ id: l.id, name: l.name, color: l.color, archived: l.archived, open_tasks: tasks.filter((t) => open(t) && t.list_id === l.id).length })),
      });
    },
  },
  {
    name: 'taches_liste_creer',
    title: 'Créer une liste',
    description: 'Crée une liste de tâches (« Maison », « Papiers »).',
    inputSchema: { type: 'object', properties: { name: { type: 'string', maxLength: LIST_NAME_MAX }, color: { type: 'string', enum: [...LIST_COLORS] } }, required: ['name'] },
    annotations: {},
    async run(args, { data, newId }) {
      const name = text(args.name, 'Le nom', LIST_NAME_MAX, true);
      const lists = await data.listLists();
      if (lists.some((l) => !l.archived && l.name.toLowerCase() === name.toLowerCase())) throw new Refused(`La liste « ${name} » existe déjà.`);
      const color = args.color === undefined ? 'bleu' : String(args.color);
      if (!(LIST_COLORS as readonly string[]).includes(color)) throw new Refused(`La couleur : ${LIST_COLORS.join(', ')}.`);
      const created = await data.insertList({ id: newId(), name, color, position: lists.length ? Math.max(...lists.map((l) => l.position)) + 1 : 0 });
      return json({ message: `Liste « ${created.name} » créée.`, list: created });
    },
  },
  {
    name: 'taches_liste_modifier',
    title: 'Modifier une liste',
    description: 'Renomme une liste, change sa couleur, ou l’archive (archived: true) — ses tâches restent.',
    inputSchema: {
      type: 'object',
      properties: { id: S.id, name: { type: 'string', maxLength: LIST_NAME_MAX }, color: { type: 'string', enum: [...LIST_COLORS] }, archived: { type: 'boolean' } },
      required: ['id'],
    },
    annotations: { idempotentHint: true },
    async run(args, { data }) {
      const row: Record<string, unknown> = {};
      if (args.name !== undefined) row.name = text(args.name, 'Le nom', LIST_NAME_MAX, true);
      if (args.color !== undefined) {
        if (!(LIST_COLORS as readonly string[]).includes(String(args.color))) throw new Refused(`La couleur : ${LIST_COLORS.join(', ')}.`);
        row.color = args.color;
      }
      if (args.archived !== undefined) row.archived = args.archived === true;
      if (Object.keys(row).length === 0) throw new Refused('Rien à modifier.');
      const updated = await data.updateList(id(args.id), row);
      if (!updated) throw new Refused('Aucune liste avec cet identifiant.');
      return json({ message: 'Liste modifiée.', list: updated });
    },
  },
];

/** Les écritures qui changent ce qui doit sonner. */
const CHANGES_REMINDERS = new Set(['taches_ajouter', 'taches_modifier', 'taches_cocher', 'taches_supprimer']);

export const tachesTools: Tool<TachesContext>[] = baseTools.map((tool) =>
  CHANGES_REMINDERS.has(tool.name)
    ? {
        ...tool,
        async run(args, ctx) {
          const result = await tool.run(args, ctx);
          const warning = await resync(ctx);
          return warning ? { ...result, text: `${result.text}\n\n⚠ ${warning}` } : result;
        },
      }
    : tool,
);
