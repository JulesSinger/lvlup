import { beforeEach, describe, expect, it } from 'vitest';
import { LocalGoals } from './localGoals';

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

const goal = (title: string) => ({ title, description: '', emoji: '🎯' });

describe('LocalGoals — l’ordre des objectifs', () => {
  let store: LocalGoals;

  beforeEach(() => {
    memory.clear();
    store = new LocalGoals();
  });

  it('range les objectifs selon les positions écrites, et s’en souvient', async () => {
    const a = await store.createGoal(goal('A'), []);
    const b = await store.createGoal(goal('B'), []);
    const c = await store.createGoal(goal('C'), []);
    await store.reorderGoals([
      { id: c.id, position: 0 },
      { id: a.id, position: 1 },
      { id: b.id, position: 2 },
    ]);
    expect((await store.listGoals()).map((g) => g.title)).toEqual(['C', 'A', 'B']);
    expect((await new LocalGoals().listGoals()).map((g) => g.title)).toEqual(['C', 'A', 'B']);
  });

  it('ignore un objectif inconnu sans rien casser', async () => {
    const a = await store.createGoal(goal('A'), []);
    await store.reorderGoals([{ id: 'absent', position: 0 }]);
    expect((await store.listGoals()).map((g) => g.id)).toEqual([a.id]);
  });
});

describe('LocalGoals — les coches tenues par un autre module (Sport)', () => {
  let store: LocalGoals;

  beforeEach(() => {
    memory.clear();
    store = new LocalGoals();
  });

  it('une coche par référence : posée, mise à jour, retirée', async () => {
    const g = await store.createGoal(goal('Marathon'), []);
    const a = await store.createAction(g.id, { title: 'Sortie course', pp: 20, unit: 'km' });
    const input = { ref: 'sport:jour:2026-10-07', goalId: g.id, actionId: a.id, day: '2026-10-07', pp: 20, value: 10.2, note: '1 sortie' };
    expect(await store.saveRefCheckin(input)).toBe('recorded');
    expect(await store.saveRefCheckin({ ...input, value: 18.4, note: '2 sorties' })).toBe('recorded');
    const all = await store.listCheckins();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ ref: 'sport:jour:2026-10-07', value: 18.4, note: '2 sorties', pp: 20 });
    await store.deleteRefCheckin('sport:jour:2026-10-07');
    expect(await store.listCheckins()).toEqual([]);
  });

  it('ne réécrit jamais une coche faite à la main', async () => {
    const g = await store.createGoal(goal('Marathon'), []);
    const a = await store.createAction(g.id, { title: 'Sortie course', pp: 20, unit: 'km' });
    await store.addCheckin(g.id, '2026-10-07', a.id, 20, 8);
    const r = await store.saveRefCheckin({ ref: 'sport:jour:2026-10-07', goalId: g.id, actionId: a.id, day: '2026-10-07', pp: 20, value: 10.2, note: '' });
    expect(r).toBe('taken');
    const all = await store.listCheckins();
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ value: 8 });
    expect(all[0].ref ?? null).toBeNull();
  });
});
