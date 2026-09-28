import type { ListInput, TachesSettings, Task, TaskInput, TaskList, TaskPatch } from '../lib/types';

/**
 * La part du module dans une sauvegarde. Le socle n'en connaît pas la
 * forme : il se contente d'assembler les sections que les modules lui
 * donnent (voir `core/data/backup.ts`).
 */
export interface TachesBackup {
  lists: TaskList[];
  tasks: Task[];
  /** Absent des sauvegardes d'avant l'étape 5 */
  settings?: TachesSettings;
}

/**
 * Contrat de stockage du module tâches (Polaris).
 *
 * Une tâche répétée n'a qu'une ligne à la fois : la cocher la fait avancer à
 * sa date suivante (règle de l'étape 2, pas du stockage), une copie
 * terminée gardant la trace. Le contrat ne connaît donc que des tâches.
 */
export interface TachesStore {
  listLists(): Promise<TaskList[]>;
  createList(input: ListInput): Promise<TaskList>;
  updateList(id: string, patch: Partial<ListInput> & { position?: number; archived?: boolean }): Promise<void>;
  /** Ses tâches retournent à la boîte de réception, jamais à la corbeille. */
  deleteList(id: string): Promise<void>;

  listTasks(): Promise<Task[]>;
  /**
   * `id` est choisi par l'application avant le premier envoi : créer deux
   * fois la même tâche n'en écrit qu'une et rend la première (rejeu sans
   * doublon, pour la file hors ligne à venir).
   */
  createTask(input: TaskInput, id?: string): Promise<Task>;
  updateTask(id: string, patch: TaskPatch): Promise<void>;
  /** Emporte ses sous-tâches. */
  deleteTask(id: string): Promise<void>;

  /** Les réglages des rappels ; ceux par défaut tant que rien n'a été choisi. */
  getSettings(): Promise<TachesSettings>;
  saveSettings(patch: Partial<TachesSettings>): Promise<void>;

  /** Sa section de la sauvegarde — le socle ne fait que l'assembler. */
  exportData(): Promise<TachesBackup>;
  importData(data: TachesBackup): Promise<void>;
}
