import { newId } from '../../../core/data/coreStore';
import { readRaw, writeRaw } from '../../../core/data/localSnapshot';
import { DEFAULT_TACHES_SETTINGS, type ListInput, type TachesSettings, type Task, type TaskInput, type TaskList, type TaskPatch } from '../lib/types';
import type { TachesBackup, TachesStore } from './tachesStore';

const arrayOf = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

/** Lecture des seules sections du module, sur le blob local partagé. */
function read(): TachesBackup {
  const raw = readRaw();
  const settings = raw.tachesSettings && typeof raw.tachesSettings === 'object' ? (raw.tachesSettings as TachesSettings) : undefined;
  // Une tâche enregistrée avant la durée (28/09/2026) n'a pas le champ : `null`.
  const tasks = arrayOf<Task>(raw.tachesTasks).map((t) => ({ ...t, durationMinutes: t.durationMinutes ?? null }));
  return { lists: arrayOf<TaskList>(raw.tachesLists), tasks, settings };
}

/** Écriture par fusion : les sections des autres modules sont préservées. */
function write(s: TachesBackup) {
  writeRaw({ ...readRaw(), tachesLists: s.lists, tachesTasks: s.tasks, ...(s.settings ? { tachesSettings: s.settings } : {}) });
}

/** Une heure n'existe qu'avec un jour prévu, une durée qu'avec une heure — comme les contraintes côté base. */
function normalized(task: Task): Task {
  const t = task.plannedDay ? task : { ...task, plannedTime: null };
  return t.plannedTime ? t : { ...t, durationMinutes: null };
}

/** Polaris stocké dans le navigateur, sans compte ni serveur. */
export class LocalTaches implements TachesStore {
  async listLists(): Promise<TaskList[]> {
    return read().lists.slice();
  }

  async createList(input: ListInput): Promise<TaskList> {
    const s = read();
    const list: TaskList = {
      id: newId(),
      name: input.name,
      color: input.color ?? 'bleu',
      position: s.lists.length,
      archived: false,
      createdAt: new Date().toISOString(),
    };
    s.lists.push(list);
    write(s);
    return list;
  }

  async updateList(id: string, patch: Partial<ListInput> & { position?: number; archived?: boolean }) {
    const s = read();
    const list = s.lists.find((l) => l.id === id);
    if (!list) return;
    Object.assign(list, patch);
    write(s);
  }

  async deleteList(id: string) {
    const s = read();
    s.lists = s.lists.filter((l) => l.id !== id);
    // Comme `on delete set null` : les tâches retournent à la boîte de réception.
    for (const task of s.tasks) if (task.listId === id) task.listId = null;
    write(s);
  }

  async listTasks(): Promise<Task[]> {
    return read().tasks.slice();
  }

  async createTask(input: TaskInput, id: string = newId()): Promise<Task> {
    const s = read();
    const existing = s.tasks.find((t) => t.id === id);
    if (existing) return existing; // rejouée : rien de plus
    const task = normalized({
      id,
      listId: input.listId ?? null,
      parentId: input.parentId ?? null,
      title: input.title,
      note: input.note ?? '',
      plannedDay: input.plannedDay ?? null,
      plannedTime: input.plannedTime ?? null,
      durationMinutes: input.durationMinutes ?? null,
      dueDay: input.dueDay ?? null,
      priority: input.priority ?? 'normale',
      recurrence: input.recurrence ?? null,
      repeatFrom: input.repeatFrom ?? 'schedule',
      position: input.position ?? 0,
      completedAt: null,
      createdAt: new Date().toISOString(),
    });
    s.tasks.push(task);
    write(s);
    return task;
  }

  async updateTask(id: string, patch: TaskPatch) {
    const s = read();
    const i = s.tasks.findIndex((t) => t.id === id);
    if (i < 0) return;
    s.tasks[i] = normalized({ ...s.tasks[i], ...patch });
    write(s);
  }

  async deleteTask(id: string) {
    const s = read();
    // Comme `on delete cascade` : les sous-tâches partent avec leur tâche.
    s.tasks = s.tasks.filter((t) => t.id !== id && t.parentId !== id);
    write(s);
  }

  async getSettings(): Promise<TachesSettings> {
    return { ...DEFAULT_TACHES_SETTINGS, ...read().settings };
  }

  async saveSettings(patch: Partial<TachesSettings>) {
    const s = read();
    write({ ...s, settings: { ...DEFAULT_TACHES_SETTINGS, ...s.settings, ...patch } });
  }

  async exportData(): Promise<TachesBackup> {
    const s = read();
    return { lists: s.lists.slice(), tasks: s.tasks.slice(), settings: await this.getSettings() };
  }

  async importData(data: TachesBackup) {
    write({ lists: data.lists ?? [], tasks: data.tasks ?? [], settings: data.settings });
  }
}
