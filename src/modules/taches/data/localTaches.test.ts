import { beforeEach, describe, expect, it } from 'vitest';
import { LocalTaches } from './localTaches';

/**
 * Le module s'appuie sur localStorage ; en environnement Node on en fournit
 * une version minimale — même motif que les autres modules.
 */
const memory = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
  key: (i: number) => [...memory.keys()][i] ?? null,
  get length() {
    return memory.size;
  },
} as Storage;

describe('LocalTaches', () => {
  let store: LocalTaches;

  beforeEach(() => {
    memory.clear();
    store = new LocalTaches();
  });

  it('crée une tâche dans la boîte de réception, avec ses valeurs par défaut', async () => {
    const task = await store.createTask({ title: 'Appeler le garage' });
    expect(task).toMatchObject({
      listId: null,
      parentId: null,
      note: '',
      plannedDay: null,
      plannedTime: null,
      durationMinutes: null,
      dueDay: null,
      priority: 'normale',
      recurrence: null,
      repeatFrom: 'schedule',
      completedAt: null,
    });
    expect(await store.listTasks()).toHaveLength(1);
  });

  it('créer deux fois avec le même id n’écrit qu’une tâche, et rend la première', async () => {
    const first = await store.createTask({ title: 'Passeport' }, 'id-1');
    const again = await store.createTask({ title: 'Passeport (renvoyée)' }, 'id-1');
    expect(again).toEqual(first);
    expect(await store.listTasks()).toHaveLength(1);
  });

  it('une heure n’existe qu’avec un jour prévu', async () => {
    const task = await store.createTask({ title: 'Garage', plannedTime: '09:00' });
    expect(task.plannedTime).toBeNull();
    await store.updateTask(task.id, { plannedDay: '2026-09-28', plannedTime: '09:00' });
    await store.updateTask(task.id, { plannedDay: null });
    expect((await store.listTasks())[0]).toMatchObject({ plannedDay: null, plannedTime: null });
  });

  it('cocher, décocher, modifier', async () => {
    const task = await store.createTask({ title: 'Impôts', plannedDay: '2026-05-24', dueDay: '2026-05-30' });
    await store.updateTask(task.id, { completedAt: '2026-05-24T10:00:00Z', priority: 'urgente' });
    expect((await store.listTasks())[0]).toMatchObject({ completedAt: '2026-05-24T10:00:00Z', priority: 'urgente', dueDay: '2026-05-30' });
    await store.updateTask(task.id, { completedAt: null });
    expect((await store.listTasks())[0].completedAt).toBeNull();
  });

  it('supprimer une tâche emporte ses sous-tâches, pas les autres', async () => {
    const move = await store.createTask({ title: 'Déménagement' });
    await store.createTask({ title: 'Résilier la box', parentId: move.id });
    await store.createTask({ title: 'Cartons', parentId: move.id });
    await store.createTask({ title: 'Autre chose' });
    await store.deleteTask(move.id);
    expect((await store.listTasks()).map((t) => t.title)).toEqual(['Autre chose']);
  });

  it('supprimer une liste renvoie ses tâches à la boîte de réception', async () => {
    const home = await store.createList({ name: 'Maison', color: 'vert' });
    const work = await store.createList({ name: 'Travail' });
    expect([home.position, work.position, work.color]).toEqual([0, 1, 'bleu']);
    const task = await store.createTask({ title: 'Changer l’ampoule', listId: home.id });
    await store.deleteList(home.id);
    expect(await store.listLists()).toEqual([work]);
    expect((await store.listTasks()).find((t) => t.id === task.id)?.listId).toBeNull();
  });

  it('renommer, archiver une liste', async () => {
    const list = await store.createList({ name: 'Papiers' });
    await store.updateList(list.id, { name: 'Administratif', archived: true });
    expect((await store.listLists())[0]).toMatchObject({ name: 'Administratif', archived: true });
  });

  it('exporte et réimporte à l’identique', async () => {
    const list = await store.createList({ name: 'Maison' });
    await store.createTask({ title: 'Arroser', listId: list.id, plannedDay: '2026-09-28', recurrence: { freq: 'daily', interval: 5 }, repeatFrom: 'completion' });
    const backup = await store.exportData();
    memory.clear();
    await store.importData(backup);
    expect(await store.exportData()).toEqual(backup);
  });

  it('écrit sa section sans toucher à celles des autres modules', async () => {
    localStorage.setItem('palier.v1', JSON.stringify({ goals: [{ id: 'g' }] }));
    await store.createTask({ title: 'Passeport' });
    expect(JSON.parse(localStorage.getItem('palier.v1')!).goals).toEqual([{ id: 'g' }]);
  });
});

describe('LocalTaches — réglages des rappels', () => {
  beforeEach(() => memory.clear());

  it('par défaut : rappel à l’heure des tâches, pas de résumé du matin', async () => {
    expect(await new LocalTaches().getSettings()).toEqual({ taskReminders: true, morningEnabled: false, morningTime: '08:00' });
  });

  it('se modifient, et suivent la sauvegarde', async () => {
    const store = new LocalTaches();
    await store.saveSettings({ morningEnabled: true, morningTime: '07:30' });
    const backup = await store.exportData();
    memory.clear();
    await store.importData(backup);
    expect(await store.getSettings()).toEqual({ taskReminders: true, morningEnabled: true, morningTime: '07:30' });
  });
});

describe('LocalTaches — la durée', () => {
  beforeEach(() => memory.clear());

  it('se garde avec une heure, part avec elle', async () => {
    const store = new LocalTaches();
    const t = await store.createTask({ title: 'Réunion', plannedDay: '2026-09-29', plannedTime: '15:00', durationMinutes: 90 });
    expect(t.durationMinutes).toBe(90);
    await store.updateTask(t.id, { plannedTime: null });
    expect((await store.listTasks())[0].durationMinutes).toBeNull();
  });

  it('une tâche enregistrée avant la durée se lit sans durée', async () => {
    localStorage.setItem('palier.v1', JSON.stringify({ tachesTasks: [{ id: 'old', title: 'Ancienne', plannedDay: null, plannedTime: null }] }));
    expect((await new LocalTaches().listTasks())[0].durationMinutes).toBeNull();
  });
});

describe('LocalTaches — les rappels d’une tâche (06/10/2026)', () => {
  beforeEach(() => localStorage.clear());

  it('se gardent, se changent ; une tâche d’avant se lit avec le défaut (`null`)', async () => {
    const store = new LocalTaches();
    const t = await store.createTask({ title: 'Dentiste', plannedDay: '2026-10-07', plannedTime: '09:00', reminders: [15] });
    expect(t.reminders).toEqual([15]);
    await store.updateTask(t.id, { reminders: [] });
    expect((await store.listTasks())[0].reminders).toEqual([]);
    localStorage.setItem('palier.v1', JSON.stringify({ tachesTasks: [{ id: 'old', title: 'Ancienne', plannedDay: null, plannedTime: null }] }));
    expect((await new LocalTaches().listTasks())[0].reminders).toBeNull();
  });
});
