import { beforeEach, describe, expect, it } from 'vitest';
import { createCheckinService } from './checkinService';
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

describe('le service checkins rendu par Objectifs', () => {
  beforeEach(() => memory.clear());

  it('propose les actions des objectifs en cours, sans les relevés', async () => {
    const store = new LocalGoals();
    const g = await store.createGoal({ title: 'Marathon', description: '', emoji: '🏃' }, []);
    await store.createAction(g.id, { title: 'Sortie course', pp: 20, unit: 'km' });
    await store.createAction(g.id, { title: 'Pesée', pp: 5, unit: 'kg', isMeasure: true });
    const old = await store.createGoal({ title: 'Ancien', description: '', emoji: '📦' }, []);
    await store.createAction(old.id, { title: 'Vieux', pp: 10 });
    await store.updateGoal(old.id, { archived: true });
    const choices = await createCheckinService(store).actions();
    const names = choices.map((c) => `${c.goalTitle} — ${c.actionTitle} (${c.unit})`);
    expect(names).toContain('Marathon — Sortie course (km)');
    expect(names.some((n) => n.includes('Pesée') || n.includes('Ancien'))).toBe(false);
    expect(choices[0].since).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('coche avec les PP de l’action, et retrouve ses coches par préfixe', async () => {
    const store = new LocalGoals();
    const g = await store.createGoal({ title: 'Marathon', description: '', emoji: '🏃' }, []);
    const a = await store.createAction(g.id, { title: 'Sortie course', pp: 20, unit: 'km' });
    const service = createCheckinService(store);
    await service.record({ ref: 'sport:jour:2026-10-07', actionId: a.id, day: '2026-10-07', value: 10.2, note: '1 sortie' });
    await store.addCheckin(g.id, '2026-10-06', a.id, 20);
    expect((await store.listCheckins()).find((c) => c.ref)?.pp).toBe(20);
    expect(await service.list('sport:')).toEqual([{ ref: 'sport:jour:2026-10-07', actionId: a.id, day: '2026-10-07', value: 10.2, note: '1 sortie' }]);
    await expect(service.record({ ref: 'sport:jour:x', actionId: 'inconnue', day: '2026-10-07', value: null, note: '' })).rejects.toThrow('n’existe plus');
  });
});
