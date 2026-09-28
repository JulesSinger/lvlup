import { beforeEach, describe, expect, it } from 'vitest';
import { dayString } from '../../../core/lib/day';
import { createCalendarSource } from './calendarSource';
import { LocalTaches } from './localTaches';

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

describe('le calque de Polaris — cocher depuis le calendrier', () => {
  let store: LocalTaches;
  beforeEach(() => {
    memory.clear();
    store = new LocalTaches();
  });

  it('cocher puis décocher une tâche simple', async () => {
    const today = dayString();
    const task = await store.createTask({ title: 'Garage', plannedDay: today }, 'g');
    const source = createCalendarSource(store);
    await source.toggleMark!('task:g');
    expect((await source.marksBetween(today, today))[0]).toMatchObject({ id: 'task:g', done: true });
    await source.toggleMark!('task:g');
    expect((await store.listTasks()).find((t) => t.id === task.id)?.completedAt).toBeNull();
  });

  it('une tâche répétée cochée dans le calendrier avance, comme dans Polaris, et prévient ensuite', async () => {
    const today = dayString();
    await store.createTask({ title: 'Arroser', plannedDay: today, recurrence: { freq: 'daily', interval: 3 }, repeatFrom: 'completion' }, 'a');
    let after = 0;
    await createCalendarSource(store, async () => void (after += 1)).toggleMark!('task:a');
    const tasks = await store.listTasks();
    expect(tasks.find((t) => t.id === 'a')?.completedAt).toBeNull();
    expect(tasks.find((t) => t.id === 'a')?.plannedDay).not.toBe(today);
    expect(tasks.filter((t) => t.completedAt)).toHaveLength(1);
    expect(after).toBe(1);
  });

  it('une tâche disparue entre-temps le dit', async () => {
    await expect(createCalendarSource(store).toggleMark!('task:perdue')).rejects.toThrow(/n’existe plus/);
  });

  it('glisser une tâche la reprévoit : jour, heure, durée si on l’a étirée ; la bande « Journée » retire l’heure', async () => {
    const today = dayString();
    await store.createTask({ title: 'Réunion', plannedDay: today, plannedTime: '14:00', durationMinutes: 60 }, 'r');
    const source = createCalendarSource(store);
    await source.moveMark!('task:r', { day: '2030-01-02', time: '16:00' });
    expect((await store.listTasks())[0]).toMatchObject({ plannedDay: '2030-01-02', plannedTime: '16:00', durationMinutes: 60 });
    await source.moveMark!('task:r', { day: '2030-01-02', time: '16:00', duration: 90 });
    expect((await store.listTasks())[0].durationMinutes).toBe(90);
    await source.moveMark!('task:r', { day: '2030-01-03', time: null });
    expect((await store.listTasks())[0]).toMatchObject({ plannedDay: '2030-01-03', plannedTime: null, durationMinutes: null });
  });

  it('un geste que Polaris refuse est rejeté, avec son message', async () => {
    await store.createTask({ title: 'Réunion', plannedDay: dayString(), plannedTime: '14:00' }, 'r');
    await expect(createCalendarSource(store).moveMark!('task:r', { day: '2030-01-02', time: '16:00', duration: 2 })).rejects.toThrow(/5 minutes/);
  });
});
