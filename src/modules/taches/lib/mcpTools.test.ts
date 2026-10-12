import { describe, expect, it } from 'vitest';
import * as server from '../../../../supabase/functions/atlas-mcp/taches.ts';
import { tachesTools, type ListRow, type TachesData, type TaskRow } from '../../../../supabase/functions/atlas-mcp/taches.ts';
import { plannedReminders } from './reminders';
import { nextOccurrence } from './repeat';
import * as types from './types';
import { todayView } from './views';

const toTask = (r: TaskRow): types.Task => ({
  id: r.id,
  listId: r.list_id,
  parentId: r.parent_id,
  title: r.title,
  note: r.note,
  plannedDay: r.planned_day,
  plannedTime: r.planned_time,
  durationMinutes: r.duration_minutes,
  reminders: r.reminders,
  dueDay: r.due_day,
  priority: r.priority,
  recurrence: r.recurrence,
  repeatFrom: r.repeat_from,
  position: r.position,
  completedAt: r.completed_at,
  createdAt: r.created_at,
});

let n = 0;
const row = (extra: Partial<TaskRow>): TaskRow => ({
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
  list_id: null,
  parent_id: null,
  title: 'T',
  note: '',
  planned_day: null,
  planned_time: null,
  duration_minutes: null,
  reminders: null,
  due_day: null,
  priority: 'normale',
  recurrence: null,
  repeat_from: 'schedule',
  position: 0,
  completed_at: null,
  created_at: '2026-10-01T00:00:00Z',
  ...extra,
});

describe('les règles de Tâches recopiées dans le connecteur', () => {
  it('ont les bornes du module', () => {
    expect(server.PRIORITIES).toEqual(types.PRIORITIES);
    expect(server.REPEAT_FROM).toEqual(types.REPEAT_FROM);
    expect(server.LIST_COLORS).toEqual(types.LIST_COLORS);
    expect(server.TASK_REMINDERS).toEqual(types.TASK_REMINDERS);
    expect([server.TASK_TITLE_MAX, server.DURATION_MIN, server.DURATION_MAX, server.MAX_TASK_REMINDERS]).toEqual([
      types.TASK_TITLE_MAX,
      types.DURATION_MIN,
      types.DURATION_MAX,
      types.MAX_TASK_REMINDERS,
    ]);
  });

  it('font avancer une tâche répétée comme l’app', () => {
    const cases: Partial<TaskRow>[] = [
      { planned_day: '2026-10-12', recurrence: { freq: 'weekly', interval: 1 } },
      { planned_day: '2026-10-05', recurrence: { freq: 'weekly', interval: 1, byWeekday: [1, 4] } },
      { planned_day: '2026-01-31', recurrence: { freq: 'monthly', interval: 1 } },
      { planned_day: '2026-10-10', recurrence: { freq: 'daily', interval: 10 }, repeat_from: 'completion' },
      { planned_day: '2026-01-31', recurrence: { freq: 'monthly', interval: 1 }, repeat_from: 'completion' },
      { planned_day: '2026-10-01', recurrence: { freq: 'daily', interval: 1, count: 3 } },
      { planned_day: '2026-10-13', recurrence: { freq: 'yearly', interval: 1, until: '2027-01-01' } },
    ];
    for (const c of cases) {
      const r = row(c);
      for (const done of ['2026-10-13', '2026-11-30']) expect(server.nextOccurrence(r, done)).toEqual(nextOccurrence(toTask(r), done));
    }
  });

  it('posent les mêmes rappels, l’heure lue dans le fuseau de Jules', () => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const tasks = [
      row({ title: 'garage', planned_day: '2026-10-13', planned_time: '09:00' }),
      row({ title: 'dentiste', planned_day: '2026-10-14', planned_time: '14:30', reminders: [15, 1440], due_day: '2026-10-16' }),
      row({ title: 'muette', planned_day: '2026-10-14', planned_time: '18:00', reminders: [] }),
      row({ title: 'sans heure', planned_day: '2026-10-15', priority: 'urgente' }),
      row({ title: 'retard', planned_day: '2026-10-10' }),
      row({ title: 'trop loin', planned_day: '2026-10-30', planned_time: '08:00' }),
      row({ title: 'après le changement d’heure', planned_day: '2026-10-26', planned_time: '07:00' }),
    ];
    const now = new Date('2026-10-13T05:00:00Z');
    for (const settings of [
      { taskReminders: true, morningEnabled: true, morningTime: '08:00' },
      { taskReminders: false, morningEnabled: false, morningTime: '08:00' },
    ]) {
      expect(server.plannedTaskReminders(tasks, settings, now, zone)).toEqual(plannedReminders(tasks.map(toTask), settings, now));
    }
  });

  it('font la même vue Aujourd’hui', () => {
    const tasks = [
      row({ title: 'retard', planned_day: '2026-10-10' }),
      row({ title: 'du jour 9 h', planned_day: '2026-10-13', planned_time: '09:00' }),
      row({ title: 'urgente', planned_day: '2026-10-13', priority: 'urgente' }),
      row({ title: 'échéance proche', due_day: '2026-10-15' }),
      row({ title: 'plus tard', planned_day: '2026-10-20' }),
      row({ title: 'faite', planned_day: '2026-10-13', completed_at: '2026-10-13T08:00:00Z' }),
    ];
    const s = server.todayView(tasks, '2026-10-13');
    const app = todayView(tasks.map(toTask), '2026-10-13');
    expect(s.overdue.map((t) => t.id)).toEqual(app.overdue.map((t) => t.id));
    expect(s.today.map((t) => t.id)).toEqual(app.today.map((t) => t.id));
  });
});

