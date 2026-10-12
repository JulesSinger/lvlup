import { describe, expect, it } from 'vitest';
import { generatePlan, planDrafts, planWeekCount, weekPhase } from './plan';
import { assignRuns, daysToRace, nextSession, planWeeks, reschedule } from './planView';
import type { Plan, PlanSession, Run } from './types';

const PLAN: Plan = {
  id: 'p',
  title: 'Marathon d’Annecy',
  raceDistanceM: 42_195,
  raceDay: '2027-04-25',
  raceDayConfirmed: false,
  targetS: null,
  referenceDistanceM: 10_000,
  referenceS: 3000,
  sessionsPerWeek: 4,
  startDay: '2026-10-14',
  status: 'actif',
  createdAt: '',
};
const OPTIONS = { reference: { distanceM: 10_000, timeS: 3000 }, currentWeeklyM: 25_000, longestRecentM: 12_000 };

let n = 0;
const sessions: PlanSession[] = planDrafts(
  'p',
  generatePlan({ ...OPTIONS, startDay: PLAN.startDay, raceDay: PLAN.raceDay, raceTitle: PLAN.title, sessionsPerWeek: 4 }),
  () => `s${n++}`,
).map((d) => ({ ...d, doneAt: null, createdAt: '' }));

let r = 0;
const run = (day: string, km: number, extra: Partial<Run> = {}): Run => ({
  id: `r${r++}`, startedAt: `${day}T07:00:00Z`, day, distanceM: km * 1000, durationS: km * 360, elevationM: null, avgHr: null, maxHr: null,
  kind: 'footing', effort: null, title: '', note: '', source: 'manuel', sourceRef: null, sessionId: null, splitsS: null, createdAt: '', ...extra,
});

const week1 = sessions.filter((s) => s.week === 1);

describe('la phase d’une semaine', () => {
  it('est la même règle que celle du générateur', () => {
    const weeks = generatePlan({ ...OPTIONS, startDay: PLAN.startDay, raceDay: PLAN.raceDay, raceTitle: PLAN.title, sessionsPerWeek: 4 });
    const total = planWeekCount(PLAN.startDay, PLAN.raceDay);
    for (const w of weeks) expect(weekPhase(w.week, total)).toEqual({ phase: w.phase, recovery: w.recovery });
  });
});

describe('rattacher les sorties aux séances', () => {
  it('une sortie de la semaine va à la séance qui lui ressemble ; une sortie hors du plan à aucune', () => {
    const longue = week1.find((s) => s.kind === 'longue')!;
    const runs = [run('2026-10-18', longue.distanceM! / 1000 + 0.3), run('2026-10-05', 12)];
    const done = assignRuns(PLAN, sessions, runs);
    expect(done.get(longue.id)?.id).toBe(runs[0].id);
    expect([...done.values()].some((x) => x.id === runs[1].id)).toBe(false);
  });

  it('un choix fait à la main l’emporte', () => {
    const footing = week1.find((s) => s.kind === 'footing')!;
    const longue = week1.find((s) => s.kind === 'longue')!;
    const runs = [run('2026-10-18', longue.distanceM! / 1000, { sessionId: footing.id })];
    const done = assignRuns(PLAN, sessions, runs);
    expect(done.get(footing.id)?.id).toBe(runs[0].id);
    expect(done.has(longue.id)).toBe(false);
  });
});

