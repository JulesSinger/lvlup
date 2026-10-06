import type { SupabaseClient } from '@supabase/supabase-js';
import { getClient, requireUserId, unwrap } from '../../../core/data/supabaseClient';
import {
  DEFAULT_TACHES_SETTINGS,
  type ListColor,
  type ListInput,
  type Priority,
  type Recurrence,
  type RepeatFrom,
  type TachesSettings,
  type Task,
  type TaskInput,
  type TaskList,
  type TaskPatch,
} from '../lib/types';
import type { TachesBackup, TachesStore } from './tachesStore';

interface ListRow {
  id: string;
  name: string;
  color: ListColor;
  position: number;
  archived: boolean;
  created_at: string;
}

interface TaskRow {
  id: string;
  list_id: string | null;
  parent_id: string | null;
  title: string;
  note: string;
  planned_day: string | null;
  planned_time: string | null;
  duration_minutes: number | null;
  reminders: number[] | null;
  due_day: string | null;
  priority: Priority;
  recurrence: Recurrence | null;
  repeat_from: RepeatFrom;
  position: number;
  completed_at: string | null;
  created_at: string;
}

/** Postgres rend une heure « 14:00:00 » ; l'application parle en « 14:00 ». */
const hhmm = (time: string | null) => (time === null ? null : time.slice(0, 5));

const toList = (r: ListRow): TaskList => ({
  id: r.id,
  name: r.name,
  color: r.color,
  position: r.position,
  archived: r.archived,
  createdAt: r.created_at,
});

const toTask = (r: TaskRow): Task => ({
  id: r.id,
  listId: r.list_id,
  parentId: r.parent_id,
  title: r.title,
  note: r.note,
  plannedDay: r.planned_day,
  plannedTime: hhmm(r.planned_time),
  durationMinutes: r.duration_minutes ?? null,
  reminders: r.reminders ?? null,
  dueDay: r.due_day,
  priority: r.priority,
  recurrence: r.recurrence,
  repeatFrom: r.repeat_from,
  position: r.position,
  completedAt: r.completed_at,
  createdAt: r.created_at,
});