function memory() {
  let k = 0;
  const uuid = () => `00000000-0000-4000-9000-${String(++k).padStart(12, '0')}`;
  const db = { tasks: [] as TaskRow[], lists: [] as ListRow[] };
  const data: TachesData = {
    listTasks: async () => [...db.tasks],
    insertTask: async (r) => {
      const t = row({ ...(r as Partial<TaskRow>), created_at: `2026-10-13T00:00:${String(db.tasks.length).padStart(2, '0')}Z` });
      db.tasks.push(t);
      return t;
    },
    updateTask: async (id, r) => {
      const t = db.tasks.find((x) => x.id === id);
      return t ? Object.assign(t, r) : null;
    },
    deleteTask: async (id) => {
      const before = db.tasks.length;
      db.tasks = db.tasks.filter((t) => t.id !== id && t.parent_id !== id);
      return db.tasks.length < before;
    },
    listLists: async () => [...db.lists],
    insertList: async (r) => {
      const l = { archived: false, position: 0, color: 'bleu', ...r } as ListRow;
      db.lists.push(l);
      return l;
    },
    updateList: async (id, r) => {
      const l = db.lists.find((x) => x.id === id);
      return l ? Object.assign(l, r) : null;
    },
    getSettings: async () => ({ taskReminders: true, morningEnabled: false, morningTime: '08:00' }),
    scheduleReminders: async (r) => {
      scheduled.splice(0, scheduled.length, ...r);
    },
  };
  const scheduled: server.ReminderInput[] = [];
  return { db, data, uuid, scheduled };
}

async function use(m: ReturnType<typeof memory>, name: string, args: Record<string, unknown> = {}) {
  const tool = tachesTools.find((t) => t.name === name)!;
  try {
    const result = await tool.run(args, { data: m.data, today: '2026-10-13', now: '2026-10-13T10:00:00.000Z', newId: m.uuid, timezone: 'Europe/Paris' });
    let value = null;
    try {
      value = JSON.parse(result.text);
    } catch {
      // texte
    }
    return { error: false, text: result.text, value };
  } catch (err) {
    return { error: true, text: (err as Error).message, value: null };
  }
}

