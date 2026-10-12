import { describe, expect, it } from 'vitest';
import * as server from '../../../../supabase/functions/atlas-mcp/objectifs.ts';
import { objectifsTools, type ObjectifsData } from '../../../../supabase/functions/atlas-mcp/objectifs.ts';
import { tierProgress } from './counters';
import { goalProgress } from './progress';
import { RANKS } from './ranks';
import * as types from './types';
import type { Action, Checkin, Goal, Tier } from './types';

// Les outils d'Objectifs du connecteur (docs/connecteur-claude.md §14) : la fonction recopie le
// comptage des paliers — comparé ici à celui du module, sorte par sorte.

let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
const G = uuid();

const tier = (extra: Partial<Tier>): Tier => ({
  id: uuid(),
  goalId: G,
  title: 'Palier',
  rank: 'bronze',
  position: 0,
  completedAt: null,
  createdAt: '',
  kind: 'compte',
  target: 3,
  unit: 'jours',
  direction: 'hausse',
  mode: 'absolu',
  sources: [],
  ...extra,
});
const action = (extra: Partial<Action>): Action => ({
  id: uuid(),
  goalId: G,
  title: 'Lire',
  pp: 10,
  position: 0,
  archived: false,
  createdAt: '',
  unit: 'pages',
  defaultValue: 20,
  isMeasure: false,
  ...extra,
});
const lire = action({});
const peser = action({ title: 'Me peser', unit: 'kg', defaultValue: null, isMeasure: true, pp: 5 });
const checkin = (a: Action | null, day: string, value: number | null = null, title: string | null = null): Checkin => ({
  id: uuid(),
  goalId: G,
  actionId: a?.id ?? null,
  pp: a?.pp ?? 10,
  day,
  note: '',
  createdAt: `${day}T08:00:00Z`,
  value,
  title,
});

const tiers = [
  tier({ kind: 'compte', target: 3 }),
  tier({ kind: 'cumul', target: 100, unit: 'pages' }),
  tier({ kind: 'serie', target: 3 }),
  tier({ kind: 'performance', target: 50, unit: 'pages' }),
  tier({ kind: 'performance', target: 30, direction: 'baisse' }),
  tier({ kind: 'mesure', target: -2, mode: 'delta', direction: 'baisse', unit: 'kg' }),
  tier({ kind: 'mesure', target: 80, direction: 'baisse', unit: 'kg' }),
  tier({ kind: 'jalon', target: null }),
  tier({ kind: 'cumul', target: 10, sources: [peser.id] }),
];
const checkins = [
  checkin(lire, '2026-10-08'),
  checkin(lire, '2026-10-10', 55),
  checkin(lire, '2026-10-11', 15),
  checkin(lire, '2026-10-12'),
  checkin(null, '2026-10-12', 30, 'Un tuto'),
  checkin(peser, '2026-10-01', 82),
  checkin(peser, '2026-10-12', 79.5),
];

describe('connecteur — Objectifs : le comptage suit le module', () => {
  it('reprend les bornes', () => {
    expect(server.TIER_KINDS).toEqual(types.TIER_KINDS);
    expect(server.ONE_OFF_PP).toBe(types.ONE_OFF_PP);
    expect(server.RANKS.map((r) => [r.id, r.label, r.value])).toEqual(RANKS.map((r) => [r.id, r.label, r.value]));
  });

  it('compte chaque sorte de palier pareil', () => {
    for (const t of tiers)
      for (const today of ['2026-10-09', '2026-10-12', '2026-10-15']) {
        expect(server.tierProgress(t, [lire, peser], checkins, today)).toEqual(tierProgress(t, [lire, peser], checkins, today));
      }
  });

  it('donne le rang du palier validé le plus haut', () => {
    const goal: Goal = {
      id: G,
      title: 'Lire',
      description: '',
      emoji: '📚',
      position: 0,
      archived: false,
      createdAt: '',
      tiers: [tier({ rank: 'or', completedAt: '2026-10-01' }), tier({ rank: 'argent', completedAt: '2026-10-05' }), tier({ rank: 'platine' })],
    };
    expect(server.goalRank(goal)).toBe(goalProgress(goal).rank?.label);
  });
});

