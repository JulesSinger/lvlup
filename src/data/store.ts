import type { AppUser, Checkin, Goal, GoalInput, Tier, TierInput } from '../lib/types';

/** Trophée débloqué, définitivement acquis (jamais re-verrouillé). */
export interface UnlockedAchievement {
  id: string;
  unlockedAt: string;
}

/** Sauvegarde complète (export/import). La v1 ne contenait que les objectifs. */
export interface Backup {
  goals: Goal[];
  checkins: Checkin[];
  achievements: UnlockedAchievement[];
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

  // --- Check-ins quotidiens ---
  listCheckins(): Promise<Checkin[]>;
  /** Un seul check-in par objectif et par jour ; `day` au format YYYY-MM-DD. */
  addCheckin(goalId: string, day: string): Promise<Checkin>;
  /** Ajoute ou modifie la note libre d'un check-in. */
  updateCheckin(id: string, patch: { note?: string }): Promise<void>;
  deleteCheckin(id: string): Promise<void>;

  // --- Trophées (acquis pour toujours) ---
  listAchievements(): Promise<UnlockedAchievement[]>;
  /** Idempotent : les ids déjà débloqués sont ignorés. */
  unlockAchievements(ids: string[]): Promise<void>;

  // --- Sauvegarde ---
  exportAll(): Promise<Backup>;
  importAll(backup: Backup): Promise<void>;
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
