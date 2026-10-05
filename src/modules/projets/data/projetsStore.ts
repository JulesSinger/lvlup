import type {
  Client,
  ClientInput,
  ClientPatch,
  Project,
  ProjectInput,
  ProjectNote,
  ProjectNoteInput,
  ProjectPatch,
  ProjectTask,
  ProjectTaskDraft,
  ProjectTaskInput,
  ProjectTaskPatch,
  Workstream,
  WorkstreamDraft,
  WorkstreamInput,
  WorkstreamPatch,
} from '../lib/types';

/**
 * La part du module dans une sauvegarde. Le socle n'en connaît pas la forme
 * (voir `core/data/backup.ts`).
 */
export interface ProjetsBackup {
  clients: Client[];
  projects: Project[];
  workstreams: Workstream[];
  tasks: ProjectTask[];
  notes: ProjectNote[];
}

/**
 * Contrat de stockage du module Projets (docs/etude-projets.md §7).
 *
 * Les identifiants sont choisis par l'application (`id` facultatif) : une
 * création rejouée n'écrit rien de plus et rend la première — la file hors
 * ligne pourra s'y brancher plus tard sans migration (§5).
 *
 * Les listes rendent tout le compte : quelques projets actifs, quelques
 * centaines de tâches au plus, et le tableau de bord les veut toutes.
 */
export interface ProjetsStore {
  listClients(): Promise<Client[]>;
  createClient(input: ClientInput, id?: string): Promise<Client>;
  updateClient(id: string, patch: ClientPatch): Promise<void>;
  /** Refusé tant que le client a des projets : on l'archive plutôt. */
  deleteClient(id: string): Promise<void>;

  listProjects(): Promise<Project[]>;
  /** Attribue le numéro du projet (le suivant du compte). */
  createProject(input: ProjectInput, id?: string): Promise<Project>;
  updateProject(id: string, patch: ProjectPatch): Promise<void>;
  /** Emporte ses chantiers, ses tâches et son journal. */
  deleteProject(id: string): Promise<void>;

  listWorkstreams(): Promise<Workstream[]>;
  createWorkstream(input: WorkstreamInput, id?: string): Promise<Workstream>;
  updateWorkstream(id: string, patch: WorkstreamPatch): Promise<void>;
  /** Emporte ses tâches. */
  deleteWorkstream(id: string): Promise<void>;

  listTasks(): Promise<ProjectTask[]>;
  createTask(input: ProjectTaskInput, id?: string): Promise<ProjectTask>;
  updateTask(id: string, patch: ProjectTaskPatch): Promise<void>;
  deleteTask(id: string): Promise<void>;

  /**
   * Copie d'un modèle : les chantiers, puis leurs tâches, chacun en un seul
   * envoi plutôt qu'une quarantaine. Rejouable (ids fixés) : une coupure au
   * milieu laisse au pire un projet aux tâches incomplètes, qu'un second
   * appel complète sans doublon.
   */
  addWorkstreams(workstreams: WorkstreamDraft[], tasks: ProjectTaskDraft[]): Promise<void>;

  listNotes(): Promise<ProjectNote[]>;
  createNote(input: ProjectNoteInput, id?: string): Promise<ProjectNote>;
  updateNote(id: string, text: string): Promise<void>;
  deleteNote(id: string): Promise<void>;

  /** Sa section de la sauvegarde — le socle ne fait que l'assembler. */
  exportData(): Promise<ProjetsBackup>;
  importData(data: ProjetsBackup): Promise<void>;
}
