import { describe, expect, it } from 'vitest';
import * as server from '../../../../supabase/functions/atlas-mcp/sport.ts';
import { sportTools, type PlanRow, type RunRow, type SessionRow, type SportData } from '../../../../supabase/functions/atlas-mcp/sport.ts';
import { formatPace } from './format';
import { paceOf } from './pace';
import { mondayOfWeek, planWeekCount, weekOfPlan } from './plan';
import * as types from './types';
import { hrZones } from './zones';

describe('les règles de Sport recopiées dans le connecteur', () => {
  it('sont celles du module', () => {
    expect(server.SESSION_KINDS).toEqual(types.SESSION_KINDS);
    expect(server.RUNNING_SESSION_KINDS).toEqual(types.RUNNING_SESSION_KINDS);
    expect(server.CROSS_SESSION_KINDS).toEqual(types.CROSS_SESSION_KINDS);
    expect(server.RUN_KINDS).toEqual(types.RUN_KINDS);
    expect(server.PLAN_STATUSES).toEqual(types.PLAN_STATUSES);
    expect([server.PLAN_TITLE_MAX, server.RUN_TITLE_MAX, server.RUN_NOTE_MAX, server.SESSIONS_PER_WEEK_MIN, server.SESSIONS_PER_WEEK_MAX, server.MARATHON_M]).toEqual([
      types.PLAN_TITLE_MAX,
      types.RUN_TITLE_MAX,
      types.RUN_NOTE_MAX,
      types.SESSIONS_PER_WEEK_MIN,
      types.SESSIONS_PER_WEEK_MAX,
      types.MARATHON_M,
    ]);
    for (const [start, day] of [['2026-10-09', '2026-10-09'], ['2026-10-09', '2026-10-12'], ['2026-10-12', '2027-04-25'], ['2026-03-29', '2026-10-25'], ['2026-10-09', '2026-10-04']]) {
      expect(server.weekOfPlan(start, day)).toBe(weekOfPlan(start, day));
      expect(server.planWeekCount(start, day >= start ? day : start)).toBe(planWeekCount(start, day >= start ? day : start));
    }
    for (const w of [1, 2, 29]) expect(server.mondayOfWeek('2026-10-09', w)).toBe(mondayOfWeek('2026-10-09', w));
    for (const [d, s] of [[10_000, 3_000], [21_097, 6_531], [50, 10]]) expect(server.paceOf(d, s)).toBe(paceOf(d, s));
    for (const p of [300, 305, 359, 601]) expect(`${server.formatPace(p)}`).toBe(formatPace(p).replace(/\s*\/km$/, ''));
    expect(server.hrZones(190, 55)).toEqual(hrZones({ hrMax: 190, hrRest: 55 }));
    expect(server.hrZones(190, null)).toEqual(hrZones({ hrMax: 190, hrRest: null }));
  });

  it('lit les allures et les durées comme un coach les écrit', () => {
    expect(server.readPace('5:30', 'allure')).toBe(330);
    expect(server.readPace('4’55', 'allure')).toBe(295);
    expect(() => server.readPace('5.30', 'allure')).toThrow(/5:30/);
    expect(server.readDuration(45, 'durée', 60, 9999)).toBe(2700);
    expect(server.readDuration('1:05:00', 'durée', 60, 9999)).toBe(3900);
    expect(server.readDuration('52:30', 'durée', 60, 9999)).toBe(3150);
    expect(server.parisOffsetMinutes('2026-07-01')).toBe(120);
    expect(server.parisOffsetMinutes('2026-12-01')).toBe(60);
  });
});

