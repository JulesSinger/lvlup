import type { ImageSize, PreparedImage } from '../../../core/lib/images';
import type {
  Client,
  ClientInput,
  ClientPatch,
  Payment,
  PaymentInput,
  PaymentPatch,
  Project,
  ProjectImage,
  ProjectImageKind,
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
  /** Depuis l'étape 4 ; absent d'une sauvegarde plus ancienne. */
  links?: ProjectLink[];
  /** Depuis l'étape 5. */
  payments?: Payment[];
  time?: TimeEntry[];
  /**
   * Depuis l'étape 7 : la liste des images, PAS leur contenu (comme Hauts
   * faits) — restaurée sur le même compte ou le même appareil, chaque ligne
   * retrouve son fichier, resté dans le stockage.
   */
  images?: ProjectImage[];
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
  /** Emporte ses chantiers, ses tâches, son journal… et ses images, fichiers compris. */
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

  /** Les liens et les accès d'un projet — jamais de mot de passe (§3.7). */
  listLinks(): Promise<ProjectLink[]>;
  createLink(input: ProjectLinkInput, id?: string): Promise<ProjectLink>;
  updateLink(id: string, patch: ProjectLinkPatch): Promise<void>;
  deleteLink(id: string): Promise<void>;

  /** Les paiements attendus et reçus (§3.8). */
  listPayments(): Promise<Payment[]>;
  /** Attribue le numéro du paiement (le suivant du compte). */
  createPayment(input: PaymentInput, id?: string): Promise<Payment>;
  /** Retirer la date de réception retire aussi le mode de règlement. */
  updatePayment(id: string, patch: PaymentPatch): Promise<void>;
  deletePayment(id: string): Promise<void>;

  /** Le temps passé (§3.10). */
  listTime(): Promise<TimeEntry[]>;
  createTime(input: TimeEntryInput, id?: string): Promise<TimeEntry>;
  deleteTime(id: string): Promise<void>;

  /** Les images (§3.6). */
  listImages(): Promise<ProjectImage[]>;
  /**
   * Range les fichiers PUIS écrit la ligne : une coupure entre les deux
   * laisse au pire un fichier sans ligne, jamais une ligne vers une image
   * absente. Rejouable avec le même `id`.
   */
  addImage(projectId: string, kind: ProjectImageKind, image: PreparedImage, position: number, id?: string): Promise<ProjectImage>;
  imageBlob(image: ProjectImage, size: ImageSize): Promise<Blob>;
  setImageKind(id: string, kind: ProjectImageKind): Promise<void>;
  /** Retire la ligne, puis les fichiers. */
  removeImage(image: ProjectImage): Promise<void>;

  /** Sa section de la sauvegarde — le socle ne fait que l'assembler. */
  exportData(): Promise<ProjetsBackup>;
  importData(data: ProjetsBackup): Promise<void>;
}
