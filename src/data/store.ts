import type {
  Action,
  ActionInput,
  AppUser,
  Checkin,
  Goal,
  GoalInput,
  Tier,
  TierInput,
} from '../modules/objectifs/lib/types';

/** Trophée débloqué, définitivement acquis (jamais re-verrouillé). */
export interface UnlockedAchievement {
  id: string;
  unlockedAt: string;
}

/** Réglages du compte, synchronisés entre appareils. */
export interface Settings {
  /** Cible de PP à atteindre chaque jour */
  dailyGoal: number;
  /** Rappel quotidien par notification */
  reminderEnabled: boolean;
  /** Heure locale du rappel, format « HH:MM » */
  reminderTime: string;
  /**
   * Décalage entre UTC et l'heure locale, en minutes. Réécrit à chaque
   * ouverture de l'app : c'est ce qui permet au serveur d'envoyer le rappel
   * à la bonne heure même après un changement d'heure ou un déplacement.
   */
  tzOffset: number;
}

export const DEFAULT_SETTINGS: Settings = {
  dailyGoal: 40,
  reminderEnabled: false,
  reminderTime: '20:00',
  tzOffset: 0,
};

/** Un navigateur abonné aux notifications (iPhone, Mac, Android…). */
export interface PushDevice {
  id: string;
  endpoint: string;
  label: string;
  createdAt: string;
}

export interface PushDeviceInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  label: string;
}

/** État de la fonction d'envoi, pour diagnostiquer sans deviner. */
export interface PushDiagnostic {
  reachable: boolean;
  version: string;
  vapidPublic: boolean;
  vapidPrivate: boolean;
  vapidSubject: boolean;
  /** Début de la clé publique côté serveur, à comparer avec celle du build */
  serverKeyPrefix: string;
}

/** Niveaux d'objectif quotidien proposés (à la Duolingo). */
export const DAILY_GOAL_LEVELS: { label: string; pp: number; hint: string }[] = [
  { label: 'Tranquille', pp: 20, hint: 'une action, ou deux petits pas' },
  { label: 'Régulier', pp: 40, hint: 'deux à trois actions' },
  { label: 'Sérieux', pp: 70, hint: 'une vraie session quotidienne' },
  { label: 'Intense', pp: 120, hint: 'plusieurs objectifs chaque jour' },
];

/** Sauvegarde complète (export/import). La v1 ne contenait que les objectifs. */
export interface Backup {
  goals: Goal[];
  actions: Action[];
  checkins: Checkin[];
  achievements: UnlockedAchievement[];
  settings?: Settings;
}

/**
 * Contrat unique entre l'interface et le stockage.
 *
 * Toute l'application passe par ce contrat et ignore où vivent réellement les
 * données. Passer du navigateur à une base Postgres partagée revient donc à
 * changer d'implémentation, sans toucher à un seul composant.
 */
export interface Store {
  /** true si les données sont sur un serveur (comptes réels, multi-appareils) */
  readonly isRemote: boolean;

  // --- Authentification ---
  getUser(): Promise<AppUser | null>;
  /** Notifie à chaque connexion/déconnexion. Renvoie une fonction de désabonnement. */
  onUserChange(callback: (user: AppUser | null) => void): () => void;
  signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  /** Envoie le mail de réinitialisation de mot de passe. */
  resetPassword(email: string): Promise<void>;
  /** Définit un nouveau mot de passe pour la session en cours. */
  updatePassword(password: string): Promise<void>;
  /**
   * Prévient quand l'utilisateur arrive par un lien de récupération : l'app
   * doit alors lui faire choisir un nouveau mot de passe avant toute chose.
   */
  onPasswordRecovery(callback: () => void): () => void;

  // --- Objectifs ---
  listGoals(): Promise<Goal[]>;
  createGoal(input: GoalInput, tiers: TierInput[]): Promise<Goal>;
  updateGoal(id: string, patch: Partial<GoalInput> & { archived?: boolean }): Promise<void>;
  deleteGoal(id: string): Promise<void>;

  // --- Paliers ---
  createTier(goalId: string, input: TierInput): Promise<Tier>;
  updateTier(id: string, patch: Partial<TierInput> & { completedAt?: string | null }): Promise<void>;
  deleteTier(id: string): Promise<void>;
  /** `orderedIds` donne la nouvelle position de chaque palier de l'objectif */
  reorderTiers(goalId: string, orderedIds: string[]): Promise<void>;

  // --- Actions du quotidien ---
  listActions(): Promise<Action[]>;
  createAction(goalId: string, input: ActionInput): Promise<Action>;
  updateAction(id: string, patch: Partial<ActionInput> & { archived?: boolean }): Promise<void>;
  deleteAction(id: string): Promise<void>;

  // --- Réalisations quotidiennes ---
  listCheckins(): Promise<Checkin[]>;
  /**
   * Enregistre une action faite aujourd'hui. Une seule fois par action et par
   * jour ; `day` au format YYYY-MM-DD. Les PP sont figés à l'enregistrement.
   */
  addCheckin(
    goalId: string,
    day: string,
    actionId: string,
    pp: number,
    value?: number | null,
  ): Promise<Checkin>;
  /**
   * Enregistre un **geste ponctuel** : un vrai pas vers l'objectif, mais pas
   * une habitude. Sans action derrière, donc sans case à cocher le lendemain.
   * Plusieurs par jour sont permis — la contrainte d'unicité porte sur
   * (utilisateur, action, jour), et Postgres traite les actions nulles comme
   * distinctes.
   */
  addOneOff(goalId: string, day: string, title: string, pp: number): Promise<Checkin>;
  /** Ajoute ou modifie la note libre, ou la quantité relevée. */
  updateCheckin(id: string, patch: { note?: string; value?: number | null }): Promise<void>;
  deleteCheckin(id: string): Promise<void>;

  // --- Trophées (acquis pour toujours) ---
  listAchievements(): Promise<UnlockedAchievement[]>;
  /** Idempotent : les ids déjà débloqués sont ignorés. */
  unlockAchievements(ids: string[]): Promise<void>;

  // --- Réglages ---
  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<void>;

  // --- Rappels push ---
  listPushDevices(): Promise<PushDevice[]>;
  /** Enregistre (ou met à jour) l'abonnement de ce navigateur. */
  savePushDevice(input: PushDeviceInput): Promise<void>;
  /** Retire un abonnement, par endpoint. */
  removePushDevice(endpoint: string): Promise<void>;
  /** Déclenche un envoi immédiat vers les appareils de ce compte. */
  sendTestPush(): Promise<{ sent: number; devices: number }>;
  /** Interroge la fonction d'envoi : est-elle là, et bien configurée ? */
  pingPushFunction(): Promise<PushDiagnostic>;

  // --- Sauvegarde ---
  exportAll(): Promise<Backup>;
  importAll(backup: Backup): Promise<void>;
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
