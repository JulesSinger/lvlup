import type {
  Action,
  ActionInput,
  Checkin,
  FreezePurchase,
  Goal,
  GoalInput,
  Tier,
  TierInput,
} from '../lib/types';

/** Trophée débloqué, définitivement acquis (jamais re-verrouillé). */
export interface UnlockedAchievement {
  id: string;
  unlockedAt: string;
}

/**
 * La part du module dans une sauvegarde. Le socle n'en connaît pas la forme :
 * il se contente d'assembler les sections que les modules lui donnent.
 */
export interface GoalsBackup {
  goals: Goal[];
  actions: Action[];
  checkins: Checkin[];
  achievements: UnlockedAchievement[];
  /** Absent des sauvegardes antérieures aux gels achetés : traité comme vide. */
  freezePurchases?: FreezePurchase[];
}

/** Contrat de stockage du module objectifs. */
export interface GoalsStore {
  listGoals(): Promise<Goal[]>;
  /**
   * `actions` remplace les deux actions génériques quand on sait déjà en quoi
   * l'objectif se compte : un palier « 100 km » a besoin d'actions qui portent
   * des kilomètres, sans quoi il reste à 0/100 quoi qu'on coche.
   */
  createGoal(input: GoalInput, tiers: TierInput[], actions?: ActionInput[]): Promise<Goal>;
  updateGoal(id: string, patch: Partial<GoalInput> & { archived?: boolean }): Promise<void>;
  deleteGoal(id: string): Promise<void>;

  createTier(goalId: string, input: TierInput): Promise<Tier>;
  updateTier(id: string, patch: Partial<TierInput> & { completedAt?: string | null }): Promise<void>;
  deleteTier(id: string): Promise<void>;
  /** `orderedIds` donne la nouvelle position de chaque palier de l'objectif */
  reorderTiers(goalId: string, orderedIds: string[]): Promise<void>;

  listActions(): Promise<Action[]>;
  createAction(goalId: string, input: ActionInput): Promise<Action>;
  updateAction(id: string, patch: Partial<ActionInput> & { archived?: boolean }): Promise<void>;
  deleteAction(id: string): Promise<void>;

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
   */
  addOneOff(goalId: string, day: string, title: string, pp: number): Promise<Checkin>;
  /** Ajoute ou modifie la note libre, ou la quantité relevée. */
  updateCheckin(id: string, patch: { note?: string; value?: number | null }): Promise<void>;
  deleteCheckin(id: string): Promise<void>;

  listAchievements(): Promise<UnlockedAchievement[]>;
  /** Idempotent : les ids déjà débloqués sont ignorés. */
  unlockAchievements(ids: string[]): Promise<void>;

  /** Sa section de la sauvegarde — le socle ne fait que l'assembler. */
  // --- Gels achetés (journal, jamais un solde) ---
  listFreezePurchases(): Promise<FreezePurchase[]>;
  /** Journalise un achat. Le contrôle du solde appartient à l'appelant. */
  buyFreeze(day: string, cost: number): Promise<FreezePurchase>;

  exportData(): Promise<GoalsBackup>;
  importData(data: GoalsBackup): Promise<void>;
}
