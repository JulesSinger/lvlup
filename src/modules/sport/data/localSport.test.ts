import { beforeEach, describe, expect, it } from 'vitest';
import type { PlanSessionDraft, RunImport } from '../lib/types';
import { LocalSport } from './localSport';

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

const run = (id: string, day: string, ref: string, km = 10): RunImport => ({
  id,
  startedAt: `${day}T07:30:00.000Z`,
  day,
  distanceM: km * 1000,
  durationS: km * 330,
  source: 'strava',
  sourceRef: ref,
});

const session = (id: string, planId: string, week: number, position = 0): PlanSessionDraft => ({
  id,
  planId,
  week,
  position,
  kind: 'footing',
  title: 'Footing',
  distanceM: 8000,
  durationS: null,
  paceMinS: 330,
  paceMaxS: 360,
  hrZone: 2,
  instructions: 'En aisance respiratoire.',
  day: null,
});

const MARATHON = {
  title: 'Marathon d’Annecy',
  raceDistanceM: 42_195,
  raceDay: '2027-04-25',
  startDay: '2026-10-12',
  sessionsPerWeek: 4,
};

describe('LocalSport', () => {
  let store: LocalSport;

  beforeEach(() => {
    memory.clear();
    store = new LocalSport();
  });

  it('crée une sortie à la main avec ses valeurs par défaut, et rejoue sans doublon', async () => {
    const input = { startedAt: '2026-10-06T18:00:00.000Z', day: '2026-10-06', distanceM: 10_200, durationS: 3480 };
    const a = await store.createRun(input, 'r-1');
    const b = await store.createRun(input, 'r-1');
    expect(a).toMatchObject({ kind: 'footing', source: 'manuel', sourceRef: null, avgHr: null, splitsS: null });
    expect(b).toEqual(a);
    expect(await store.listRuns()).toHaveLength(1);
  });

  it('importe un lot sans jamais doubler une sortie déjà connue, et compte ce qu’il ajoute', async () => {
    expect(await store.importRuns([run('a', '2026-09-01', 'strava:1'), run('b', '2026-09-03', 'strava:2')])).toBe(2);
    // L'archive reprise une seconde fois, avec une sortie de plus.
    expect(
      await store.importRuns([run('a2', '2026-09-01', 'strava:1'), run('c', '2026-09-05', 'strava:3'), run('c2', '2026-09-05', 'strava:3')]),
    ).toBe(1);
    expect((await store.listRuns()).map((r) => r.sourceRef)).toEqual(['strava:1', 'strava:2', 'strava:3']);
  });

  it('range les sorties par heure de départ', async () => {
    await store.importRuns([run('b', '2026-09-03', 'x:2'), run('a', '2026-09-01', 'x:1')]);
    expect((await store.listRuns()).map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('crée un plan sur une date provisoire, et refuse un plan qui commence après la course', async () => {
    const plan = await store.createPlan(MARATHON, 'p-1');
    expect(plan).toMatchObject({ raceDayConfirmed: false, status: 'actif', sessionsPerWeek: 4, referenceS: null });
    await expect(store.createPlan({ ...MARATHON, startDay: '2027-05-01' }, 'p-2')).rejects.toThrow();
    await expect(store.updatePlan('p-1', { raceDay: '2026-10-01' })).rejects.toThrow();
  });

  it('pose les séances d’un plan d’un bloc, rejouable, triées par semaine', async () => {
    await store.createPlan(MARATHON, 'p-1');
    const drafts = [session('s-2', 'p-1', 2), session('s-1', 'p-1', 1, 1), session('s-0', 'p-1', 1, 0)];
    await store.addSessions(drafts);
    await store.addSessions(drafts);
    expect((await store.listSessions()).map((s) => s.id)).toEqual(['s-0', 's-1', 's-2']);
    await expect(store.addSessions([session('s-9', 'inconnu', 1)])).rejects.toThrow('Plan introuvable');
  });

  it('supprimer un plan emporte ses séances et détache les sorties qui les avaient faites', async () => {
    await store.createPlan(MARATHON, 'p-1');
    await store.addSessions([session('s-1', 'p-1', 1)]);
    await store.createRun({ startedAt: '2026-10-13T07:00:00Z', day: '2026-10-13', distanceM: 8000, durationS: 2700, sessionId: 's-1' }, 'r-1');
    await store.deletePlan('p-1');
    expect(await store.listSessions()).toEqual([]);
    expect((await store.listRuns())[0].sessionId).toBeNull();
  });

  it('refuse de rattacher une sortie à une séance inconnue', async () => {
    await expect(
      store.createRun({ startedAt: '2026-10-13T07:00:00Z', day: '2026-10-13', distanceM: 8000, durationS: 2700, sessionId: 'nulle-part' }),
    ).rejects.toThrow('Séance introuvable');
  });

  it('garde les réglages de fréquence cardiaque, et refuse un repos au-dessus du maximum', async () => {
    expect(await store.getSettings()).toEqual({ hrMax: null, hrRest: null, objectifsActionId: null });
    await store.updateSettings({ hrMax: 192, hrRest: 52 });
    expect(await store.getSettings()).toMatchObject({ hrMax: 192, hrRest: 52 });
    await expect(store.updateSettings({ hrRest: 195 })).rejects.toThrow();
  });

  it('ne rend jamais l’empreinte d’un jeton, et refuse ce qui n’en est pas une', async () => {
    const hash = 'a'.repeat(64);
    const token = await store.createToken(hash, 'iPhone', 't-1');
    expect(token).toEqual({ id: 't-1', label: 'iPhone', createdAt: token.createdAt, lastUsedAt: null });
    expect(JSON.stringify(await store.listTokens())).not.toContain(hash);
    await expect(store.createToken('pas-une-empreinte', 'x')).rejects.toThrow();
    await store.deleteToken('t-1');
    expect(await store.listTokens()).toEqual([]);
  });

  it('exporte et restaure sorties, plans, séances et réglages, sans les jetons', async () => {
    await store.createPlan(MARATHON, 'p-1');
    await store.addSessions([session('s-1', 'p-1', 1)]);
    await store.importRuns([run('a', '2026-09-01', 'strava:1')]);
    await store.updateSettings({ hrMax: 190 });
    await store.createToken('b'.repeat(64), 'iPhone', 't-1');
    const backup = await store.exportData();
    expect(backup).not.toHaveProperty('tokens');
    memory.clear();
    await store.importData(backup);
    expect(await store.listRuns()).toHaveLength(1);
    expect(await store.listSessions()).toHaveLength(1);
    expect((await store.getSettings()).hrMax).toBe(190);
  });
});