/** Une base en mémoire, du seul compte du jeton. */
function memory() {
  let n = 0;
  const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
  const db = { plans: [] as PlanRow[], sessions: [] as SessionRow[], runs: [] as RunRow[], settings: null as { hr_max: number | null; hr_rest: number | null } | null };
  const data: SportData = {
    listPlans: async () => db.plans,
    insertPlan: async (row) => {
      const plan = { id: uuid(), status: 'actif', created_at: `2026-10-11T00:00:0${db.plans.length}Z`, target_s: null, race_day_confirmed: false, sessions_per_week: 3, ...row } as PlanRow;
      db.plans.push(plan);
      return plan;
    },
    updatePlan: async (id, row) => {
      const p = db.plans.find((x) => x.id === id);
      return p ? Object.assign(p, row) : null;
    },
    listSessions: async (planId) => db.sessions.filter((s) => s.plan_id === planId),
    insertSessions: async (rows) => {
      const created = rows.map((r) => ({ id: uuid(), position: 0, done_at: null, ...r }) as SessionRow);
      db.sessions.push(...created);
      return created;
    },
    updateSession: async (id, row) => {
      const s = db.sessions.find((x) => x.id === id);
      return s ? Object.assign(s, row) : null;
    },
    deleteSessions: async (ids) => {
      const before = db.sessions.length;
      db.sessions = db.sessions.filter((s) => !ids.includes(s.id));
      return before - db.sessions.length;
    },
    listRuns: async (from, to) => db.runs.filter((r) => r.day >= from && r.day <= to),
    listActivities: async () => [],
    unlinkActivities: async () => {},
    getRun: async (id) => db.runs.find((r) => r.id === id) ?? null,
    insertRun: async (row) => {
      const r = { id: uuid(), kind: 'footing', effort: null, title: '', note: '', session_id: null, splits_s: null, elevation_m: null, avg_hr: null, max_hr: null, ...row } as RunRow;
      db.runs.push(r);
      return r;
    },
    updateRun: async (id, row) => {
      const r = db.runs.find((x) => x.id === id);
      return r ? Object.assign(r, row) : null;
    },
    deleteRun: async (id) => {
      const before = db.runs.length;
      db.runs = db.runs.filter((r) => r.id !== id);
      return db.runs.length < before;
    },
    getSettings: async () => db.settings,
    saveSettings: async (row) => {
      db.settings = row as typeof db.settings;
    },
  };
  return { db, data };
}

async function use(data: SportData, name: string, args: Record<string, unknown> = {}) {
  const tool = sportTools.find((t) => t.name === name);
  if (!tool) throw new Error(`outil ${name}`);
  try {
    const result = await tool.run(args, { data, today: '2026-10-11' });
    let value = null;
    try {
      value = JSON.parse(result.text);
    } catch {
      // un simple texte
    }
    return { error: false, text: result.text, value };
  } catch (err) {
    return { error: true, text: (err as Error).message, value: null };
  }
}

const COACH_WEEK = [
  { day: '2026-10-13', kind: 'footing', title: 'Footing en aisance', distance_km: 8, pace_min: '5:50', pace_max: '6:15', hr_zone: 2 },
  { day: '2026-10-15', kind: 'fractionne', title: '6 × 1 000 m', duration: 55, pace_min: '4:35', pace_max: '4:45', instructions: '20 min échauffement, 6 × 1 000 m récup 2 min trot, 10 min retour au calme.' },
  { day: '2026-10-18', kind: 'longue', title: 'Sortie longue 18 km', distance_km: 18, pace_min: '5:45', pace_max: '6:10' },
];

