import type { ImageSize, PreparedImage } from '../../../core/lib/images';
import type {
  Cooked,
  CookedInput,
  PlanEntry,
  PlanEntryInput,
  Recipe,
  RecipeInput,
  RecipePatch,
  RecipePhoto,
  RecettesSettings,
} from '../lib/types';

/**
 * La part du module dans une sauvegarde. Le socle n'en connaît pas la forme
 * (voir `core/data/backup.ts`). Comme Hauts faits et Projets : la liste des
 * photos, pas leur contenu — une sauvegarde JSON ne porte pas d'images.
 */
export interface RecettesBackup {
  recipes: Recipe[];
  photos?: RecipePhoto[];
  cooked: Cooked[];
  plan: PlanEntry[];
  settings?: RecettesSettings;
}

/**
 * Contrat de stockage du module Recettes (docs/etude-recettes.md §7).
 *
 * Les identifiants sont choisis par l'application (`id` facultatif) : une
 * création rejouée n'écrit rien de plus et rend la première.
 */
export interface RecettesStore {
  /** Toutes les recettes, par titre. */
  listRecipes(): Promise<Recipe[]>;
  createRecipe(input: RecipeInput, id?: string): Promise<Recipe>;
  updateRecipe(id: string, patch: RecipePatch): Promise<void>;
  /** Emporte sa photo (fichiers compris), son historique et ses places au menu. */
  deleteRecipe(id: string): Promise<void>;

  listPhotos(): Promise<RecipePhoto[]>;
  /**
   * Pose la photo d'une recette, ou remplace celle qu'elle avait — une seule
   * par recette. Les fichiers PUIS la ligne : une coupure laisse au pire un
   * fichier sans ligne, jamais une ligne vers une image absente.
   */
  setPhoto(recipeId: string, image: PreparedImage, id?: string): Promise<RecipePhoto>;
  photoBlob(photo: RecipePhoto, size: ImageSize): Promise<Blob>;
  /** La ligne PUIS les fichiers, pour la même raison. */
  removePhoto(photo: RecipePhoto): Promise<void>;

  /** L'historique « je l'ai faite », du plus ancien au plus récent. */
  listCooked(): Promise<Cooked[]>;
  addCooked(input: CookedInput, id?: string): Promise<Cooked>;
  updateCooked(id: string, patch: Partial<Omit<CookedInput, 'recipeId'>>): Promise<void>;
  deleteCooked(id: string): Promise<void>;

  /** Le menu des jours `from` à `to` (inclus), par jour, repas et position. */
  listPlan(from: string, to: string): Promise<PlanEntry[]>;
  addPlanEntry(input: PlanEntryInput, id?: string): Promise<PlanEntry>;
  updatePlanEntry(id: string, patch: Partial<PlanEntryInput>): Promise<void>;
  deletePlanEntry(id: string): Promise<void>;

  getSettings(): Promise<RecettesSettings>;
  updateSettings(patch: Partial<RecettesSettings>): Promise<void>;

  /** Sa section de la sauvegarde — le socle ne fait que l'assembler. */
  exportData(): Promise<RecettesBackup>;
  importData(data: RecettesBackup): Promise<void>;
}
