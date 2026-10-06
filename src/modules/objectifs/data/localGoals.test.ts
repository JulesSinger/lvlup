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
