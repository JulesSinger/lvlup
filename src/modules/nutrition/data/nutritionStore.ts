import type { Entry, EntryInput, Food, FoodInput, Target, TargetInput } from '../lib/types';

/**
 * La part du module dans une sauvegarde. Le socle n'en connaît pas la
 * forme : il se contente d'assembler les sections que les modules lui
 * donnent (voir `core/data/backup.ts`).
 */
export interface NutritionBackup {
  foods: Food[];
  entries: Entry[];
  targets: Target[];
}

/** Contrat de stockage du module nutrition (Cérès). */
export interface NutritionStore {
  listFoods(): Promise<Food[]>;
  createFood(input: FoodInput): Promise<Food>;
  /** Corriger un aliment ne touche jamais les entrées déjà saisies (valeurs figées). */
  updateFood(id: string, patch: Partial<FoodInput>): Promise<void>;
  /** Les entrées qui le référençaient restent, sans référence (`foodId: null`). */
  deleteFood(id: string): Promise<void>;

  /** Entrées des jours `from` à `to`, bornes comprises (YYYY-MM-DD). */
  listEntries(from: string, to: string): Promise<Entry[]>;
  /**
   * Les valeurs (kcal, macros) arrivent déjà calculées : ce contrat ne
   * connaît pas la règle de calcul, il écrit ce qu'on lui donne.
   */
  createEntry(input: EntryInput): Promise<Entry>;
  updateEntry(id: string, patch: Partial<EntryInput>): Promise<void>;
  deleteEntry(id: string): Promise<void>;

  /** Tous les objectifs, du plus ancien au plus récent. */
  listTargets(): Promise<Target[]>;
  /**
   * Pose l'objectif en vigueur à partir de `effectiveFrom`. S'il en existe
   * déjà un pour ce jour-là, il est remplacé — un jour n'a qu'un objectif.
   */
  setTarget(input: TargetInput): Promise<Target>;
  deleteTarget(id: string): Promise<void>;

  /** Sa section de la sauvegarde — le socle ne fait que l'assembler. */
  exportData(): Promise<NutritionBackup>;
  importData(data: NutritionBackup): Promise<void>;
}