describe('le plan vu d’aujourd’hui', () => {
  // Mardi de la semaine 2.
  const today = '2026-10-20';

  it('chaque semaine dit sa phase, son volume prévu et couru, et l’état de ses séances', () => {
    const footing = week1.find((s) => s.kind === 'footing')!;
    const runs = [run('2026-10-13', footing.distanceM! / 1000), run('2026-10-19', 6)];
    const weeks = planWeeks(PLAN, sessions, runs, today);
    expect(weeks).toHaveLength(28);
    expect(weeks[0]).toMatchObject({ when: 'passee', phase: 'base', doneM: footing.distanceM });
    const states = weeks[0].sessions.map((s) => s.state);
    expect(states.filter((s) => s === 'faite')).toHaveLength(1);
    expect(states.filter((s) => s === 'manquee')).toHaveLength(3);
    expect(weeks[1].when).toBe('en-cours');
    expect(weeks[1].sessions.some((s) => s.state === 'faite')).toBe(true);
    expect(weeks[1].sessions.some((s) => s.state === 'a-faire')).toBe(true);
    expect(weeks[2].sessions.every((s) => s.state === 'a-venir')).toBe(true);
    expect(weeks[27].phase).toBe('course');
  });

  it('la séance suivante : la première pas faite de la semaine en cours, sinon de la suivante', () => {
    const weeks = planWeeks(PLAN, sessions, [], today);
    expect(nextSession(weeks)).toEqual({ session: sessions.filter((s) => s.week === 2)[0], week: 2 });
    const allDone = sessions.filter((s) => s.week === 2).map((s, i) => run(`2026-10-2${i}`, (s.distanceM ?? 8000) / 1000, { sessionId: s.id }));
    expect(nextSession(planWeeks(PLAN, sessions, allDone, today))?.week).toBe(3);
  });

  it('le compte à rebours', () => {
    expect(daysToRace(PLAN, '2027-04-18')).toBe(7);
    expect(daysToRace(PLAN, '2027-04-25')).toBe(0);
  });
});

describe('changer la date de la course', () => {
  it('garde les semaines passées, recalcule la semaine en cours et les suivantes', () => {
    const today = '2026-11-04'; // semaine 4
    let k = 0;
    const { removeIds, add } = reschedule(PLAN, sessions, { ...OPTIONS, raceDay: '2027-05-02' }, today, () => `n${k++}`);
    expect(removeIds).toEqual(sessions.filter((s) => s.week >= 4).map((s) => s.id));
    expect(Math.min(...add.map((s) => s.week))).toBe(4);
    // Une semaine de plus : la course passe en semaine 29, le dimanche 2 mai.
    const race = add.find((s) => s.kind === 'course')!;
    expect(race).toMatchObject({ week: 29, day: '2027-05-02' });
    expect(add.every((s) => s.planId === 'p')).toBe(true);
  });

  it('garde le renforcement et le vélo programmés : le générateur ne fait que de la course', () => {
    const renfo = { ...sessions.find((s) => s.week === 5)!, id: 'renfo-5', kind: 'renfo' as const, title: 'Gainage' };
    const { removeIds } = reschedule(PLAN, [...sessions, renfo], { ...OPTIONS, raceDay: '2027-05-02' }, '2026-11-04', () => 'x');
    expect(removeIds).not.toContain('renfo-5');
  });
});

describe('les séances d’à côté', () => {
  it('ne sont jamais faites par une sortie, et se cochent à la main', () => {
    const week1 = sessions.filter((s) => s.week === 1);
    const renfo = { ...week1[0], id: 'renfo-1', kind: 'renfo' as const, title: 'Gainage', distanceM: null, day: '2026-10-15' };
    const runs = [run('2026-10-15', 6)];
    const weeks = planWeeks(PLAN, [...sessions, renfo], runs, '2026-10-16');
    const line = weeks[0].sessions.find((x) => x.session.id === 'renfo-1')!;
    expect(line).toMatchObject({ state: 'a-faire', run: null });
    const ticked = planWeeks(PLAN, [...sessions, { ...renfo, doneAt: '2026-10-15T18:00:00Z' }], runs, '2026-10-16');
    expect(ticked[0].sessions.find((x) => x.session.id === 'renfo-1')!.state).toBe('faite');
    // Ni dans les kilomètres prévus : un vélo de 25 km n'en ajoute pas.
    const velo = { ...renfo, id: 'velo-1', kind: 'velo' as const, distanceM: 25_000 };
    expect(planWeeks(PLAN, [...sessions, velo], runs, '2026-10-16')[0].plannedM).toBe(weeks[0].plannedM);
  });
});