describe('les outils de Sport pour Claude, en coach', () => {
  it('créent le plan, puis programment une semaine en remplaçant la précédente', async () => {
    const { db, data } = memory();
    expect((await use(data, 'sport_semaine_programmer', { week_of: '2026-10-13', sessions: COACH_WEEK })).text).toMatch(/Aucun plan/);
    const created = await use(data, 'sport_plan_creer', { title: 'Marathon d’Annecy', race_day: '2027-04-25', target: '3:45:00' });
    expect(created.value.message).toMatch(/29 semaines/);
    expect(db.plans[0]).toMatchObject({ race_distance_m: 42_195, target_s: 13_500, start_day: '2026-10-11', sessions_per_week: 4 });
    expect((await use(data, 'sport_plan_creer', { title: 'Autre', race_day: '2027-05-01' })).text).toMatch(/déjà en cours/);

    // La semaine du 12 octobre est la semaine 2 du plan (commencé un dimanche, semaine 1 = celle du 5).
    const first = await use(data, 'sport_semaine_programmer', { week_of: '2026-10-12', sessions: COACH_WEEK });
    expect(first.value.message).toMatch(/Semaine 2 .* 3 séances/);
    expect(first.value.sessions.map((s: { day: string; pace: string | null }) => [s.day, s.pace])).toEqual([
      ['2026-10-13', '5:50–6:15 /km'],
      ['2026-10-15', '4:35–4:45 /km'],
      ['2026-10-18', '5:45–6:10 /km'],
    ]);
    expect(db.sessions.find((s) => s.kind === 'fractionne')).toMatchObject({ week: 2, duration_s: 3300, pace_min_s: 275, pace_max_s: 285, position: 1 });

    // Le coach revoit la semaine : elle remplace la précédente, les autres semaines ne bougent pas.
    await use(data, 'sport_seance_ajouter', { day: '2026-10-20', kind: 'footing', title: 'Footing semaine 3' });
    const again = await use(data, 'sport_semaine_programmer', { week_of: '2026-10-15', sessions: [COACH_WEEK[0], COACH_WEEK[2]] });
    expect(again.value.message).toMatch(/2 séances programmées, à la place de 3/);
    expect(db.sessions.filter((s) => s.week === 2)).toHaveLength(2);
    expect(db.sessions.filter((s) => s.week === 3)).toHaveLength(1);

    const resume = (await use(data, 'sport_resume')).value;
    expect(resume.plan).toMatchObject({ current_week: 1, total_weeks: 29, target_pace: '5:20 /km' });
    expect(resume.plan.next_week).toHaveLength(2);
  });

  it('programment aussi le renforcement et le vélo, cochés à la main', async () => {
    const { db, data } = memory();
    await use(data, 'sport_plan_creer', { title: 'Marathon', race_day: '2027-04-25' });
    const week = await use(data, 'sport_semaine_programmer', {
      week_of: '2026-10-12',
      sessions: [
        COACH_WEEK[0],
        { day: '2026-10-14', kind: 'renfo', title: 'Gainage et squats', duration: 30, distance_km: 5, pace_min: '5:00', instructions: '3 × (1 min gainage, 15 squats, 10 fentes)' },
        { day: '2026-10-16', kind: 'velo', title: 'Vélo en aisance', duration: '1:00:00', distance_km: 25 },
      ],
    });
    expect(week.value.message).toMatch(/3 séances programmées/);
    const renfo = db.sessions.find((s) => s.kind === 'renfo')!;
    // Ni distance ni allure de course pour un renforcement, pas d'allure pour le vélo.
    expect(renfo).toMatchObject({ duration_s: 1800, distance_m: null, pace_min_s: null, instructions: '3 × (1 min gainage, 15 squats, 10 fentes)' });
    expect(db.sessions.find((s) => s.kind === 'velo')).toMatchObject({ duration_s: 3600, distance_m: 25_000 });
    expect(week.value.sessions[1]).toMatchObject({ kind: 'renfo', done: false });

    expect((await use(data, 'sport_seance_cocher', { id: renfo.id })).value.session.done).toBe(true);
    expect(renfo.done_at).not.toBeNull();
    expect((await use(data, 'sport_seance_cocher', { id: renfo.id, done: false })).value.session.done).toBe(false);
    const footing = db.sessions.find((s) => s.kind === 'footing')!;
    expect((await use(data, 'sport_seance_cocher', { id: footing.id })).text).toMatch(/faite par une sortie/);
  });

  it('ajoutent une séance d’escalade, sans distance, cochée à la main', async () => {
    const { db, data } = memory();
    await use(data, 'sport_plan_creer', { title: 'Marathon', race_day: '2027-04-25' });
    const added = await use(data, 'sport_seance_ajouter', { day: '2026-10-18', kind: 'escalade', title: 'Escalade en salle', duration: '1:30:00', distance_km: 3, pace_min: '5:00', instructions: 'Blocs, puis voies' });
    expect(added.value.session).toMatchObject({ kind: 'escalade', done: false });
    const climb = db.sessions.find((s) => s.kind === 'escalade')!;
    expect(climb).toMatchObject({ day: '2026-10-18', duration_s: 5400, distance_m: null, pace_min_s: null });
    expect((await use(data, 'sport_seance_cocher', { id: climb.id })).value.session.done).toBe(true);
  });

  it('refusent une semaine mal faite, sans rien écrire', async () => {
    const { db, data } = memory();
    await use(data, 'sport_plan_creer', { title: 'Marathon', race_day: '2027-04-25' });
    const bad = (sessions: unknown[]) => use(data, 'sport_semaine_programmer', { week_of: '2026-10-12', sessions });
    expect((await bad([{ day: '2026-10-20', kind: 'footing', title: 'A' }])).text).toMatch(/pas dans la semaine/);
    expect((await bad([{ day: '2026-10-13', kind: 'yoga', title: 'Yoga' }])).text).toMatch(/la sorte est l’une de/);
    expect((await bad([{ day: '2026-10-13', kind: 'seuil', title: 'Seuil', pace_min: '5:00', pace_max: '4:30' }])).text).toMatch(/la plus RAPIDE/);
    expect((await bad([{ day: '13/10', kind: 'footing', title: 'A' }])).text).toMatch(/AAAA-MM-JJ/);
    expect((await use(data, 'sport_semaine_programmer', { week_of: '2027-06-01', sessions: COACH_WEEK })).text).toMatch(/hors du plan/);
    expect(db.sessions).toHaveLength(0);
  });

  it('modifient et suppriment une séance, et changent le plan', async () => {
    const { db, data } = memory();
    await use(data, 'sport_plan_creer', { title: 'Marathon', race_day: '2027-04-25' });
    await use(data, 'sport_semaine_programmer', { week_of: '2026-10-12', sessions: COACH_WEEK });
    const long = db.sessions.find((s) => s.kind === 'longue')!;
    const moved = await use(data, 'sport_seance_modifier', { id: long.id, day: '2026-10-19', distance_km: 20 });
    expect(moved.value.session).toMatchObject({ week: 3, day: '2026-10-19', distance_km: 20, pace: '5:45–6:10 /km', title: 'Sortie longue 18 km' });
    expect((await use(data, 'sport_seance_supprimer', { ids: [long.id] })).text).toMatch(/1 séance retirée/);
    await use(data, 'sport_plan_modifier', { race_day_confirmed: true, target: '3:40:00' });
    expect(db.plans[0]).toMatchObject({ race_day_confirmed: true, target_s: 13_200 });
  });

  it('notent, corrigent et lisent les sorties, et règlent la FC', async () => {
    const { db, data } = memory();
    const added = await use(data, 'sport_sortie_ajouter', { day: '2026-10-10', start_time: '18:30', distance_km: 10.2, duration: '52:30', avg_hr: 152, effort: 6, note: 'Jambes lourdes' });
    expect(added.value.run).toMatchObject({ distance_km: 10.2, pace: '5:09 /km', effort: 6 });
    expect(db.runs[0].started_at).toBe('2026-10-10T16:30:00.000Z'); // 18 h 30 à Paris, heure d'été
    expect((await use(data, 'sport_sortie_modifier', { id: db.runs[0].id, kind: 'seuil' })).value.run.kind).toBe('seuil');
    expect((await use(data, 'sport_sorties_lister')).value).toMatchObject({ count: 1, km: 10.2 });
    expect((await use(data, 'sport_reglages', { hr_max: 190, hr_rest: 55 })).value.zones[1]).toEqual({ zone: 2, min: 136, max: 149 });
    expect((await use(data, 'sport_reglages', { hr_max: 105, hr_rest: 110 })).text).toMatch(/sous la FC max/);
    await use(data, 'sport_sortie_supprimer', { id: db.runs[0].id });
    expect(db.runs).toHaveLength(0);
  });

  it('disent à Claude ce qui détruit', () => {
    const hints = Object.fromEntries(sportTools.map((t) => [t.name, t.annotations]));
    expect(hints.sport_resume.readOnlyHint).toBe(true);
    expect(hints.sport_seance_supprimer.destructiveHint).toBe(true);
    expect(hints.sport_sortie_supprimer.destructiveHint).toBe(true);
  });
});
