/**
 * Les outils de Projets pour Claude (docs/connecteur-claude.md §18) — règles
 * pures, testées par Vitest (`src/modules/projets/lib/mcpTools.test.ts`).
 *
 * Priorité n° 8 de l'analyse du 11/10/2026 : en sortant d'un rendez-vous
 * client, « note que le fleuriste veut une page boutique, ajoute la tâche,
 * j'y ai passé 1 h 30, et on attend ses photos » ; « le food truck a payé
 * l'acompte par virement ». Claude lit le tableau de bord et la fiche d'un
 * projet, ajoute et coche des tâches, tient le journal, note le temps passé,
 * pose ou lève « en attente du client », change le statut, et reçoit un
 * paiement.
 *
 * Un paiement reçu va à Budget comme dans l'app (`ProjetsScreen.receive`) :
 * le paiement d'abord, l'entrée ensuite, sous la référence
 * `projets:paiement:<numéro>` qui l'empêche d'entrer deux fois, rangée dans
 * « Revenus freelance » si la catégorie existe. Le reste — clients,
 * questionnaire, design, liens, images, échéancier — se tient dans l'app.
 * Aucun mot de passe n'est jamais rendu (il n'y en a pas : CLAUDE.md §1).
 */
import type { Tool, ToolResult } from './mcp.ts';

