import type { SupabaseClient } from '@supabase/supabase-js';
import { getClient, requireUserId, unwrap } from '../../../core/data/supabaseClient';
import type {
  Client,
  ClientInput,
  ClientPatch,
  ClientTrade,
  Project,
  ProjectInput,
  ProjectNeeds,
  ProjectNote,
  ProjectNoteInput,
  ProjectPatch,
  ProjectStatus,
  ProjectTask,
  ProjectTaskDraft,
  ProjectTaskInput,
  ProjectTaskPatch,
  Workstream,
  WorkstreamDraft,
  WorkstreamInput,
  WorkstreamPatch,
} from '../lib/types';
import type { ProjetsBackup, ProjetsStore } from './projetsStore';

interface ClientRow {
  id: string;
  name: string;
  trade: ClientTrade;
  contact_name: string;
  phone: string;
  email: string;
  address: string;
  note: string;
  archived: boolean;
  created_at: string;
}

interface ProjectRow {
  id: string;
  client_id: string;
  number: number;
  title: string;
  template: string;
  status: ProjectStatus;
  waiting_for: string | null;
  waiting_since: string | null;
  start_day: string | null;
  due_day: string | null;
  price_cents: number | null;
  needs: ProjectNeeds | null;
  note: string;
  created_at: string;
  updated_at: string;
}

interface WorkstreamRow {
  id: string;
  project_id: string;
  title: string;
  position: number;
  due_day: string | null;
}

interface TaskRow {
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
  created_at: string;
}

interface NoteRow {
  id: string;
  project_id: string;
  day: string;
  text: string;
  created_at: string;
}

const toClient = (r: ClientRow): Client => ({
  id: r.id,
  name: r.name,
  trade: r.trade,
  contactName: r.contact_name,
  phone: r.phone,
  email: r.email,
  address: r.address,
  note: r.note,
  archived: r.archived,
  createdAt: r.created_at,
});

const toProject = (r: ProjectRow): Project => ({
  id: r.id,
  clientId: r.client_id,
  number: r.number,
  title: r.title,
  template: r.template,
  status: r.status,
  waitingFor: r.waiting_for,
  waitingSince: r.waiting_since,
  startDay: r.start_day,
  dueDay: r.due_day,
  priceCents: r.price_cents,
  needs: r.needs ?? {},
  note: r.note,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toWorkstream = (r: WorkstreamRow): Workstream => ({
  id: r.id,
  projectId: r.project_id,
  title: r.title,
  position: r.position,
  dueDay: r.due_day,
});

const toTask = (r: TaskRow): ProjectTask => ({
  id: r.id,
  projectId: r.project_id,
  workstreamId: r.workstream_id,
  title: r.title,
  note: r.note,
  plannedDay: r.planned_day,
  dueDay: r.due_day,
  waitingClient: r.waiting_client,
  position: r.position,
  completedAt: r.completed_at,
  createdAt: r.created_at,
});

const toNote = (r: NoteRow): ProjectNote => ({ id: r.id, projectId: r.project_id, day: r.day, text: r.text, createdAt: r.created_at });

/** Colonnes d'un client, pour les seuls champs présents. */
function clientColumns(p: ClientPatch): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (p.name !== undefined) row.name = p.name;
  if (p.trade !== undefined) row.trade = p.trade;
  if (p.contactName !== undefined) row.contact_name = p.contactName;
  if (p.phone !== undefined) row.phone = p.phone;
  if (p.email !== undefined) row.email = p.email;
  if (p.address !== undefined) row.address = p.address;
  if (p.note !== undefined) row.note = p.note;
  if (p.archived !== undefined) row.archived = p.archived;
  return row;
}

function projectColumns(p: ProjectPatch): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (p.clientId !== undefined) row.client_id = p.clientId;
  if (p.title !== undefined) row.title = p.title;
  if (p.template !== undefined) row.template = p.template;
  if (p.status !== undefined) row.status = p.status;
  if (p.waitingFor !== undefined) row.waiting_for = p.waitingFor;
  if (p.waitingSince !== undefined) row.waiting_since = p.waitingSince;
  if (p.startDay !== undefined) row.start_day = p.startDay;
  if (p.dueDay !== undefined) row.due_day = p.dueDay;
  if (p.priceCents !== undefined) row.price_cents = p.priceCents;
  if (p.needs !== undefined) row.needs = p.needs;
  if (p.note !== undefined) row.note = p.note;
  // Plus rien n'est attendu : plus de date d'attente — sinon la base refuse.
  if (p.waitingFor === null) row.waiting_since = null;
  return row;
}

function workstreamColumns(p: WorkstreamPatch & Partial<WorkstreamInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (p.projectId !== undefined) row.project_id = p.projectId;
  if (p.title !== undefined) row.title = p.title;
  if (p.position !== undefined) row.position = p.position;
  if (p.dueDay !== undefined) row.due_day = p.dueDay;
  return row;
}

