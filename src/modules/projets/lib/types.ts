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

/**
 * Le questionnaire de besoins rempli (§3.4) : les réponses, une clé stable
 * par question (texte, ou liste pour un choix multiple), et les questions
 * marquées « à demander au client ». En JSON : une question retirée du
 * questionnaire garde sa réponse, sans migration.
 */
export interface ProjectNeeds {
  answers?: Record<string, string | string[]>;
  ask?: string[];
}

/** La fiche design (§3.5) : de quoi développer sans rouvrir la maquette. */
export interface ProjectDesign {
  /** Codes hexadécimaux, « #e7b7c3 ». */
  colors?: string[];
  titleFont?: string;
  bodyFont?: string;
  /** L'ambiance en quelques mots. */
  mood?: string;
  /** Sites de référence, un par ligne. */
  references?: string;
}

/** Les sortes de liens d'un projet (§3.6) ; les accès (registraire, hébergeur, back-office) en font partie. */
export const LINK_KINDS = ['maquette', 'dossier', 'preprod', 'site', 'domaine', 'hebergement', 'backoffice', 'compte', 'devis', 'autre'] as const;
export type LinkKind = (typeof LINK_KINDS)[number];

export const LINK_LABEL_MAX = 120;
export const LINK_URL_MAX = 2000;

/**
 * Un lien ou un accès. On garde OÙ (l'adresse) et À QUEL COMPTE
 * (l'identifiant), jamais le mot de passe (§3.7) : Atlas n'est pas chiffré
 * de bout en bout, et la sauvegarde JSON l'emporterait.
 */
export interface ProjectLink {
  id: string;
  projectId: string;
  kind: LinkKind;
  label: string;
  url: string;
  login: string;
  note: string;
  position: number;
}

export interface ProjectLinkInput {
  projectId: string;
  kind: LinkKind;
  label: string;
  url?: string;
  login?: string;
  note?: string;
  position?: number;
}

export type ProjectLinkPatch = Partial<Omit<ProjectLinkInput, 'projectId'>>;

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
  design: ProjectDesign;
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
    design: ProjectDesign;
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

/** Comment un paiement a été reçu — une colonne du livre des recettes (§3.8). */
export const PAYMENT_METHODS = ['virement', 'carte', 'cheque', 'especes', 'autre'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_LABEL_MAX = 80;

/**
 * Un paiement attendu d'un client : l'acompte, le solde, une échéance. Il
 * devient reçu quand `receivedDay` est posé, avec son mode et la référence de
 * la facture. Le prix du projet est ce qui a été convenu ; les paiements,
 * ce qui est attendu et reçu.
 */
export interface Payment {
  id: string;
  projectId: string;
  /**
   * Numéro unique par compte : la référence stable vers Budget
   * (« projets:paiement:<numéro> »), qu'une restauration ne change pas.
   */
  number: number;
  label: string;
  amountCents: number;
  expectedDay: string | null;
  receivedDay: string | null;
  method: PaymentMethod | null;
  invoiceRef: string;
  position: number;
  createdAt: string;
}

export interface PaymentInput {
  projectId: string;
  label: string;
  amountCents: number;
  expectedDay?: string | null;
  position?: number;
}

export type PaymentPatch = Partial<Pick<Payment, 'label' | 'amountCents' | 'expectedDay' | 'receivedDay' | 'method' | 'invoiceRef' | 'position'>>;

/** Du temps passé sur un projet, noté après coup (§3.10, décision de Jules du 05/10/2026). */
export interface TimeEntry {
  id: string;
  projectId: string;
  /** Le chantier, facultatif ; supprimé, l'entrée reste et perd seulement son chantier. */
  workstreamId: string | null;
  day: string;
  minutes: number;
  note: string;
  createdAt: string;
}

export interface TimeEntryInput {
  projectId: string;
  workstreamId?: string | null;
  day: string;
  minutes: number;
  note?: string;
}

/** Une journée de travail au plus par entrée : au-delà, c'est une faute de frappe. */
export const TIME_ENTRY_MAX_MINUTES = 1440;

/** Les sortes d'images d'un projet (§3.6). */
export const PROJECT_IMAGE_KINDS = ['logo', 'photo', 'maquette'] as const;
export type ProjectImageKind = (typeof PROJECT_IMAGE_KINDS)[number];

/** Peu d'images par projet : le Go gratuit est partagé avec Hauts faits (§3.6, décision du 05/10/2026). */
export const PROJECT_IMAGES_MAX = 20;
export const PROJECT_IMAGE_FULL_SIZE = 2048;
export const PROJECT_IMAGE_THUMB_SIZE = 720;

/**
 * Une image d'un projet : cette ligne dit où la trouver ; l'image elle-même
 * vit à part (IndexedDB en local, le stockage de fichiers de Supabase avec un
 * compte). Le logo du projet est sa première image de sorte « logo ».
 */
export interface ProjectImage {
  id: string;
  projectId: string;
  kind: ProjectImageKind;
  path: string;
  thumbPath: string;
  width: number;
  height: number;
  bytes: number;
  position: number;
  createdAt: string;
}
