import { beforeEach, describe, expect, it } from 'vitest';
import { createOutbox } from '../../../core/data/outbox';
import { completionPlan } from '../lib/repeat';
import type { Task } from '../lib/types';
import { applyCompletion } from './applyPlans';
import { LocalTaches } from './localTaches';
import type { TachesStore } from './tachesStore';
import { applyPendingTasks, pendingTaskIds, taskFromInput, withCreate, withDelete, withUpdate, type TaskOp } from './taskOutbox';
import { createTaskWriter } from './taskWriter';

/**
 * La file existe pour une seule raison : ne jamais perdre une tâche notée ou
 * cochée sans réseau. Ces tests vérifient qu'elle tient cette promesse, y
 * compris dans les enchaînements tordus, et que le rejeu ne double rien.
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

const server = (id: string, overrides: Partial<Task> = {}): Task => taskFromInput(id, { title: id, ...overrides }, 0);

describe('mise en file', () => {
  it('une modification d’une tâche pas encore partie se fond dans sa création, coche comprise', () => {
    const ops = withUpdate(withCreate([], 'a', { title: 'Garage' }), 'a', { completedAt: 'x', priority: 'urgente' });
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ kind: 'create', input: { title: 'Garage', completedAt: 'x', priority: 'urgente' } });
  });

  it('deux modifications d’une tâche du serveur n’en font qu’une', () => {
    const ops = withUpdate(withUpdate([], 'a', { title: 'B' }), 'a', { priority: 'urgente' });
    expect(ops).toEqual([expect.objectContaining({ kind: 'update', patch: { title: 'B', priority: 'urgente' } })]);
  });

  it('créer puis supprimer hors ligne : rien ne part, sous-tâches comprises', () => {
    const ops = withCreate(withCreate([], 'p', { title: 'Déménagement' }), 's', { title: 'Cartons', parentId: 'p' });
    expect(withDelete(ops, 'p')).toEqual([]);
  });

  it('supprimer une tâche du serveur rend ses modifications en attente sans objet', () => {
    expect(withDelete(withUpdate([], 'a', { title: 'B' }), 'a')).toEqual([expect.objectContaining({ kind: 'delete', taskId: 'a' })]);
  });

  it('pendingTaskIds : les tâches qui attendent', () => {
    expect(pendingTaskIds(withUpdate(withCreate([], 'a', { title: 'A' }), 'b', { title: 'B' }))).toEqual(new Set(['a', 'b']));
  });
});

describe('applyPendingTasks — l’écran reste fidèle', () => {
  it('ajoute les tâches en attente, applique les modifications, retire les suppressions et leurs sous-tâches', () => {
    let ops: TaskOp[] = withCreate([], 'n', { title: 'Nouvelle', plannedDay: '2026-09-28' });
    ops = withUpdate(ops, 'a', { completedAt: 'x', plannedDay: null });
    ops = withDelete(ops, 'p');
    const shown = applyPendingTasks([server('a', { plannedDay: '2026-09-28', plannedTime: '09:00' }), server('p'), server('s', { parentId: 'p' })], ops);
    expect(shown.map((t) => t.id)).toEqual(['a', 'n']);
    expect(shown[0]).toMatchObject({ completedAt: 'x', plannedDay: null, plannedTime: null });
  });

  it('ne double pas une tâche que le serveur a finalement reçue', () => {
    expect(applyPendingTasks([server('n')], withCreate([], 'n', { title: 'n' }))).toHaveLength(1);
  });
});

/** Le stockage local, qui peut perdre le réseau ou refuser, à la demande. */
function flaky() {
  const inner = new LocalTaches();
  let mode: 'online' | 'offline' | 'refuse' = 'online';
  const guard = () => {
    if (mode === 'offline') throw new TypeError('Failed to fetch');
    if (mode === 'refuse') throw new Error('new row violates check constraint');
  };
  const store = {
    createTask: async (...args: Parameters<TachesStore['createTask']>) => (guard(), inner.createTask(...args)),
    updateTask: async (...args: Parameters<TachesStore['updateTask']>) => (guard(), inner.updateTask(...args)),
    deleteTask: async (id: string) => (guard(), inner.deleteTask(id)),
  } as unknown as TachesStore;
  return { store, inner, setMode: (m: typeof mode) => (mode = m) };
}

