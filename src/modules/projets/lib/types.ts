/**
 * Les types du module Projets (docs/etude-projets.md §3, §7, §12).
 *
 * Deux axes, décidés avec Jules le 05/10/2026 : le STATUT d'un projet ne dit
 * que la relation avec le client (piste, devis, signé…), et le travail avance
 * en CHANTIERS menés en parallèle — développement, contenus, hébergement… —
 * dont l'état n'est jamais stocké : il se calcule depuis leurs tâches.
 *
 * Les listes `as const` ont leur pendant dans les contraintes CHECK de la
 * migration ; `schema.test.ts` compare les deux (CLAUDE.md §5).
 */

/** Où en est la relation avec le client — une étape à la fois. */
export const PROJECT_STATUSES = ['lead', 'quoted', 'signed', 'production', 'delivered', 'maintenance', 'done', 'lost'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** Le métier d'un client : une liste fixe, « autre » pour le reste. */
export const CLIENT_TRADES = ['foodtruck', 'restaurant', 'coiffure', 'fleuriste', 'boulangerie', 'artisan', 'commerce', 'autre'] as const;
export type ClientTrade = (typeof CLIENT_TRADES)[number];

export const CLIENT_NAME_MAX = 120;
export const PROJECT_TITLE_MAX = 120;
export const WORKSTREAM_TITLE_MAX = 80;
export const TASK_TITLE_MAX = 500;
export const NOTE_TEXT_MAX = 4000;

/** Un commerce. Un client peut avoir plusieurs projets (le site, puis une refonte). */
export interface Client {
  id: string;
  name: string;
  trade: ClientTrade;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  note: string;
  /** Un client ne se supprime pas tant qu'il a des projets : on l'archive. */
  archived: boolean;
  createdAt: string;
}

export interface ClientInput {
  name: string;
  trade: ClientTrade;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  note?: string;
}

export type ClientPatch = Partial<ClientInput & { archived: boolean }>;

/** Les réponses du questionnaire de besoins, une clé stable par question (§3.4). */
export type ProjectNeeds = Record<string, string>;

export interface Project {
  id: string;
  clientId: string;
  /**
   * Numéro du projet, unique par compte et attribué à la création. C'est lui
   * qui fera les références stables vers Budget (« projets:paiement:… ») :
   * un identifiant change à la restauration d'une sauvegarde, pas lui.
   */
  number: number;
  title: string;
  /** Le modèle dont le projet est parti (« vitrine »…), pour mémoire. */
  template: string;
  status: ProjectStatus;
  /** Ce qu'on attend du client, `null` s'il ne bloque rien (§3.2). */
  waitingFor: string | null;
  waitingSince: string | null;
  startDay: string | null;
  /** L'échéance promise : la mise en ligne. */
  dueDay: string | null;
  /** Le prix convenu, en centimes entiers ; `null` tant qu'il n'est pas fixé. */
  priceCents: number | null;
  needs: ProjectNeeds;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectInput {
  clientId: string;
  title: string;
  template?: string;
  status?: ProjectStatus;
  startDay?: string | null;
  dueDay?: string | null;
  priceCents?: number | null;
  note?: string;
}

export type ProjectPatch = Partial<
  Omit<ProjectInput, 'clientId'> & {
    clientId: string;
    waitingFor: string | null;
    waitingSince: string | null;
    needs: ProjectNeeds;
  }
>;

/**
 * Un chantier : « Développement », « Contenus », « Hébergement & domaine ».
 * Menés en parallèle ; `position` ne sert qu'à l'ordre d'affichage.
 */
export interface Workstream {
  id: string;
  projectId: string;
  title: string;
  position: number;
  dueDay: string | null;
}

export interface WorkstreamInput {
  projectId: string;
  title: string;
  position?: number;
  dueDay?: string | null;
}

export type WorkstreamPatch = Partial<Pick<Workstream, 'title' | 'position' | 'dueDay'>>;

export interface ProjectTask {
  id: string;
  projectId: string;
  workstreamId: string;
  title: string;
  note: string;
  plannedDay: string | null;
  dueDay: string | null;
  /** La tâche attend quelque chose du client (ses photos, sa validation). */
  waitingClient: boolean;
  position: number;
  completedAt: string | null;
  createdAt: string;
}

export interface ProjectTaskInput {
  projectId: string;
  workstreamId: string;
  title: string;
  note?: string;
  plannedDay?: string | null;
  dueDay?: string | null;
  waitingClient?: boolean;
  position?: number;
}

export type ProjectTaskPatch = Partial<
  Pick<ProjectTask, 'workstreamId' | 'title' | 'note' | 'plannedDay' | 'dueDay' | 'waitingClient' | 'position' | 'completedAt'>
>;

/** Une note datée du journal du projet (§3.9). */
export interface ProjectNote {
  id: string;
  projectId: string;
  day: string;
  text: string;
  createdAt: string;
}

export interface ProjectNoteInput {
  projectId: string;
  day: string;
  text: string;
}

/** Un chantier ou une tâche à créer d'un bloc, identifiant compris (copie d'un modèle). */
export type WorkstreamDraft = WorkstreamInput & { id: string };
export type ProjectTaskDraft = ProjectTaskInput & { id: string };
