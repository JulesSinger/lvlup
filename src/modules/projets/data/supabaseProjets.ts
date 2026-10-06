import type { SupabaseClient } from '@supabase/supabase-js';
import { getClient, requireUserId, unwrap } from '../../../core/data/supabaseClient';
import type { ImageSize, PreparedImage } from '../../../core/lib/images';
import type {
  Client,
  ClientInput,
  ClientPatch,
  ClientTrade,
  Payment,
  PaymentInput,
  PaymentMethod,
  PaymentPatch,
  Project,
  ProjectInput,
  ProjectDesign,
  ProjectImage,
  ProjectImageKind,
  ProjectLink,
  ProjectLinkInput,
  ProjectLinkPatch,
  LinkKind,
  ProjectNeeds,
  ProjectNote,
  ProjectNoteInput,
  ProjectPatch,
  ProjectStatus,
  ProjectTask,
  ProjectTaskDraft,
  ProjectTaskInput,
  ProjectTaskPatch,
  TimeEntry,
  TimeEntryInput,
  Workstream,
  WorkstreamDraft,
  WorkstreamInput,
  WorkstreamPatch,
} from '../lib/types';
import { imageCache } from './deviceImages';
import type { ProjetsBackup, ProjetsStore } from './projetsStore';

/** Le bucket privé des images (migration du 2026-10-06). */
const BUCKET = 'projets';

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
  design: ProjectDesign | null;
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
  design: r.design ?? {},
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

interface LinkRow {
  id: string;
  project_id: string;
  kind: LinkKind;
  label: string;
  url: string;
  login: string;
  note: string;
  position: number;
}

const toLink = (r: LinkRow): ProjectLink => ({
  id: r.id,
  projectId: r.project_id,
  kind: r.kind,
  label: r.label,
  url: r.url,
  login: r.login,
  note: r.note,
  position: r.position,
});

function linkColumns(p: ProjectLinkPatch & Partial<ProjectLinkInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (p.projectId !== undefined) row.project_id = p.projectId;
  if (p.kind !== undefined) row.kind = p.kind;
  if (p.label !== undefined) row.label = p.label;
  if (p.url !== undefined) row.url = p.url;
  if (p.login !== undefined) row.login = p.login;
  if (p.note !== undefined) row.note = p.note;
  if (p.position !== undefined) row.position = p.position;
  return row;
}

interface PaymentRow {
  id: string;
  project_id: string;
  number: number;
  label: string;
  amount_cents: number;
  expected_day: string | null;
  received_day: string | null;
  method: PaymentMethod | null;
  invoice_ref: string;
  position: number;
  created_at: string;
}

const toPayment = (r: PaymentRow): Payment => ({
  id: r.id,
  projectId: r.project_id,
  number: r.number,
  label: r.label,
  amountCents: r.amount_cents,
  expectedDay: r.expected_day,
  receivedDay: r.received_day,
  method: r.method,
  invoiceRef: r.invoice_ref,
  position: r.position,
  createdAt: r.created_at,
});

function paymentColumns(p: PaymentPatch & Partial<PaymentInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (p.projectId !== undefined) row.project_id = p.projectId;
  if (p.label !== undefined) row.label = p.label;
  if (p.amountCents !== undefined) row.amount_cents = p.amountCents;
  if (p.expectedDay !== undefined) row.expected_day = p.expectedDay;
  if (p.receivedDay !== undefined) row.received_day = p.receivedDay;
  if (p.method !== undefined) row.method = p.method;
  if (p.invoiceRef !== undefined) row.invoice_ref = p.invoiceRef;
  if (p.position !== undefined) row.position = p.position;
  // Plus de réception : plus de mode de règlement — sinon la base refuse.
  if (p.receivedDay === null) row.method = null;
  return row;
}

interface TimeRow {
  id: string;
  project_id: string;
  workstream_id: string | null;
  day: string;
  minutes: number;
  note: string;
  created_at: string;
}

const toTime = (r: TimeRow): TimeEntry => ({
  id: r.id,
  projectId: r.project_id,
  workstreamId: r.workstream_id,
  day: r.day,
  minutes: r.minutes,
  note: r.note,
  createdAt: r.created_at,
});

interface ImageRow {
  id: string;
  project_id: string;
  kind: ProjectImageKind;
  path: string;
  thumb_path: string;
  width: number;
  height: number;
  bytes: number;
  position: number;
  created_at: string;
}