describe('taskWriter', () => {
  beforeEach(() => memory.clear());
  const box = () => createOutbox<TaskOp>('test.taches.outbox');

  it('avec du réseau, écrit directement et ne met rien en file', async () => {
    const { store, inner } = flaky();
    const writer = createTaskWriter(store, box());
    const task = await writer.createTask({ title: 'Garage' });
    expect((await inner.listTasks()).map((t) => t.id)).toEqual([task.id]);
    expect(writer.pending()).toEqual([]);
  });

  it('sans réseau, met en file ; au retour, envoie avec le même id, sans doublon', async () => {
    const { store, inner, setMode } = flaky();
    const writer = createTaskWriter(store, box());
    setMode('offline');
    const task = await writer.createTask({ title: 'Garage', plannedDay: '2026-09-28' });
    expect(task).toMatchObject({ title: 'Garage', plannedDay: '2026-09-28', completedAt: null });
    expect(await inner.listTasks()).toEqual([]);
    setMode('online');
    expect(await writer.flush()).toEqual({ sent: 1, remaining: 0, dropped: [] });
    await inner.createTask({ title: 'rejouée' }, task.id);
    expect((await inner.listTasks()).map((t) => t.id)).toEqual([task.id]);
  });

  it('cocher une tâche répétée sans réseau : au retour, la copie faite et la tâche avancée arrivent', async () => {
    const { store, inner, setMode } = flaky();
    const writer = createTaskWriter(store, box());
    const task = await writer.createTask({ title: 'Arroser', plannedDay: '2026-09-28', recurrence: { freq: 'daily', interval: 3 }, repeatFrom: 'completion' });
    setMode('offline');
    await applyCompletion(writer, completionPlan(task, [], '2026-09-28T18:00:00.000Z', '2026-09-28', 'copie'));
    expect(pendingTaskIds(writer.pending())).toEqual(new Set(['copie', task.id]));
    setMode('online');
    await writer.flush();
    const tasks = await inner.listTasks();
    expect(tasks.find((t) => t.id === 'copie')).toMatchObject({ completedAt: '2026-09-28T18:00:00.000Z', recurrence: null });
    expect(tasks.find((t) => t.id === task.id)).toMatchObject({ plannedDay: '2026-10-01', completedAt: null });
  });

  it('une sous-tâche dont la tâche attend passe par la file, même avec du réseau, dans l’ordre', async () => {
    const { store, inner, setMode } = flaky();
    const writer = createTaskWriter(store, box());
    setMode('offline');
    const parent = await writer.createTask({ title: 'Déménagement' });
    setMode('online');
    await writer.createTask({ title: 'Cartons', parentId: parent.id });
    expect(writer.pending()).toHaveLength(2);
    await writer.flush();
    expect((await inner.listTasks()).map((t) => t.title)).toEqual(['Déménagement', 'Cartons']);
  });

  it('une tâche qui attend passe par la file même avec du réseau, pour garder l’ordre', async () => {
    const { store, inner, setMode } = flaky();
    const writer = createTaskWriter(store, box());
    const task = await writer.createTask({ title: 'A' });
    setMode('offline');
    await writer.updateTask(task.id, { title: 'B' });
    setMode('online');
    await writer.updateTask(task.id, { title: 'C' });
    await writer.flush();
    expect((await inner.listTasks())[0].title).toBe('C');
  });

  it('un refus du serveur n’est pas mis en file : il remonte', async () => {
    const { store, setMode } = flaky();
    const writer = createTaskWriter(store, box());
    setMode('refuse');
    await expect(writer.createTask({ title: 'x' })).rejects.toThrow('check constraint');
    expect(writer.pending()).toEqual([]);
  });

  it('la file survit à un rechargement (nouvelle instance, même clé)', async () => {
    const { store, setMode } = flaky();
    setMode('offline');
    await createTaskWriter(store, box()).createTask({ title: 'x' });
    expect(createTaskWriter(store, box()).pending()).toHaveLength(1);
  });
});
