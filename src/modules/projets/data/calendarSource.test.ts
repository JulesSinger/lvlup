import { beforeEach, describe, expect, it } from 'vitest';
import { createCalendarSource } from './calendarSource';
import { LocalProjets } from './localProjets';

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

describe('le calque de Projets, qui écrit', () => {
  let store: LocalProjets;
  beforeEach(async () => {
    memory.clear();
    store = new LocalProjets();
    await store.createClient({ name: 'Fleurs de Lou', trade: 'fleuriste' }, 'c');
    await store.createProject({ clientId: 'c', title: 'Site vitrine', status: 'production', dueDay: '2026-10-20' }, 'lou');
    await store.createWorkstream({ projectId: 'lou', title: 'Recette' }, 'w');
    await store.createTask({ projectId: 'lou', workstreamId: 'w', title: 'Menu', plannedDay: '2026-10-12' }, 't');
    await store.createPayment({ projectId: 'lou', label: 'Solde', amountCents: 63_000, expectedDay: '2026-10-20' }, 'p');
  });

  it('cocher une tâche depuis le calendrier la coche chez Projets, et recalcule les rappels', async () => {
    let after = 0;
    const source = createCalendarSource(store, async () => void after++);
    await source.toggleMark!('task:t');
    expect((await store.listTasks())[0].completedAt).not.toBeNull();
    await source.toggleMark!('task:t');
    expect((await store.listTasks())[0].completedAt).toBeNull();
    expect(after).toBe(2);
    await expect(source.toggleMark!('due:lou')).rejects.toThrow();
  });

  it('glisser à un autre jour change la date chez Projets ; sur une heure, c’est refusé', async () => {
    const source = createCalendarSource(store);
    await source.moveMark!('task:t', { day: '2026-10-14', time: null });
    await source.moveMark!('due:lou', { day: '2026-10-22', time: null });
    await source.moveMark!('pay:p', { day: '2026-10-23', time: null });
    await source.moveMark!('ws:w', { day: '2026-10-16', time: null });
    expect((await store.listTasks())[0].plannedDay).toBe('2026-10-14');
    expect((await store.listProjects())[0].dueDay).toBe('2026-10-22');
    expect((await store.listPayments())[0].expectedDay).toBe('2026-10-23');
    expect((await store.listWorkstreams())[0].dueDay).toBe('2026-10-16');
    await expect(source.moveMark!('task:t', { day: '2026-10-14', time: '09:00' })).rejects.toThrow(/journée/);
  });

  it('montre les marques de la période', async () => {
    const marks = await createCalendarSource(store).marksBetween('2026-10-01', '2026-10-31');
    expect(marks.map((m) => m.id).sort()).toEqual(['due:lou', 'pay:p', 'task:t']);
  });
});