export const PROJECT_STATUSES = ['lead', 'quoted', 'signed', 'production', 'delivered', 'maintenance', 'done', 'lost'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const STATUS_LABELS: Record<ProjectStatus, string> = {
  lead: 'Piste',
  quoted: 'Devis envoyé',
  signed: 'Signé',
  production: 'En production',
  delivered: 'Livré',
  maintenance: 'Maintenance',
  done: 'Terminé',
  lost: 'Perdu',
};
export const PAYMENT_METHODS = ['virement', 'carte', 'cheque', 'especes', 'autre'] as const;
export const TASK_TITLE_MAX = 500;
export const NOTE_TEXT_MAX = 4000;
export const TIME_NOTE_MAX = 300;
export const TIME_ENTRY_MAX_MINUTES = 1440;
export const WAITING_MAX = 200;
export const BUDGET_CATEGORY = 'Revenus freelance';
export const budgetRef = (number: number) => `projets:paiement:${number}`;

export interface ClientRow {
  id: string;
  name: string;
}
export interface ProjectRow {
  id: string;
  client_id: string;
  number: number;
  title: string;
  status: ProjectStatus;
  waiting_for: string | null;
  waiting_since: string | null;
  start_day: string | null;
  due_day: string | null;
  price_cents: number | null;
  note: string;
}
export interface WorkstreamRow {
  id: string;
  project_id: string;
  title: string;
  position: number;
  due_day: string | null;
}
export interface TaskRow {
  id: string;
  project_id: string;
  workstream_id: string;
  title: string;
  note: string;
  planned_day: string | null;
  due_day: string | null;
  waiting_client: boolean;
  position: number;
  completed_at: string | null;
}
export interface NoteRow {
  id: string;
  project_id: string;
  day: string;
  text: string;
  created_at: string;
}
export interface PaymentRow {
  id: string;
  project_id: string;
  number: number;
  label: string;
  amount_cents: number;
  expected_day: string | null;
  received_day: string | null;
  method: string | null;
  invoice_ref: string;
}
export interface TimeRow {
  id: string;
  project_id: string;
  workstream_id: string | null;
  day: string;
  minutes: number;
  note: string;
}

export interface ProjetsRows {
  clients: ClientRow[];
  projects: ProjectRow[];
  workstreams: WorkstreamRow[];
  tasks: TaskRow[];
  notes: NoteRow[];
  payments: PaymentRow[];
  time: TimeRow[];
}

type Table = 'projets_projects' | 'projets_tasks' | 'projets_notes' | 'projets_payments' | 'projets_time';

export interface ProjetsData {
  load(): Promise<ProjetsRows>;
  insert<R>(table: Table, row: Record<string, unknown>): Promise<R>;
  update<R>(table: Table, id: string, row: Record<string, unknown>): Promise<R | null>;
  remove(table: Table, id: string): Promise<boolean>;
  /** Une entrée dans Budget, rejouable (la référence la garde unique) ; `false` si elle y était déjà. */
  recordIncome(entry: { ref: string; day: string; label: string; amountCents: number; categoryName: string; note: string }): Promise<boolean>;
}

export interface ProjetsContext {
  data: ProjetsData;
  today: string;
}

// --- L'état d'un chantier (copie de `workstreamState`, lib/progress.ts) ---------

export type WorkstreamState = 'waiting' | 'doing' | 'todo' | 'done' | 'empty';
export const WORKSTREAM_STATE_LABELS: Record<WorkstreamState, string> = {
  waiting: 'Attend le client',
  doing: 'En cours',
  todo: 'À faire',
  done: 'Fait',
  empty: 'Sans tâche',
};

export function workstreamState(tasks: readonly TaskRow[], today: string): WorkstreamState {
  if (tasks.length === 0) return 'empty';
  const open = tasks.filter((t) => t.completed_at === null);
  if (open.length === 0) return 'done';
  if (open.some((t) => t.waiting_client)) return 'waiting';
  if (open.length < tasks.length) return 'doing';
  if (open.some((t) => t.planned_day !== null && t.planned_day <= today)) return 'doing';
  return 'todo';
}

/** « 1h30 », « 90 », « 1,5 h », « 45 min » → minutes (`parseDuration` du module). */
export function parseDuration(text: string): number | null {
  const t = text.trim().toLowerCase().replace(',', '.').replace(/\s+/g, '');
  let minutes: number | null = null;
  let m: RegExpExecArray | null;
  if ((m = /^(\d+)h(\d{1,2})?(min)?$/.exec(t))) minutes = Number(m[1]) * 60 + Number(m[2] ?? 0);
  else if ((m = /^(\d+(?:\.\d+)?)h$/.exec(t))) minutes = Math.round(Number(m[1]) * 60);
  else if ((m = /^(\d+)(min|mn|m)?$/.exec(t))) minutes = Number(m[1]);
  if (minutes === null || minutes <= 0 || minutes > TIME_ENTRY_MAX_MINUTES) return null;
  return minutes;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

// --- Les outils ---------------------------------------------------------------

class Refused extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const json = (value: unknown): ToolResult => ({ text: JSON.stringify(value, null, 2) });
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();
const euros = (cents: number) => Math.round(cents) / 100;
const CLOSED: ProjectStatus[] = ['done', 'lost'];

function dayOr(v: unknown, fallback: string | null, what: string): string | null {
  if (v === undefined) return fallback;
  if (v === null) return null;
  if (typeof v !== 'string' || !DAY.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) throw new Refused(`${what} s’écrit AAAA-MM-JJ.`);
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

/** Un projet par son numéro (« 3 », « n°3 »), son id, ou son titre / le nom de son client. */
export function findProject(rows: ProjetsRows, v: unknown): ProjectRow {
  if ((typeof v !== 'string' && typeof v !== 'number') || String(v).trim() === '') throw new Refused('project : le numéro, le titre ou le client d’un projet.');
  const s = String(v).trim();
  const number = /^(?:n\s*°?\s*)?(\d+)$/i.exec(s);
  if (number) {
    const found = rows.projects.find((p) => p.number === Number(number[1]));
    if (found) return found;
    throw new Refused(`Aucun projet n° ${number[1]}.`);
  }
  if (UUID.test(s)) {
    const found = rows.projects.find((p) => p.id === s.toLowerCase());
    if (found) return found;
  }
  const client = (p: ProjectRow) => rows.clients.find((c) => c.id === p.client_id)?.name ?? '';
  const exact = rows.projects.filter((p) => fold(p.title) === fold(s) || fold(client(p)) === fold(s));
  const loose = exact.length ? exact : rows.projects.filter((p) => fold(`${p.title} ${client(p)}`).includes(fold(s)));
  const open = loose.filter((p) => !CLOSED.includes(p.status));
  const pick = open.length ? open : loose;
  if (pick.length === 1) return pick[0];
  if (pick.length > 1) throw new Refused(`Plusieurs projets répondent à « ${s} » : ${pick.map((p) => `n° ${p.number} ${p.title} (${client(p)})`).join(', ')}. Donne le numéro.`);
  throw new Refused(`Aucun projet « ${s} » : projets_tableau les liste.`);
}

function findWorkstream(rows: ProjetsRows, project: ProjectRow, v: unknown): WorkstreamRow {
  const mine = rows.workstreams.filter((w) => w.project_id === project.id).sort((a, b) => a.position - b.position);
  if (mine.length === 0) throw new Refused('Ce projet n’a aucun chantier : crée-en un dans l’app.');
  if (v === undefined) {
    if (mine.length === 1) return mine[0];
    throw new Refused(`workstream : le chantier où ranger la tâche, parmi ${mine.map((w) => `« ${w.title} »`).join(', ')}.`);
  }
  const s = String(v);
  const found = UUID.test(s) ? mine.filter((w) => w.id === s.toLowerCase()) : mine.filter((w) => fold(w.title) === fold(s));
  const loose = found.length ? found : mine.filter((w) => fold(w.title).includes(fold(s)));
  if (loose.length === 1) return loose[0];
  throw new Refused(`Chantier « ${s} » introuvable ou ambigu, parmi ${mine.map((w) => `« ${w.title} »`).join(', ')}.`);
}

const taskOut = (t: TaskRow) => ({
  id: t.id,
  title: t.title,
  done: t.completed_at !== null || undefined,
  planned: t.planned_day ?? undefined,
  due: t.due_day ?? undefined,
  waiting_client: t.waiting_client || undefined,
  note: t.note || undefined,
});

const taskDay = (t: TaskRow) => t.planned_day ?? t.due_day;

function money(project: ProjectRow, payments: readonly PaymentRow[], today: string) {
  const own = payments.filter((p) => p.project_id === project.id);
  const planned = own.reduce((s, p) => s + p.amount_cents, 0);
  const received = own.filter((p) => p.received_day).reduce((s, p) => s + p.amount_cents, 0);
  const target = project.price_cents ?? planned;
  return {
    price: project.price_cents === null ? undefined : euros(project.price_cents),
    received: euros(received),
    remaining: euros(Math.max(0, target - received)),
    late: own.filter((p) => !p.received_day && p.expected_day !== null && p.expected_day < today).map((p) => ({ label: p.label, amount: euros(p.amount_cents), expected: p.expected_day })),
  };
}

function summary(rows: ProjetsRows, p: ProjectRow, today: string) {
  const tasks = rows.tasks.filter((t) => t.project_id === p.id);
  const open = tasks.filter((t) => t.completed_at === null);
  const minutes = rows.time.filter((t) => t.project_id === p.id).reduce((s, t) => s + t.minutes, 0);
  return {
    number: p.number,
    title: p.title,
    client: rows.clients.find((c) => c.id === p.client_id)?.name,
    status: STATUS_LABELS[p.status],
    due: p.due_day ?? undefined,
    waiting_for: p.waiting_for ? { what: p.waiting_for, since: p.waiting_since } : undefined,
    tasks: `${tasks.length - open.length}/${tasks.length}`,
    late_tasks: open.filter((t) => (taskDay(t) ?? '9999') < today).map((t) => t.title),
    time_spent: minutes ? formatDuration(minutes) : undefined,
    money: money(p, rows.payments, today),
  };
}

const STATUS_IN: Record<string, ProjectStatus> = Object.fromEntries([
  ...PROJECT_STATUSES.map((s) => [s, s]),
  ...PROJECT_STATUSES.map((s) => [fold(STATUS_LABELS[s]), s]),
  ['piste', 'lead'],
  ['devis', 'quoted'],
  ['signe', 'signed'],
  ['production', 'production'],
  ['livre', 'delivered'],
  ['termine', 'done'],
  ['perdu', 'lost'],
]);

export const projetsTools: Tool<ProjetsContext>[] = [
  {
    name: 'projets_tableau',
    title: 'Le tableau de bord des projets',
    description:
      'Les projets en cours (pas terminés ni perdus ; « tous » pour les avoir tous) : client, statut, échéance, attente du client, tâches faites, en retard, temps passé, argent (reçu, reste, paiements en retard) — et les tâches prévues dans les 7 prochains jours.',
    inputSchema: { type: 'object', properties: { tous: { type: 'boolean' } } },
    annotations: { readOnlyHint: true },
    async run(args, { data, today }) {
      const rows = await data.load();
      const shown = rows.projects.filter((p) => args.tous === true || !CLOSED.includes(p.status)).sort((a, b) => a.number - b.number);
      const week = new Date(`${today}T00:00:00Z`);
      week.setUTCDate(week.getUTCDate() + 7);
      const limit = week.toISOString().slice(0, 10);
      return json({
        projects: shown.map((p) => summary(rows, p, today)),
        this_week: rows.tasks
          .filter((t) => t.completed_at === null && taskDay(t) !== null && taskDay(t)! >= today && taskDay(t)! <= limit && shown.some((p) => p.id === t.project_id))
          .sort((a, b) => taskDay(a)!.localeCompare(taskDay(b)!))
          .map((t) => ({ project: rows.projects.find((p) => p.id === t.project_id)?.number, ...taskOut(t) })),
      });
    },
  },
  {
    name: 'projets_projet',
    title: 'La fiche d’un projet',
    description: 'Un projet en détail : chantiers et leurs tâches (id, état), journal récent, paiements (numéro, attendu, reçu), temps passé et taux horaire réel.',
    inputSchema: { type: 'object', properties: { project: { type: 'string', description: 'Numéro, titre ou client.' } }, required: ['project'] },
    annotations: { readOnlyHint: true },
    async run(args, { data, today }) {
      const rows = await data.load();
      const p = findProject(rows, args.project);
      const tasks = rows.tasks.filter((t) => t.project_id === p.id);
      const minutes = rows.time.filter((t) => t.project_id === p.id).reduce((s, t) => s + t.minutes, 0);
      const received = rows.payments.filter((x) => x.project_id === p.id && x.received_day).reduce((s, x) => s + x.amount_cents, 0);
      return json({
        ...summary(rows, p, today),
        id: p.id,
        start: p.start_day ?? undefined,
        note: p.note || undefined,
        workstreams: rows.workstreams
          .filter((w) => w.project_id === p.id)
          .sort((a, b) => a.position - b.position)
          .map((w) => {
            const mine = tasks.filter((t) => t.workstream_id === w.id).sort((a, b) => a.position - b.position);
            return { id: w.id, title: w.title, state: WORKSTREAM_STATE_LABELS[workstreamState(mine, today)], due: w.due_day ?? undefined, tasks: mine.map(taskOut) };
          }),
        journal: rows.notes
          .filter((n) => n.project_id === p.id)
          .sort((a, b) => b.day.localeCompare(a.day) || b.created_at.localeCompare(a.created_at))
          .slice(0, 15)
          .map((n) => ({ day: n.day, text: n.text })),
        payments: rows.payments
          .filter((x) => x.project_id === p.id)
          .map((x) => ({ number: x.number, label: x.label, amount: euros(x.amount_cents), expected: x.expected_day ?? undefined, received: x.received_day ?? undefined, method: x.method ?? undefined })),
        hourly_rate: minutes && received ? euros(Math.round((received * 60) / minutes)) : undefined,
      });
    },
  },
  {
    name: 'projets_tache_ajouter',
    title: 'Ajouter une tâche à un projet',
    description: 'Ajoute une tâche dans un chantier du projet (workstream : son titre ; facultatif s’il n’y en a qu’un), avec un jour prévu, une échéance, « attend le client ».',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string' },
        workstream: { type: 'string' },
        title: { type: 'string', maxLength: TASK_TITLE_MAX },
        planned_day: { type: 'string' },
        due_day: { type: 'string' },
        waiting_client: { type: 'boolean' },
        note: { type: 'string', maxLength: NOTE_TEXT_MAX },
      },
      required: ['project', 'title'],
    },
    annotations: {},
    async run(args, { data }) {
      const rows = await data.load();
      const p = findProject(rows, args.project);
      const w = findWorkstream(rows, p, args.workstream);
      const position = Math.max(-1, ...rows.tasks.filter((t) => t.workstream_id === w.id).map((t) => t.position)) + 1;
      const created = await data.insert<TaskRow>('projets_tasks', {
        project_id: p.id,
        workstream_id: w.id,
        title: text(args.title, 'Le titre', TASK_TITLE_MAX, true),
        note: text(args.note, 'La note', NOTE_TEXT_MAX),
        planned_day: dayOr(args.planned_day, null, 'planned_day'),
        due_day: dayOr(args.due_day, null, 'due_day'),
        waiting_client: args.waiting_client === true,
        position,
      });
      return json({ message: `Tâche ajoutée à « ${w.title} » (n° ${p.number}).`, task: taskOut(created) });
    },
  },
  {
    name: 'projets_tache_modifier',
    title: 'Modifier ou cocher une tâche',
    description: 'Change une tâche d’un projet (id dans projets_projet) : done (cochée ou non), titre, jour prévu, échéance (null pour retirer), « attend le client », note.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        done: { type: 'boolean' },
        title: { type: 'string' },
        planned_day: { type: ['string', 'null'] },
        due_day: { type: ['string', 'null'] },
        waiting_client: { type: 'boolean' },
        note: { type: 'string' },
      },
      required: ['id'],
    },
    annotations: { idempotentHint: true },
    async run(args, { data }) {
      const id = typeof args.id === 'string' && UUID.test(args.id) ? args.id.toLowerCase() : null;
      if (!id) throw new Refused('id invalide : prends-le dans projets_projet.');
      const rows = await data.load();
      const task = rows.tasks.find((t) => t.id === id);
      if (!task) throw new Refused('Aucune tâche de projet avec cet id.');
      const row: Record<string, unknown> = {};
      if (args.title !== undefined) row.title = text(args.title, 'Le titre', TASK_TITLE_MAX, true);
      if (args.note !== undefined) row.note = text(args.note, 'La note', NOTE_TEXT_MAX);
      if (args.planned_day !== undefined) row.planned_day = dayOr(args.planned_day, null, 'planned_day');
      if (args.due_day !== undefined) row.due_day = dayOr(args.due_day, null, 'due_day');
      if (typeof args.waiting_client === 'boolean') row.waiting_client = args.waiting_client;
      if (typeof args.done === 'boolean') row.completed_at = args.done ? (task.completed_at ?? new Date().toISOString()) : null;
      if (Object.keys(row).length === 0) throw new Refused('Rien à changer.');
      const updated = await data.update<TaskRow>('projets_tasks', id, row);
      return json({ message: args.done === true ? 'Tâche cochée.' : args.done === false ? 'Tâche décochée.' : 'Tâche modifiée.', task: updated && taskOut(updated) });
    },
  },
  {
    name: 'projets_tache_supprimer',
    title: 'Supprimer une tâche de projet',
    description: 'Supprime une tâche d’un projet. Demande confirmation avant.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    annotations: { destructiveHint: true },
    async run(args, { data }) {
      const id = typeof args.id === 'string' && UUID.test(args.id) ? args.id.toLowerCase() : null;
      if (!id || !(await data.remove('projets_tasks', id))) throw new Refused('Aucune tâche de projet avec cet id.');
      return { text: 'Tâche supprimée.' };
    },
  },
  {
    name: 'projets_note',
    title: 'Écrire au journal d’un projet',
    description: 'Ajoute une entrée datée au journal d’un projet : un appel, un rendez-vous, une décision du client (aujourd’hui par défaut).',
    inputSchema: { type: 'object', properties: { project: { type: 'string' }, text: { type: 'string', maxLength: NOTE_TEXT_MAX }, day: { type: 'string' } }, required: ['project', 'text'] },
    annotations: {},
    async run(args, { data, today }) {
      const p = findProject(await data.load(), args.project);
      await data.insert<NoteRow>('projets_notes', { project_id: p.id, day: dayOr(args.day, today, 'day'), text: text(args.text, 'Le texte', NOTE_TEXT_MAX, true) });
      return { text: `Noté au journal du projet n° ${p.number} « ${p.title} ».` };
    },
  },
  {
    name: 'projets_temps',
    title: 'Noter du temps passé',
    description: 'Note le temps passé sur un projet (« 1h30 », « 45 min », ou des minutes), un jour (aujourd’hui par défaut), sur un chantier si tu le sais, avec une note courte.',
    inputSchema: {
      type: 'object',
      properties: { project: { type: 'string' }, duration: { type: 'string', description: '« 1h30 », « 45 min », « 90 »' }, day: { type: 'string' }, workstream: { type: 'string' }, note: { type: 'string', maxLength: TIME_NOTE_MAX } },
      required: ['project', 'duration'],
    },
    annotations: {},
    async run(args, { data, today }) {
      const rows = await data.load();
      const p = findProject(rows, args.project);
      const minutes = parseDuration(String(args.duration ?? ''));
      if (minutes === null) throw new Refused('duration : « 1h30 », « 45 min » ou un nombre de minutes, 24 h au plus.');
      const w = args.workstream === undefined ? null : findWorkstream(rows, p, args.workstream);
      await data.insert<TimeRow>('projets_time', { project_id: p.id, workstream_id: w?.id ?? null, day: dayOr(args.day, today, 'day'), minutes, note: text(args.note, 'La note', TIME_NOTE_MAX) });
      const total = rows.time.filter((t) => t.project_id === p.id).reduce((s, t) => s + t.minutes, 0) + minutes;
      return { text: `${formatDuration(minutes)} notées sur le projet n° ${p.number} (${formatDuration(total)} en tout).` };
    },
  },
  {
    name: 'projets_attente',
    title: 'En attente du client',
    description: 'Dit ce que le projet attend du client (« les photos de la boutique »), depuis aujourd’hui ; null quand c’est reçu.',
    inputSchema: { type: 'object', properties: { project: { type: 'string' }, waiting_for: { type: ['string', 'null'], maxLength: WAITING_MAX } }, required: ['project', 'waiting_for'] },
    annotations: { idempotentHint: true },
    async run(args, { data, today }) {
      const p = findProject(await data.load(), args.project);
      if (args.waiting_for === null || args.waiting_for === '') {
        await data.update('projets_projects', p.id, { waiting_for: null, waiting_since: null, updated_at: new Date().toISOString() });
        return { text: `Le projet n° ${p.number} n’attend plus le client.` };
      }
      const what = text(args.waiting_for, 'waiting_for', WAITING_MAX, true);
      await data.update('projets_projects', p.id, { waiting_for: what, waiting_since: p.waiting_for ? (p.waiting_since ?? today) : today, updated_at: new Date().toISOString() });
      return { text: `Le projet n° ${p.number} attend : ${what}.` };
    },
  },
  {
    name: 'projets_statut',
    title: 'Changer le statut d’un projet',
    description: `Le statut de la relation avec le client : ${PROJECT_STATUSES.map((s) => `${s} (${STATUS_LABELS[s]})`).join(', ')}.`,
    inputSchema: { type: 'object', properties: { project: { type: 'string' }, status: { type: 'string', enum: [...PROJECT_STATUSES] } }, required: ['project', 'status'] },
    annotations: { idempotentHint: true },
    async run(args, { data }) {
      const p = findProject(await data.load(), args.project);
      const status = STATUS_IN[fold(String(args.status ?? ''))];
      if (!status) throw new Refused(`status : ${PROJECT_STATUSES.join(', ')}.`);
      await data.update('projets_projects', p.id, { status, updated_at: new Date().toISOString() });
      return { text: `Projet n° ${p.number} : ${STATUS_LABELS[status]}.` };
    },
  },
  {
    name: 'projets_paiement_recu',
    title: 'Recevoir un paiement',
    description:
      'Marque un paiement prévu du projet comme reçu (payment : son numéro ou son libellé, « Acompte », « Solde »), le jour et le mode de règlement, puis l’ajoute à Budget comme une entrée (budget: false pour ne pas). Rejouer ne l’ajoute pas deux fois.',
    inputSchema: {
      type: 'object',
      properties: {
        project: { type: 'string' },
        payment: { type: 'string' },
        received_day: { type: 'string' },
        method: { type: 'string', enum: [...PAYMENT_METHODS] },
        invoice_ref: { type: 'string', maxLength: 60 },
        budget: { type: 'boolean' },
      },
      required: ['project', 'payment', 'method'],
    },
    annotations: {},
    async run(args, { data, today }) {
      const rows = await data.load();
      const p = findProject(rows, args.project);
      const own = rows.payments.filter((x) => x.project_id === p.id);
      const s = String(args.payment ?? '').trim();
      const byNumber = /^\d+$/.test(s) ? own.filter((x) => x.number === Number(s)) : [];
      const byLabel = own.filter((x) => fold(x.label) === fold(s) || fold(x.label).includes(fold(s)));
      const candidates = byNumber.length ? byNumber : byLabel.filter((x) => !x.received_day).length ? byLabel.filter((x) => !x.received_day) : byLabel;
      if (candidates.length !== 1)
        throw new Refused(
          candidates.length
            ? `Plusieurs paiements répondent à « ${s} » : donne son numéro (${candidates.map((x) => `${x.number} ${x.label}`).join(', ')}).`
            : `Aucun paiement « ${s} » sur ce projet${own.length ? ` (${own.map((x) => `${x.number} ${x.label}`).join(', ')})` : ' : l’échéancier se fait dans l’app'}.`,
        );
      const payment = candidates[0];
      if (!(PAYMENT_METHODS as readonly string[]).includes(String(args.method))) throw new Refused(`method : ${PAYMENT_METHODS.join(', ')}.`);
      const received = dayOr(args.received_day, today, 'received_day')!;
      if (received > today) throw new Refused('Un paiement se reçoit aujourd’hui ou avant.');
      const invoice = args.invoice_ref === undefined ? payment.invoice_ref : text(args.invoice_ref, 'invoice_ref', 60);
      // Le paiement d'abord, Budget ensuite : un échec de Budget laisse le paiement noté.
      await data.update('projets_payments', payment.id, { received_day: received, method: args.method, invoice_ref: invoice });
      let budget = 'pas ajouté à Budget (demandé)';
      if (args.budget !== false) {
        const client = rows.clients.find((c) => c.id === p.client_id)?.name ?? 'Client';
        try {
          const added = await data.recordIncome({
            ref: budgetRef(payment.number),
            day: received,
            label: `${client} — ${payment.label}`,
            amountCents: payment.amount_cents,
            categoryName: BUDGET_CATEGORY,
            note: `Projets, projet n° ${p.number} « ${p.title} »${invoice ? `, facture ${invoice}` : ''}`,
          });
          budget = added ? 'ajouté à Budget' : 'déjà dans Budget';
        } catch (err) {
          budget = `pas ajouté à Budget (${err instanceof Error ? err.message : 'erreur'}) : « Ajouter à Budget » dans l’app pour réessayer`;
        }
      }
      return { text: `${payment.label} de ${euros(payment.amount_cents)} € reçu le ${received} (${args.method}) — ${budget}.` };
    },
  },
];