function memory() {
  const goals: server.Goal[] = [
    {
      id: G,
      title: 'Lire plus',
      emoji: '📚',
      archived: false,
      createdAt: '',
      tiers: [tier({ title: '100 pages', kind: 'cumul', target: 100, unit: 'pages', rank: 'fer', position: 0 }), tier({ title: '500 pages', kind: 'cumul', target: 500, rank: 'bronze', position: 1 })],
    },
    { id: uuid(), title: 'Anglais', emoji: '🇬🇧', archived: false, createdAt: '', tiers: [] },
  ];
  const duo = action({ title: 'Duolingo', goalId: goals[1].id, unit: '', defaultValue: null });
  const actions: server.Action[] = [lire, peser, duo];
  const rows: server.Checkin[] = [checkin(lire, '2026-10-10', 60)];
  const data: ObjectifsData = {
    listGoals: async () => goals,
    listActions: async () => actions,
    listCheckins: async () => rows.map((c) => ({ ...c })),
    insertCheckin: async (r) => {
      const c = { id: uuid(), goalId: r.goal_id, actionId: r.action_id, pp: r.pp, day: r.day, note: r.note ?? '', createdAt: '', value: r.value ?? null, title: r.title ?? null } as server.Checkin;
      rows.push(c);
      return c;
    },
    updateCheckin: async (id, r) => {
      Object.assign(rows.find((c) => c.id === id)!, r);
    },
    deleteCheckin: async (id) => {
      rows.splice(
        rows.findIndex((c) => c.id === id),
        1,
      );
    },
  };
  const call = async (name: string, args: Record<string, unknown>) => {
    const result = await objectifsTools.find((t) => t.name === name)!.run(args, { data, today: '2026-10-12' });
    try {
      return JSON.parse(result.text);
    } catch {
      return { text: result.text };
    }
  };
  return { rows, call, duo };
}

describe('connecteur — Objectifs : les outils', () => {
  it('coche avec une quantité et dit qu’un palier est atteint', async () => {
    const m = memory();
    const res = await m.call('objectifs_cocher', { action: 'lire', value: 45, note: 'Dune' });
    expect(res.message).toBe('« Lire » cochée le 2026-10-12 (45 pages), +10 PP.');
    expect(res.reached).toMatch(/100 pages \(Fer\).*prochaine ouverture/);
    expect(m.rows.at(-1)).toMatchObject({ value: 45, pp: 10, note: 'Dune' });
    const again = await m.call('objectifs_cocher', { action: 'Lire', value: 50 });
    expect(again.message).toMatch(/quantité mise à jour/);
    expect(m.rows.filter((c) => c.day === '2026-10-12')).toHaveLength(1);
  });

  it('exige un relevé pour une mesure, refuse un jour à venir', async () => {
    const m = memory();
    await expect(m.call('objectifs_cocher', { action: 'me peser' })).rejects.toThrow(/relevé/);
    await expect(m.call('objectifs_cocher', { action: 'lire', day: '2026-10-13' })).rejects.toThrow(/à venir/);
    await expect(m.call('objectifs_cocher', { action: 'nager' })).rejects.toThrow(/Aucune action/);
  });

  it('ne touche jamais une coche tenue par Sport', async () => {
    const m = memory();
    m.rows.push({ ...checkin(lire, '2026-10-12', 12), ref: 'sport:jour:2026-10-12' });
    await expect(m.call('objectifs_cocher', { action: 'Lire', value: 3 })).rejects.toThrow(/Sport/);
    await expect(m.call('objectifs_decocher', { action: 'Lire' })).rejects.toThrow(/Sport/);
  });

  it('défait une coche, note et retire un geste', async () => {
    const m = memory();
    await m.call('objectifs_cocher', { action: 'Duolingo' });
    expect((await m.call('objectifs_decocher', { action: 'duolingo' })).text).toMatch(/retirée \(−10 PP\)/);
    const geste = await m.call('objectifs_geste', { goal: 'anglais', title: 'Un podcast' });
    expect(m.rows.at(-1)).toMatchObject({ actionId: null, title: 'Un podcast', pp: 10 });
    const resume = await m.call('objectifs_resume', {});
    expect(resume.goals[1].one_offs_today).toEqual([{ id: geste.id, title: 'Un podcast' }]);
    await m.call('objectifs_geste_retirer', { id: geste.id });
    expect(m.rows.some((c) => c.title === 'Un podcast')).toBe(false);
  });

  it('résume les objectifs et l’historique', async () => {
    const m = memory();
    await m.call('objectifs_cocher', { action: 'Lire', value: 10 });
    const resume = await m.call('objectifs_resume', {});
    expect(resume.goals[0]).toMatchObject({
      title: '📚 Lire plus',
      rank: 'non classé',
      next_tier: { title: '100 pages', progress: { current: 70, target: 100, percent: 70, reached: false } },
    });
    expect(resume.goals[0].actions.find((a: { title: string }) => a.title === 'Lire').done).toBe('10 pages');
    const hist = await m.call('objectifs_historique', { goal: 'Lire plus' });
    expect(hist.totals).toEqual([{ action: 'Lire', goal: 'Lire plus', times: 2, amount: '70 pages' }]);
  });
});
