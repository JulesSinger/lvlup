import type {
  ImportToken,
  Plan,
  PlanInput,
  PlanPatch,
  PlanSession,
  PlanSessionDraft,
  PlanSessionPatch,
  Run,
  RunImport,
  RunInput,
  RunPatch,
  SportSettings,
} from '../lib/types';

/**
 * La part du module dans une sauvegarde. Le socle n'en connaît pas la forme
 * (voir `core/data/backup.ts`).
 *
 * Les jetons du raccourci n'y sont pas : on ne range que leur empreinte, qui
 * ne sert à rien hors du compte qui l'a créée — et un jeton se recrée en un
 * geste.
 */
export interface SportBackup {
  runs: Run[];
  plans: Plan[];
  sessions: PlanSession[];
  settings?: SportSettings;
}

/**
 * Contrat de stockage du module Sport (docs/etude-sport.md §7).
 *
 * Les identifiants sont choisis par l'application (`id` facultatif) : une
 * création rejouée n'écrit rien de plus et rend la première.
 */
export interface SportStore {
  /** Toutes les sorties, de la plus ancienne à la plus récente. */
  listRuns(): Promise<Run[]>;
  createRun(input: RunInput, id?: string): Promise<Run>;
  updateRun(id: string, patch: RunPatch): Promise<void>;
  deleteRun(id: string): Promise<void>;
  /**
   * Importe un lot (archive Strava, fichier, raccourci). Une sortie dont la
   * référence est déjà connue est ignorée : rejouer un import n'ajoute rien.
   * Rend le nombre de sorties ajoutées.
   */
  importRuns(runs: RunImport[]): Promise<number>;

  listPlans(): Promise<Plan[]>;
  createPlan(input: PlanInput, id?: string): Promise<Plan>;
  updatePlan(id: string, patch: PlanPatch): Promise<void>;
  /** Emporte ses séances ; les sorties qui les avaient faites restent, détachées. */
  deletePlan(id: string): Promise<void>;

  /** Les séances de tous les plans, par plan, semaine et position. */
  listSessions(): Promise<PlanSession[]>;
  /** Pose un plan généré d'un bloc ; rejouable (une séance déjà là est ignorée). */
  addSessions(sessions: PlanSessionDraft[]): Promise<void>;
  updateSession(id: string, patch: PlanSessionPatch): Promise<void>;
  /** Les sorties qui l'avaient faite restent, détachées. */
  deleteSession(id: string): Promise<void>;
  /** Plusieurs séances d'un coup (recaler le plan sur une nouvelle date). */
  deleteSessions(ids: string[]): Promise<void>;

  getSettings(): Promise<SportSettings>;
  updateSettings(patch: Partial<SportSettings>): Promise<void>;

  /** Les jetons du raccourci iPhone, sans leur empreinte. */
  listTokens(): Promise<ImportToken[]>;
  /** Range l'empreinte (SHA-256, 64 caractères hexadécimaux) d'un jeton créé dans l'app. */
  createToken(tokenHash: string, label: string, id?: string): Promise<ImportToken>;
  deleteToken(id: string): Promise<void>;

  /** Sa section de la sauvegarde — le socle ne fait que l'assembler. */
  exportData(): Promise<SportBackup>;
  importData(data: SportBackup): Promise<void>;
}