const toImage = (r: ImageRow): ProjectImage => ({
  id: r.id,
  projectId: r.project_id,
  kind: r.kind,
  path: r.path,
  thumbPath: r.thumb_path,
  width: r.width,
  height: r.height,
  bytes: r.bytes,
  position: r.position,
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
  if (p.design !== undefined) row.design = p.design;
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
    const images = (unwrap(await this.client.from('projets_images').select('*').eq('project_id', id)) as ImageRow[]).map(toImage);
    // La ligne d'abord (tout le reste part par cascade), les fichiers ensuite.
    check((await this.client.from('projets_projects').delete().eq('id', id)).error);
    await this.removeFiles(images.flatMap((i) => [i.path, i.thumbPath]));
  }

  /**
   * Un fichier qu'on n'arrive pas à supprimer n'est que de la place perdue :
   * la ligne est déjà partie, on ne bloque pas l'utilisateur pour ça.
   */
  private async removeFiles(paths: string[]) {
    if (paths.length === 0) return;
    await imageCache.forgetCached(paths);
    const { error } = await this.client.storage.from(BUCKET).remove(paths);
    if (error) console.warn('Projets : fichiers restés dans le stockage', paths, error.message);
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

  async listLinks(): Promise<ProjectLink[]> {
    return (unwrap(await this.client.from('projets_links').select('*').order('position')) as LinkRow[]).map(toLink);
  }

  async createLink(input: ProjectLinkInput, id?: string): Promise<ProjectLink> {
    const userId = await this.requireUserId();
    return toLink(await this.insert<LinkRow>('projets_links', { user_id: userId, ...linkColumns(input) }, id));
  }

  async updateLink(id: string, patch: ProjectLinkPatch) {
    check((await this.client.from('projets_links').update(linkColumns(patch)).eq('id', id)).error);
  }

  async deleteLink(id: string) {
    check((await this.client.from('projets_links').delete().eq('id', id)).error);
  }

  async listPayments(): Promise<Payment[]> {
    return (unwrap(await this.client.from('projets_payments').select('*').order('position')) as PaymentRow[]).map(toPayment);
  }

  async createPayment(input: PaymentInput, id?: string): Promise<Payment> {
    const userId = await this.requireUserId();
    if (id) {
      const { data, error } = await this.client.from('projets_payments').select('*').eq('id', id).maybeSingle();
      check(error);
      if (data) return toPayment(data as PaymentRow); // rejoué : le numéro reste celui de la première fois
    }
    // Même règle que les projets : le suivant du compte, l'unicité en base refuse un doublon.
    const { data: last, error } = await this.client.from('projets_payments').select('number').order('number', { ascending: false }).limit(1);
    check(error);
    const number = ((last as { number: number }[] | null)?.[0]?.number ?? 0) + 1;
    return toPayment(await this.insert<PaymentRow>('projets_payments', { user_id: userId, number, ...paymentColumns(input) }, id));
  }

  async updatePayment(id: string, patch: PaymentPatch) {
    check((await this.client.from('projets_payments').update(paymentColumns(patch)).eq('id', id)).error);
  }

  async deletePayment(id: string) {
    check((await this.client.from('projets_payments').delete().eq('id', id)).error);
  }

  async listTime(): Promise<TimeEntry[]> {
    return (unwrap(await this.client.from('projets_time').select('*').order('day')) as TimeRow[]).map(toTime);
  }

  async createTime(input: TimeEntryInput, id?: string): Promise<TimeEntry> {
    const userId = await this.requireUserId();
    const row = {
      user_id: userId,
      project_id: input.projectId,
      workstream_id: input.workstreamId ?? null,
      day: input.day,
      minutes: input.minutes,
      note: input.note ?? '',
    };
    return toTime(await this.insert<TimeRow>('projets_time', row, id));
  }

  async deleteTime(id: string) {
    check((await this.client.from('projets_time').delete().eq('id', id)).error);
  }

  async listImages(): Promise<ProjectImage[]> {
    return (unwrap(await this.client.from('projets_images').select('*').order('position')) as ImageRow[]).map(toImage);
  }

  async addImage(projectId: string, kind: ProjectImageKind, image: PreparedImage, position: number, id: string = crypto.randomUUID()): Promise<ProjectImage> {
    const userId = await this.requireUserId();
    // Le premier segment du chemin est le compte : c'est ce que vérifient les politiques du bucket.
    const path = `${userId}/${projectId}/${id}.jpg`;
    const thumbPath = `${userId}/${projectId}/${id}-thumb.jpg`;
    const bucket = this.client.storage.from(BUCKET);
    for (const [target, blob] of [
      [path, image.full],
      [thumbPath, image.thumb],
    ] as const) {
      // `upsert` : un envoi rejoué après une coupure réécrit le même fichier plutôt que d'échouer.
      const { error } = await bucket.upload(target, blob, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' });
      if (error) throw new Error(`L’image n’a pas pu être envoyée : ${error.message}`);
    }
    const { error } = await this.client.from('projets_images').upsert(
      {
        id,
        user_id: userId,
        project_id: projectId,
        kind,
        path,
        thumb_path: thumbPath,
        width: image.width,
        height: image.height,
        bytes: image.full.size + image.thumb.size,
        position,
      },
      { onConflict: 'id', ignoreDuplicates: true },
    );
    check(error);
    return toImage(unwrap(await this.client.from('projets_images').select('*').eq('id', id).single()) as ImageRow);
  }

  async imageBlob(image: ProjectImage, size: ImageSize): Promise<Blob> {
    const path = size === 'full' ? image.path : image.thumbPath;
    return imageCache.cachedBlob(path, async () => {
      const { data, error } = await this.client.storage.from(BUCKET).download(path);
      if (error || !data) throw new Error('Cette image n’a pas pu être chargée.');
      return data;
    });
  }

  async setImageKind(id: string, kind: ProjectImageKind) {
    check((await this.client.from('projets_images').update({ kind }).eq('id', id)).error);
  }

  async removeImage(image: ProjectImage) {
    check((await this.client.from('projets_images').delete().eq('id', image.id)).error);
    await this.removeFiles([image.path, image.thumbPath]);
  }

  async exportData(): Promise<ProjetsBackup> {
    const [clients, projects, workstreams, tasks, notes, links, payments, time] = await Promise.all([
      this.listClients(),
      this.listProjects(),
      this.listWorkstreams(),
      this.listTasks(),
      this.listNotes(),
      this.listLinks(),
      this.listPayments(),
      this.listTime(),
    ]);
    // Les images à part : une table manquante (migration de l'étape 7 pas encore appliquée) ne
    // doit pas empêcher de sauvegarder tout le reste.
    const images = await this.listImages().catch(() => []);
    return { clients, projects, workstreams, tasks, notes, links, payments, time, images };
  }

  /**
   * Remplace tout, comme une restauration de sauvegarde. Les identifiants
   * et les numéros sont gardés. Les projets partent avant les clients
   * (`restrict`), emportant chantiers, tâches, journal, liens, paiements et temps ; on réécrit
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
    const links = data.links ?? [];
    if (links.length > 0) {
      const rows = links.map((l) => ({ id: l.id, user_id: userId, ...linkColumns(l) }));
      check((await this.client.from('projets_links').insert(rows)).error);
    }
    const payments = data.payments ?? [];
    if (payments.length > 0) {
      const rows = payments.map((p) => ({ id: p.id, user_id: userId, number: p.number, created_at: p.createdAt, ...paymentColumns(p) }));
      check((await this.client.from('projets_payments').insert(rows)).error);
    }
    const time = data.time ?? [];
    if (time.length > 0) {
      const rows = time.map((t) => ({
        id: t.id,
        user_id: userId,
        project_id: t.projectId,
        workstream_id: t.workstreamId,
        day: t.day,
        minutes: t.minutes,
        note: t.note,
        created_at: t.createdAt,
      }));
      check((await this.client.from('projets_time').insert(rows)).error);
    }
    // Les lignes seulement : les fichiers, eux, ne sont jamais effacés par une restauration.
    const images = data.images ?? [];
    if (images.length > 0) {
      const rows = images.map((i) => ({
        id: i.id,
        user_id: userId,
        project_id: i.projectId,
        kind: i.kind,
        path: i.path,
        thumb_path: i.thumbPath,
        width: i.width,
        height: i.height,
        bytes: i.bytes,
        position: i.position,
        created_at: i.createdAt,
      }));
      check((await this.client.from('projets_images').insert(rows)).error);
    }
  }
}
