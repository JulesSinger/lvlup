import { newId } from '../../../core/data/coreStore';
import { readRaw, writeRaw } from '../../../core/data/localSnapshot';
import type {
  Client,
  ClientInput,
  ClientPatch,
  Payment,
  PaymentInput,
  PaymentPatch,
  Project,
  ProjectInput,
  ProjectLink,
  ProjectLinkInput,
  ProjectLinkPatch,
  ProjectNote,
  ProjectNoteInput,
  ProjectPatch,
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
import type { ProjetsBackup, ProjetsStore } from './projetsStore';

const arrayOf = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

type Snapshot = Required<ProjetsBackup>;

/** Lecture des seules sections du module, sur le blob local partagé. */
function read(): Snapshot {
  const raw = readRaw();
  return {
    clients: arrayOf<Client>(raw.projetsClients),
    // Un projet écrit avant l'étape 4 n'a pas de fiche design.
    projects: arrayOf<Project>(raw.projetsProjects).map((p) => ({ ...p, needs: p.needs ?? {}, design: p.design ?? {} })),
    workstreams: arrayOf<Workstream>(raw.projetsWorkstreams),
    tasks: arrayOf<ProjectTask>(raw.projetsTasks),
    notes: arrayOf<ProjectNote>(raw.projetsNotes),
    links: arrayOf<ProjectLink>(raw.projetsLinks),
    payments: arrayOf<Payment>(raw.projetsPayments),
    time: arrayOf<TimeEntry>(raw.projetsTime),
  };
}

/** Écriture par fusion : les sections des autres modules sont préservées. */
function write(s: Snapshot) {
  writeRaw({
    ...readRaw(),
    projetsClients: s.clients,
    projetsProjects: s.projects,
    projetsWorkstreams: s.workstreams,
    projetsTasks: s.tasks,
    projetsNotes: s.notes,
    projetsLinks: s.links,
    projetsPayments: s.payments,
    projetsTime: s.time,
  });
}

/** Les mêmes refus que les clés étrangères de la base, pour que le mode local ne permette pas plus. */
function requireProject(s: Snapshot, projectId: string) {
  if (!s.projects.some((p) => p.id === projectId)) throw new Error('Projet introuvable.');
}

function requireWorkstream(s: Snapshot, workstreamId: string, projectId: string) {
  const ws = s.workstreams.find((w) => w.id === workstreamId);
  if (!ws || ws.projectId !== projectId) throw new Error('Ce chantier n’appartient pas à ce projet.');
}

function newWorkstream(input: WorkstreamInput, id: string): Workstream {
  return { id, projectId: input.projectId, title: input.title, position: input.position ?? 0, dueDay: input.dueDay ?? null };
}

function newTask(input: ProjectTaskInput, id: string): ProjectTask {
  return {
    id,
    projectId: input.projectId,
    workstreamId: input.workstreamId,
    title: input.title,
    note: input.note ?? '',
    plannedDay: input.plannedDay ?? null,
    dueDay: input.dueDay ?? null,
    waitingClient: input.waitingClient ?? false,
    position: input.position ?? 0,
    completedAt: null,
    createdAt: new Date().toISOString(),
  };
}

/** Projets stockés dans le navigateur, sans compte ni serveur. */
export class LocalProjets implements ProjetsStore {
  async listClients(): Promise<Client[]> {
    return read().clients.slice();
  }

  async createClient(input: ClientInput, id: string = newId()): Promise<Client> {
    const s = read();
    const existing = s.clients.find((c) => c.id === id);
    if (existing) return existing; // rejoué : rien de plus
    const client: Client = {
      id,
      name: input.name,
      trade: input.trade,
      contactName: input.contactName ?? '',
      phone: input.phone ?? '',
      email: input.email ?? '',
      address: input.address ?? '',
      note: input.note ?? '',
      archived: false,
      createdAt: new Date().toISOString(),
    };
    s.clients.push(client);
    write(s);
    return client;
  }

  async updateClient(id: string, patch: ClientPatch) {
    const s = read();
    s.clients = s.clients.map((c) => (c.id === id ? { ...c, ...patch } : c));
    write(s);
  }

  async deleteClient(id: string) {
    const s = read();
    if (s.projects.some((p) => p.clientId === id)) {
      throw new Error('Ce client a encore des projets : archive-le plutôt.');
    }
    s.clients = s.clients.filter((c) => c.id !== id);
    write(s);
  }

  async listProjects(): Promise<Project[]> {
    return read().projects.slice();
  }

  async createProject(input: ProjectInput, id: string = newId()): Promise<Project> {
    const s = read();
    const existing = s.projects.find((p) => p.id === id);
    if (existing) return existing;
    if (!s.clients.some((c) => c.id === input.clientId)) throw new Error('Client introuvable.');
    const now = new Date().toISOString();
    const project: Project = {
      id,
      clientId: input.clientId,
      number: s.projects.reduce((max, p) => Math.max(max, p.number), 0) + 1,
      title: input.title,
      template: input.template ?? '',
      status: input.status ?? 'lead',
      waitingFor: null,
      waitingSince: null,
      startDay: input.startDay ?? null,
      dueDay: input.dueDay ?? null,
      priceCents: input.priceCents ?? null,
      needs: {},
      design: {},
      note: input.note ?? '',
      createdAt: now,
      updatedAt: now,
    };
    s.projects.push(project);
    write(s);
    return project;
  }

  async updateProject(id: string, patch: ProjectPatch) {
    const s = read();
    if (patch.clientId !== undefined && !s.clients.some((c) => c.id === patch.clientId)) throw new Error('Client introuvable.');
    // Plus rien n'est attendu : plus de date d'attente — comme la contrainte côté base.
    const waiting = patch.waitingFor === null ? { waitingSince: null } : {};
    s.projects = s.projects.map((p) => (p.id === id ? { ...p, ...patch, ...waiting, updatedAt: new Date().toISOString() } : p));
    write(s);
  }

  async deleteProject(id: string) {
    const s = read();
    s.projects = s.projects.filter((p) => p.id !== id);
    s.workstreams = s.workstreams.filter((w) => w.projectId !== id);
    s.tasks = s.tasks.filter((t) => t.projectId !== id);
    s.notes = s.notes.filter((n) => n.projectId !== id);
    s.links = s.links.filter((l) => l.projectId !== id);
    s.payments = s.payments.filter((p) => p.projectId !== id);
    s.time = s.time.filter((t) => t.projectId !== id);
    write(s);
  }

  async listWorkstreams(): Promise<Workstream[]> {
    return read().workstreams.slice();
  }

  async createWorkstream(input: WorkstreamInput, id: string = newId()): Promise<Workstream> {
    const s = read();
    const existing = s.workstreams.find((w) => w.id === id);
    if (existing) return existing;
    requireProject(s, input.projectId);
    const ws = newWorkstream(input, id);
    s.workstreams.push(ws);
    write(s);
    return ws;
  }

  async updateWorkstream(id: string, patch: WorkstreamPatch) {
    const s = read();
    s.workstreams = s.workstreams.map((w) => (w.id === id ? { ...w, ...patch } : w));
    write(s);
  }

  async deleteWorkstream(id: string) {
    const s = read();
    s.workstreams = s.workstreams.filter((w) => w.id !== id);
    s.tasks = s.tasks.filter((t) => t.workstreamId !== id);
    // Le temps passé reste, sans chantier (`on delete set null`).
    s.time = s.time.map((t) => (t.workstreamId === id ? { ...t, workstreamId: null } : t));
    write(s);
  }

  async listTasks(): Promise<ProjectTask[]> {
    return read().tasks.slice();
  }

  async createTask(input: ProjectTaskInput, id: string = newId()): Promise<ProjectTask> {
    const s = read();
    const existing = s.tasks.find((t) => t.id === id);
    if (existing) return existing;
    requireWorkstream(s, input.workstreamId, input.projectId);
    const task = newTask(input, id);
    s.tasks.push(task);
    write(s);
    return task;
  }

  async updateTask(id: string, patch: ProjectTaskPatch) {
    const s = read();
    const task = s.tasks.find((t) => t.id === id);
    if (!task) return;
    if (patch.workstreamId !== undefined) requireWorkstream(s, patch.workstreamId, task.projectId);
    s.tasks = s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
    write(s);
  }

  async deleteTask(id: string) {
    const s = read();
    s.tasks = s.tasks.filter((t) => t.id !== id);
    write(s);
  }

  async addWorkstreams(workstreams: WorkstreamDraft[], tasks: ProjectTaskDraft[]) {
    const s = read();
    for (const draft of workstreams) {
      if (s.workstreams.some((w) => w.id === draft.id)) continue;
      requireProject(s, draft.projectId);
      s.workstreams.push(newWorkstream(draft, draft.id));
    }
    for (const draft of tasks) {
      if (s.tasks.some((t) => t.id === draft.id)) continue;
      requireWorkstream(s, draft.workstreamId, draft.projectId);
      s.tasks.push(newTask(draft, draft.id));
    }
    write(s);
  }

  async listNotes(): Promise<ProjectNote[]> {
    return read().notes.slice();
  }

  async createNote(input: ProjectNoteInput, id: string = newId()): Promise<ProjectNote> {
    const s = read();
    const existing = s.notes.find((n) => n.id === id);
    if (existing) return existing;
    requireProject(s, input.projectId);
    const note: ProjectNote = { id, projectId: input.projectId, day: input.day, text: input.text, createdAt: new Date().toISOString() };
    s.notes.push(note);
    write(s);
    return note;
  }

  async updateNote(id: string, text: string) {
    const s = read();
    s.notes = s.notes.map((n) => (n.id === id ? { ...n, text } : n));
    write(s);
  }

  async deleteNote(id: string) {
    const s = read();
    s.notes = s.notes.filter((n) => n.id !== id);
    write(s);
  }

  async listLinks(): Promise<ProjectLink[]> {
    return read().links.slice();
  }

  async createLink(input: ProjectLinkInput, id: string = newId()): Promise<ProjectLink> {
    const s = read();
    const existing = s.links.find((l) => l.id === id);
    if (existing) return existing;
    requireProject(s, input.projectId);
    const link: ProjectLink = {
      id,
      projectId: input.projectId,
      kind: input.kind,
      label: input.label,
      url: input.url ?? '',
      login: input.login ?? '',
      note: input.note ?? '',
      position: input.position ?? 0,
    };
    s.links.push(link);
    write(s);
    return link;
  }

  async updateLink(id: string, patch: ProjectLinkPatch) {
    const s = read();
    s.links = s.links.map((l) => (l.id === id ? { ...l, ...patch } : l));
    write(s);
  }

  async deleteLink(id: string) {
    const s = read();
    s.links = s.links.filter((l) => l.id !== id);
    write(s);
  }

  async listPayments(): Promise<Payment[]> {
    return read().payments.slice();
  }

  async createPayment(input: PaymentInput, id: string = newId()): Promise<Payment> {
    const s = read();
    const existing = s.payments.find((p) => p.id === id);
    if (existing) return existing;
    requireProject(s, input.projectId);
    const payment: Payment = {
      id,
      projectId: input.projectId,
      number: s.payments.reduce((max, p) => Math.max(max, p.number), 0) + 1,
      label: input.label,
      amountCents: input.amountCents,
      expectedDay: input.expectedDay ?? null,
      receivedDay: null,
      method: null,
      invoiceRef: '',
      position: input.position ?? 0,
      createdAt: new Date().toISOString(),
    };
    s.payments.push(payment);
    write(s);
    return payment;
  }

  async updatePayment(id: string, patch: PaymentPatch) {
    const s = read();
    // Plus de réception : plus de mode de règlement — comme la contrainte côté base.
    const unreceived = patch.receivedDay === null ? { method: null } : {};
    s.payments = s.payments.map((p) => (p.id === id ? { ...p, ...patch, ...unreceived } : p));
    write(s);
  }

  async deletePayment(id: string) {
    const s = read();
    s.payments = s.payments.filter((p) => p.id !== id);
    write(s);
  }

  async listTime(): Promise<TimeEntry[]> {
    return read().time.slice();
  }

  async createTime(input: TimeEntryInput, id: string = newId()): Promise<TimeEntry> {
    const s = read();
    const existing = s.time.find((t) => t.id === id);
    if (existing) return existing;
    requireProject(s, input.projectId);
    const entry: TimeEntry = {
      id,
      projectId: input.projectId,
      workstreamId: input.workstreamId ?? null,
      day: input.day,
      minutes: input.minutes,
      note: input.note ?? '',
      createdAt: new Date().toISOString(),
    };
    s.time.push(entry);
    write(s);
    return entry;
  }

  async deleteTime(id: string) {
    const s = read();
    s.time = s.time.filter((t) => t.id !== id);
    write(s);
  }

  async exportData(): Promise<ProjetsBackup> {
    return read();
  }

  async importData(data: ProjetsBackup) {
    write({
      clients: data.clients ?? [],
      projects: data.projects ?? [],
      workstreams: data.workstreams ?? [],
      tasks: data.tasks ?? [],
      notes: data.notes ?? [],
      links: data.links ?? [],
      payments: data.payments ?? [],
      time: data.time ?? [],
    });
  }
}