describe('les outils de Tâches pour Claude', () => {
  it('ajoutent, rangent, listent et modifient', async () => {
    const m = memory();
    await use(m, 'taches_liste_creer', { name: 'Maison', color: 'vert' });
    const garage = await use(m, 'taches_ajouter', { title: 'Appeler le garage', planned_day: '2026-10-14', planned_time: '9h', priority: 'importante' });
    expect(garage.value.task).toMatchObject({ planned_time: '09:00', list: null, priority: 'importante' });
    // Le rappel « à l'heure » est posé aussitôt, à 9 h de Paris.
    expect(m.scheduled).toEqual([expect.objectContaining({ fireAt: '2026-10-14T07:00:00.000Z', title: 'Appeler le garage', body: 'Prévue à 9 h' })]);
    const vitres = await use(m, 'taches_ajouter', { title: 'Laver les vitres', list: 'maison', subtasks: ['Salon', 'Chambre'] });
    expect(vitres.value.task).toMatchObject({ list: 'Maison', subtasks: [{ title: 'Salon' }, { title: 'Chambre' }] });
    expect((await use(m, 'taches_ajouter', { title: 'X', list: 'Bureau' })).text).toMatch(/Aucune liste « Bureau »/);
    expect((await use(m, 'taches_ajouter', { title: 'X', planned_time: '10:00' })).text).toMatch(/heure a besoin d’un jour/);
    expect((await use(m, 'taches_ajouter', { title: 'X', repeat: { freq: 'weekly' } })).text).toMatch(/jour prévu/);

    await use(m, 'taches_ajouter', { title: 'Payer le loyer', due_day: '2026-10-12' });
    const today = (await use(m, 'taches_lister', { view: 'aujourdhui' })).value;
    expect(today.overdue.map((t: { title: string }) => t.title)).toEqual(['Payer le loyer']);
    expect((await use(m, 'taches_lister', { view: 'a_venir' })).value.days[0]).toMatchObject({ day: '2026-10-14', tasks: [{ title: 'Appeler le garage' }] });
    expect((await use(m, 'taches_lister', { view: 'liste', list: 'Maison' })).value.tasks).toHaveLength(1);

    const id = garage.value.task.id;
    await use(m, 'taches_modifier', { id, planned_time: null });
    expect(m.db.tasks.find((t) => t.id === id)).toMatchObject({ planned_time: null, planned_day: '2026-10-14' });
    expect(m.scheduled).toEqual([]);
  });

  it('cochent : une tâche simple, puis une tâche répétée qui avance et garde sa trace', async () => {
    const m = memory();
    const simple = (await use(m, 'taches_ajouter', { title: 'Poster le colis' })).value.task;
    await use(m, 'taches_cocher', { id: simple.id });
    expect(m.db.tasks.find((t) => t.id === simple.id)?.completed_at).toBe('2026-10-13T10:00:00.000Z');
    await use(m, 'taches_cocher', { id: simple.id, done: false });
    expect(m.db.tasks.find((t) => t.id === simple.id)?.completed_at).toBeNull();

    const arroser = (await use(m, 'taches_ajouter', { title: 'Arroser', planned_day: '2026-10-13', repeat: { freq: 'weekly', by_weekday: [2, 5] }, subtasks: ['Balcon'] })).value.task;
    expect(arroser.repeat).toBe('Toutes les semaines le mardi et le vendredi');
    m.db.tasks.find((t) => t.title === 'Balcon')!.completed_at = '2026-10-13T08:00:00Z';
    const done = await use(m, 'taches_cocher', { id: arroser.id });
    expect(done.text).toMatch(/prochaine fois le 2026-10-16/);
    expect(m.db.tasks.find((t) => t.id === arroser.id)).toMatchObject({ planned_day: '2026-10-16', completed_at: null });
    expect(m.db.tasks.find((t) => t.title === 'Arroser' && t.completed_at)).toMatchObject({ recurrence: null, planned_day: '2026-10-13' });
    expect(m.db.tasks.find((t) => t.title === 'Balcon')?.completed_at).toBeNull();
    expect((await use(m, 'taches_lister', { view: 'terminees' })).value.tasks.map((t: { title: string }) => t.title)).toEqual(['Arroser']);

    await use(m, 'taches_supprimer', { id: arroser.id });
    expect(m.db.tasks.some((t) => t.id === arroser.id || t.title === 'Balcon')).toBe(false);
  });

  it('disent à Claude ce qui détruit', () => {
    const hints = Object.fromEntries(tachesTools.map((t) => [t.name, t.annotations]));
    expect(hints.taches_supprimer.destructiveHint).toBe(true);
    expect(hints.taches_lister.readOnlyHint).toBe(true);
  });
});