function taskColumns(p: ProjectTaskPatch & Partial<ProjectTaskInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (p.projectId !== undefined) row.project_id = p.projectId;
  if (p.workstreamId !== undefined) row.workstream_id = p.workstreamId;
  if (p.title !== undefined) row.title = p.title;
  if (p.note !== undefined) row.note = p.note;
  if (p.plannedDay !== undefined) row.planned_day = p.plannedDay;
  if (p.dueDay !== undefined) row.due_day = p.dueDay;
  if (p.waitingClient !== undefined) row.waiting_client = p.waitingClient;
  if (p.position !== undefined) row.position = p.position;
  if (p.completedAt !== undefined) row.completed_at = p.completedAt;
  return row;
}

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** Projets stockés sur Supabase, protégés par le Row Level Security. */
export class SupabaseProjets implements ProjetsStore {
  private client: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.client = getClient(url, anonKey);
  }

  private requireUserId(): Promise<string> {
    return requireUserId(this.client);
  }

  /**
   * Création rejouable, même motif que les tâches et les hauts faits :
   * `on conflict do nothing` sur l'id, puis relecture de la ligne.
   */
  private async upsertThenRead<R>(table: string, id: string, row: Record<string, unknown>): Promise<R> {
    const { error } = await this.client.from(table).upsert({ id, ...row }, { onConflict: 'id', ignoreDuplicates: true });
    check(error);
    return unwrap(await this.client.from(table).select('*').eq('id', id).single()) as R;
  }

  private async insert<R>(table: string, row: Record<string, unknown>, id?: string): Promise<R> {
    if (id) return this.upsertThenRead<R>(table, id, row);
    return unwrap(await this.client.from(table).insert(row).select().single()) as R;
  }

  async listClients(): Promise<Client[]> {
    return (unwrap(await this.client.from('projets_clients').select('*').order('name')) as ClientRow[]).map(toClient);
  }

  async createClient(input: ClientInput, id?: string): Promise<Client> {
    const userId = await this.requireUserId();
    return toClient(await this.insert<ClientRow>('projets_clients', { user_id: userId, ...clientColumns(input) }, id));
  }

  async updateClient(id: string, patch: ClientPatch) {
    check((await this.client.from('projets_clients').update(clientColumns(patch)).eq('id', id)).error);
  }

  async deleteClient(id: string) {
    // La base refuse (`on delete restrict`) ; on le dit avant, en clair.
    const { count, error } = await this.client.from('projets_projects').select('id', { count: 'exact', head: true }).eq('client_id', id);
    check(error);
    if ((count ?? 0) > 0) throw new Error('Ce client a encore des projets : archive-le plutôt.');
    check((await this.client.from('projets_clients').delete().eq('id', id)).error);
  }

  async listProjects(): Promise<Project[]> {
    return (unwrap(await this.client.from('projets_projects').select('*').order('number')) as ProjectRow[]).map(toProject);
  }

  async createProject(input: ProjectInput, id?: string): Promise<Project> {
    const userId = await this.requireUserId();
    if (id) {
      const { data, error } = await this.client.from('projets_projects').select('*').eq('id', id).maybeSingle();
      check(error);
      if (data) return toProject(data as ProjectRow); // rejoué : le numéro reste celui de la première fois
    }
    // Le suivant du compte. Deux créations simultanées prendraient le même :
    // la contrainte d'unicité refuse alors la seconde, rien n'est écrasé.
    const { data: last, error } = await this.client.from('projets_projects').select('number').order('number', { ascending: false }).limit(1);
    check(error);
    const number = ((last as { number: number }[] | null)?.[0]?.number ?? 0) + 1;
    const row = {
      user_id: userId,
      number,
      status: input.status ?? 'lead',
      ...projectColumns(input),
    };
    return toProject(await this.insert<ProjectRow>('projets_projects', row, id));
  }

  async updateProject(id: string, patch: ProjectPatch) {
    check(
      (await this.client.from('projets_projects').update({ ...projectColumns(patch), updated_at: new Date().toISOString() }).eq('id', id)).error,
    );
  }

  async deleteProject(id: string) {
    check((await this.client.from('projets_projects').delete().eq('id', id)).error);
  }

  async listWorkstreams(): Promise<Workstream[]> {
    return (unwrap(await this.client.from('projets_workstreams').select('*').order('position')) as WorkstreamRow[]).map(toWorkstream);
  }

  async createWorkstream(input: WorkstreamInput, id?: string): Promise<Workstream> {
    const userId = await this.requireUserId();
    return toWorkstream(await this.insert<WorkstreamRow>('projets_workstreams', { user_id: userId, ...workstreamColumns(input) }, id));
  }

  async updateWorkstream(id: string, patch: WorkstreamPatch) {
    check((await this.client.from('projets_workstreams').update(workstreamColumns(patch)).eq('id', id)).error);
  }

  async deleteWorkstream(id: string) {
    check((await this.client.from('projets_workstreams').delete().eq('id', id)).error);
  }

  async listTasks(): Promise<ProjectTask[]> {
    return (unwrap(await this.client.from('projets_tasks').select('*').order('position')) as TaskRow[]).map(toTask);
  }

  async createTask(input: ProjectTaskInput, id?: string): Promise<ProjectTask> {
    const userId = await this.requireUserId();
    return toTask(await this.insert<TaskRow>('projets_tasks', { user_id: userId, ...taskColumns(input) }, id));
  }

  async updateTask(id: string, patch: ProjectTaskPatch) {
    check((await this.client.from('projets_tasks').update(taskColumns(patch)).eq('id', id)).error);
  }

  async deleteTask(id: string) {
    check((await this.client.from('projets_tasks').delete().eq('id', id)).error);
  }

  async addWorkstreams(workstreams: WorkstreamDraft[], tasks: ProjectTaskDraft[]) {
    const userId = await this.requireUserId();
    // Les chantiers d'abord : la clé étrangère des tâches les exige.
    if (workstreams.length > 0) {
      const rows = workstreams.map((w) => ({ id: w.id, user_id: userId, ...workstreamColumns(w) }));
      check((await this.client.from('projets_workstreams').upsert(rows, { onConflict: 'id', ignoreDuplicates: true })).error);
    }
    if (tasks.length > 0) {
      const rows = tasks.map((t) => ({ id: t.id, user_id: userId, ...taskColumns(t) }));
      check((await this.client.from('projets_tasks').upsert(rows, { onConflict: 'id', ignoreDuplicates: true })).error);
    }
  }

  async listNotes(): Promise<ProjectNote[]> {
    return (unwrap(await this.client.from('projets_notes').select('*').order('day')) as NoteRow[]).map(toNote);
  }

  async createNote(input: ProjectNoteInput, id?: string): Promise<ProjectNote> {
    const userId = await this.requireUserId();
    const row = { user_id: userId, project_id: input.projectId, day: input.day, text: input.text };
    return toNote(await this.insert<NoteRow>('projets_notes', row, id));
  }

  async updateNote(id: string, text: string) {
    check((await this.client.from('projets_notes').update({ text }).eq('id', id)).error);
  }

  async deleteNote(id: string) {
    check((await this.client.from('projets_notes').delete().eq('id', id)).error);
  }

  async exportData(): Promise<ProjetsBackup> {
    const [clients, projects, workstreams, tasks, notes] = await Promise.all([
      this.listClients(),
      this.listProjects(),
      this.listWorkstreams(),
      this.listTasks(),
      this.listNotes(),
    ]);
    return { clients, projects, workstreams, tasks, notes };
  }

  /**
   * Remplace tout, comme une restauration de sauvegarde. Les identifiants
   * et les numéros sont gardés. Les projets partent avant les clients
   * (`restrict`), emportant chantiers, tâches et journal ; on réécrit
   * ensuite dans l'ordre des clés étrangères.
   */
  async importData(data: ProjetsBackup) {
    const userId = await this.requireUserId();
    check((await this.client.from('projets_projects').delete().eq('user_id', userId)).error);
    check((await this.client.from('projets_clients').delete().eq('user_id', userId)).error);

    const clients = data.clients ?? [];
    if (clients.length > 0) {
      const rows = clients.map((c) => ({ id: c.id, user_id: userId, created_at: c.createdAt, ...clientColumns(c) }));
      check((await this.client.from('projets_clients').insert(rows)).error);
    }
    const projects = data.projects ?? [];
    if (projects.length > 0) {
      const rows = projects.map((p) => ({
        id: p.id,
        user_id: userId,
        number: p.number,
        created_at: p.createdAt,
        updated_at: p.updatedAt,
        ...projectColumns(p),
        waiting_since: p.waitingFor === null ? null : p.waitingSince,
      }));
      check((await this.client.from('projets_projects').insert(rows)).error);
    }
    await this.addWorkstreams(data.workstreams ?? [], []);
    const tasks = data.tasks ?? [];
    if (tasks.length > 0) {
      const rows = tasks.map((t) => ({ id: t.id, user_id: userId, created_at: t.createdAt, ...taskColumns(t) }));
      check((await this.client.from('projets_tasks').insert(rows)).error);
    }
    const notes = data.notes ?? [];
    if (notes.length > 0) {
      const rows = notes.map((n) => ({ id: n.id, user_id: userId, project_id: n.projectId, day: n.day, text: n.text, created_at: n.createdAt }));
      check((await this.client.from('projets_notes').insert(rows)).error);
    }
  }
}
