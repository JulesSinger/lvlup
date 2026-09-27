import { beforeEach, describe, expect, it } from 'vitest';
import { expandEvents } from '../lib/recurrence';
import { planDelete, planEdit } from '../lib/seriesEdit';
import { applyPlan } from './applyPlan';
import { LocalCalendar } from './localCalendar';

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

describe('applyPlan — de bout en bout sur le stockage local', () => {
  let store: LocalCalendar;

  beforeEach(() => {
    memory.clear();
    store = new LocalCalendar();
  });

  async function occurrences(from: string, to: string) {
    return expandEvents(await store.listEvents(), await store.listExceptions(), from, to);
  }

  async function sport() {
    return store.createEvent({
      title: 'Sport',
      allDay: false,
      startDay: '2026-09-29',
      endDay: '2026-09-29',
      startTime: '09:00',
      endTime: '10:00',
      recurrence: { freq: 'weekly', interval: 1 },
    });
  }

  it('« cet événement » ne change que lui', async () => {
    const event = await sport();
    const [o] = await occurrences('2026-10-06', '2026-10-06');
    await applyPlan(store, planEdit(event, [], o.occurrenceDay, o, { ...o, startTime: '18:00', endTime: '19:00', recurrence: event.recurrence }, 'this'));
    const all = await occurrences('2026-09-28', '2026-10-18');
    expect(all.map((x) => x.startTime)).toEqual(['09:00', '18:00', '09:00']);
  });

  it('« les suivants » coupe la série en deux, sans trou ni doublon', async () => {
    const event = await sport();
    const [o] = await occurrences('2026-10-13', '2026-10-13');
    await applyPlan(store, planEdit(event, [], o.occurrenceDay, o, { ...o, title: 'Yoga', recurrence: event.recurrence }, 'following'));
    const all = await occurrences('2026-09-28', '2026-10-25');
    expect(all.map((x) => `${x.startDay} ${x.title}`)).toEqual([
      '2026-09-29 Sport',
      '2026-10-06 Sport',
      '2026-10-13 Yoga',
      '2026-10-20 Yoga',
    ]);
    expect(await store.listEvents()).toHaveLength(2);
  });

  it('supprimer une occurrence, puis toutes les suivantes', async () => {
    const event = await sport();
    await applyPlan(store, planDelete(event, [], '2026-10-06', 'this'));
    expect((await occurrences('2026-09-28', '2026-10-18')).map((x) => x.startDay)).toEqual(['2026-09-29', '2026-10-13']);
    const [current] = await store.listEvents();
    await applyPlan(store, planDelete(current, await store.listExceptions(), '2026-10-13', 'following'));
    expect((await occurrences('2026-09-28', '2026-12-31')).map((x) => x.startDay)).toEqual(['2026-09-29']);
  });
});