/** Colonnes d'une tâche, pour les seuls champs présents dans `patch`. */
function taskColumns(patch: TaskPatch | TaskInput): Record<string, unknown> {
  const p = patch as TaskPatch;
  const row: Record<string, unknown> = {};
  if (p.listId !== undefined) row.list_id = p.listId;
  if (p.parentId !== undefined) row.parent_id = p.parentId;
  if (p.title !== undefined) row.title = p.title;
  if (p.note !== undefined) row.note = p.note;
  if (p.plannedDay !== undefined) row.planned_day = p.plannedDay;
  if (p.plannedTime !== undefined) row.planned_time = p.plannedTime;
  if (p.durationMinutes !== undefined) row.duration_minutes = p.durationMinutes;
  if (p.reminders !== undefined) row.reminders = p.reminders;
  if (p.dueDay !== undefined) row.due_day = p.dueDay;
  if (p.priority !== undefined) row.priority = p.priority;
  if (p.recurrence !== undefined) row.recurrence = p.recurrence;
  if (p.repeatFrom !== undefined) row.repeat_from = p.repeatFrom;
  if (p.position !== undefined) row.position = p.position;
  if (p.completedAt !== undefined) row.completed_at = p.completedAt;
  // Plus de jour prévu : plus d'heure ; plus d'heure : plus de durée — sinon la base refuse.
  if (p.plannedDay === null) row.planned_time = null;
  if (p.plannedDay === null || p.plannedTime === null) row.duration_minutes = null;
  return row;
}

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** Polaris stocké sur Supabase, protégé par le Row Level Security. */
export class SupabaseTaches implements TachesStore {
  private client: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.client = getClient(url, anonKey);
  }

  private requireUserId(): Promise<string> {
    return requireUserId(this.client);
  }

  async listLists(): Promise<TaskList[]> {
    return (unwrap(await this.client.from('taches_lists').select('*').order('position')) as ListRow[]).map(toList);
  }

  async createList(input: ListInput): Promise<TaskList> {
    const userId = await this.requireUserId();
    const count = (await this.listLists()).length;
    const row = unwrap(
      await this.client
        .from('taches_lists')
        .insert({ user_id: userId, name: input.name, color: input.color ?? 'bleu', position: count })
        .select()
        .single(),
    ) as ListRow;
    return toList(row);
  }

  async updateList(id: string, patch: Partial<ListInput> & { position?: number; archived?: boolean }) {
    check((await this.client.from('taches_lists').update(patch).eq('id', id)).error);
  }

  async deleteList(id: string) {
    // `on delete set null` renvoie ses tâches à la boîte de réception.
    check((await this.client.from('taches_lists').delete().eq('id', id)).error);
  }

  async listTasks(): Promise<Task[]> {
    return (unwrap(await this.client.from('taches_tasks').select('*')) as TaskRow[]).map(toTask);
  }

  async createTask(input: TaskInput, id?: string): Promise<Task> {
    const userId = await this.requireUserId();
    if (id) {
      // Rejouable : `on conflict do nothing` sur l'id, puis relecture — même
      // motif que les entrées de Cérès. Un second envoi ne crée rien.
      const { error } = await this.client
        .from('taches_tasks')
        .upsert({ id, user_id: userId, ...taskColumns(input) }, { onConflict: 'id', ignoreDuplicates: true });
      check(error);
      return toTask(unwrap(await this.client.from('taches_tasks').select('*').eq('id', id).single()) as TaskRow);
    }
    const row = unwrap(
      await this.client
        .from('taches_tasks')
        .insert({ user_id: userId, ...taskColumns(input) })
        .select()
        .single(),
    ) as TaskRow;
    return toTask(row);
  }

  async updateTask(id: string, patch: TaskPatch) {
    check((await this.client.from('taches_tasks').update(taskColumns(patch)).eq('id', id)).error);
  }

  async deleteTask(id: string) {
    // `on delete cascade` emporte les sous-tâches.
    check((await this.client.from('taches_tasks').delete().eq('id', id)).error);
  }

  async getSettings(): Promise<TachesSettings> {
    const { data, error } = await this.client.from('taches_settings').select('task_reminders, morning_enabled, morning_time').maybeSingle();
    check(error);
    if (!data) return { ...DEFAULT_TACHES_SETTINGS };
    return { taskReminders: data.task_reminders, morningEnabled: data.morning_enabled, morningTime: data.morning_time };
  }

  async saveSettings(patch: Partial<TachesSettings>) {
    const userId = await this.requireUserId();
    const next = { ...(await this.getSettings()), ...patch };
    check(
      (
        await this.client.from('taches_settings').upsert(
          {
            user_id: userId,
            task_reminders: next.taskReminders,
            morning_enabled: next.morningEnabled,
            morning_time: next.morningTime,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        )
      ).error,
    );
  }

  async exportData(): Promise<TachesBackup> {
    return { lists: await this.listLists(), tasks: await this.listTasks(), settings: await this.getSettings() };
  }

  /**
   * Remplace tout, comme une restauration de sauvegarde. Les identifiants
   * sont gardés (des uuid choisis par l'application) : les tâches
   * retrouvent leur liste et leurs sous-tâches sans table de correspondance.
   * Les tâches d'abord sans parent, puis les sous-tâches, pour la clé étrangère.
   */
  async importData(data: TachesBackup) {
    const userId = await this.requireUserId();
    check((await this.client.from('taches_tasks').delete().eq('user_id', userId)).error);
    check((await this.client.from('taches_lists').delete().eq('user_id', userId)).error);

    const lists = data.lists ?? [];
    if (lists.length > 0) {
      check(
        (
          await this.client.from('taches_lists').insert(
            lists.map((l) => ({ id: l.id, user_id: userId, name: l.name, color: l.color, position: l.position, archived: l.archived })),
          )
        ).error,
      );
    }
    const tasks = data.tasks ?? [];
    const row = (t: Task) => ({ id: t.id, user_id: userId, ...taskColumns(t) });
    for (const batch of [tasks.filter((t) => !t.parentId), tasks.filter((t) => t.parentId)]) {
      if (batch.length > 0) check((await this.client.from('taches_tasks').insert(batch.map(row))).error);
    }
    if (data.settings) await this.saveSettings(data.settings);
  }
}
