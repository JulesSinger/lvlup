import { describe, expect, it } from 'vitest';
import type { RecordedCheckin } from '../../../core/lib/services';
import { markTarget, sessionMoveError, sportMarks } from './calendarMarks';
import { CHECKIN_PREFIX, dayValue, desiredCheckins, linkPlan } from './objectifsLink';
import { generatePlan, planDrafts } from './plan';
import { plannedReminders } from './reminders';
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
let n = 0;
const sessions: PlanSession[] = planDrafts(
  'p',
  generatePlan({ reference: { distanceM: 10_000, timeS: 3000 }, currentWeeklyM: 25_000, longestRecentM: 12_000, startDay: PLAN.startDay, raceDay: PLAN.raceDay, raceTitle: PLAN.title, sessionsPerWeek: 4 }),
  () => `s${n++}`,
).map((d) => ({ ...d, createdAt: '' }));

let r = 0;
const run = (day: string, km: number, minutes: number, extra: Partial<Run> = {}): Run => ({
  id: `r${r++}`, startedAt: new Date(`${day}T18:30:00`).toISOString(), day, distanceM: km * 1000, durationS: minutes * 60, elevationM: null, avgHr: 150, maxHr: null,
  kind: 'footing', effort: null, title: '', note: '', source: 'manuel', sourceRef: null, sessionId: null, splitsS: null, createdAt: '', ...extra,
});

describe('le lien avec Objectifs', () => {
  const link = { actionId: 'a1', unit: 'km', since: '2026-10-01' };

  it('la quantité du jour suit l’unité de l’action', () => {
    const day = [run('2026-10-07', 10.24, 52), run('2026-10-07', 5, 30)];
    expect(dayValue(day, 'km')).toBe(15.2);
    expect(dayValue(day, 'Kilomètres')).toBe(15.2);
    expect(dayValue(day, 'm')).toBe(15_240);
    expect(dayValue(day, 'min')).toBe(82);
    expect(dayValue(day, 'h')).toBe(1.37);
    expect(dayValue(day, 'séances')).toBeNull();
  });

  it('une coche par jour couru, depuis la création de l’objectif', () => {
    const runs = [run('2026-09-30', 8, 45), run('2026-10-07', 10.2, 52), run('2026-10-07', 5, 30), run('2026-10-08', 6, 33)];
    const want = desiredCheckins(runs, link);
    expect(want.map((c) => [c.ref, c.value])).toEqual([
      ['sport:jour:2026-10-07', 15.2],
      ['sport:jour:2026-10-08', 6],
    ]);
    expect(want[0].note).toBe('2 sorties · 15,2 km en 1 h 22 · d’après Sport');
    expect(want[1].note).toBe('6,0 km en 33 min · d’après Sport');
  });

  it('n’écrit que ce qui change, retire ce qui n’a plus de sortie ou d’action', () => {
    const want = desiredCheckins([run('2026-10-07', 10, 50), run('2026-10-08', 6, 33)], link);
    const have: RecordedCheckin[] = [
      { ...want[0] }, // déjà juste
      { ref: `${CHECKIN_PREFIX}2026-10-05`, actionId: 'a1', day: '2026-10-05', value: 7, note: '' }, // sortie supprimée
    ];
    expect(linkPlan(want, have)).toEqual({ remove: ['sport:jour:2026-10-05'], record: [want[1]] });
    // Le lien a changé d'action : retirée de l'ancienne, posée sur la nouvelle.
    const moved = desiredCheckins([run('2026-10-07', 10, 50)], { ...link, actionId: 'a2' });
    expect(linkPlan(moved, [{ ...want[0] }])).toEqual({ remove: ['sport:jour:2026-10-07'], record: moved });
    // Plus de lien : tout part.
    expect(linkPlan([], have).remove).toHaveLength(2);
  });
});

describe('le calque dans Calendar', () => {
  it('les sorties à leur heure, la semaine du plan le lundi, la course', () => {
    const runs = [run('2026-10-15', 6, 36)];
    const marks = sportMarks({ runs, plans: [PLAN], sessions }, '2026-10-12', '2026-10-18', '2026-10-15');
    const done = marks.find((m) => m.id.startsWith('run:'))!;
    expect(done).toMatchObject({ day: '2026-10-15', title: '✓ Footing · 6,0 km', time: '18:30', duration: 36, link: `run:${runs[0].id}` });
    const week = marks.find((m) => m.id === 'week:p:1')!;
    expect(week.day).toBe('2026-10-12');
    // La sortie du jeudi a fait une des quatre séances : il en reste trois.
    expect(week.title).toMatch(/^🏃 Semaine 1 · 3 séances, /);
    expect(sportMarks({ runs: [], plans: [PLAN], sessions }, '2027-04-19', '2027-04-25', '2026-10-13').some((m) => m.id === 'race:p' && m.title === '🏁 Marathon d’Annecy')).toBe(true);
  });

  it('une séance datée a sa propre marque, déplaçable dans sa semaine seulement', () => {
    const dated = sessions.map((s) => (s.id === 's0' ? { ...s, day: '2026-10-15' } : s));
    const marks = sportMarks({ runs: [], plans: [PLAN], sessions: dated }, '2026-10-12', '2026-10-18', '2026-10-13');
    expect(marks.find((m) => m.id === 's0' || m.id === 'session:s0')).toMatchObject({ day: '2026-10-15', movable: true, link: 'session:s0' });
    expect(marks.find((m) => m.id === 'week:p:1')?.title).toMatch(/3 séances/);
    expect(sessionMoveError('2026-10-12', { day: '2026-10-17', time: null })).toBeNull();
    expect(sessionMoveError('2026-10-12', { day: '2026-10-19', time: null })).toMatch(/sa semaine/);
    expect(sessionMoveError('2026-10-12', { day: '2026-10-15', time: '07:00' })).toMatch(/journée/);
    expect(markTarget('session:s0')).toEqual({ kind: 'session', id: 's0' });
    expect(markTarget('autre')).toBeNull();
  });

  it('sans plan en cours, seulement les sorties', () => {
    const marks = sportMarks({ runs: [run('2026-10-13', 8, 45)], plans: [{ ...PLAN, status: 'termine' as Plan['status'] }], sessions }, '2026-10-12', '2026-10-18', '2026-10-13');
    expect(marks.map((m) => m.id.split(':')[0])).toEqual(['run']);
  });
});

describe('les rappels', () => {
  it('le lundi matin la semaine, le matin d’une séance datée, la veille de la course', () => {
    const dated = sessions.map((s) => (s.id === 's1' ? { ...s, day: '2026-10-15' } : s));
    const now = new Date(2026, 9, 11, 20, 0); // dimanche soir
    const planned = plannedReminders({ runs: [], plans: [PLAN], sessions: dated }, now);
    expect(planned.map((p) => p.ref)).toEqual(['week:p:1', 'session:s1:2026-10-15']);
    expect(planned[0].title).toBe('🏃 Semaine 1 du plan · Base');
    expect(new Date(planned[0].fireAt).getHours()).toBe(7);
    expect(planned[1].title).toBe(`🏃 Aujourd’hui : ${dated[1].title}`);
    const eve = plannedReminders({ runs: [], plans: [PLAN], sessions }, new Date(2027, 3, 20, 9, 0));
    expect(eve.find((p) => p.ref.startsWith('race:'))).toMatchObject({ title: '🏁 Demain : Marathon d’Annecy' });
  });

  it('une séance faite ne se rappelle pas, et rien sans plan', () => {
    const dated = sessions.map((s) => (s.id === 's1' ? { ...s, day: '2026-10-15' } : s));
    const done = plannedReminders({ runs: [run('2026-10-15', 6, 36, { sessionId: 's1' })], plans: [PLAN], sessions: dated }, new Date(2026, 9, 14, 20, 0));
    expect(done.some((p) => p.ref.startsWith('session:s1'))).toBe(false);
    expect(plannedReminders({ runs: [], plans: [], sessions }, new Date(2026, 9, 11, 20, 0))).toEqual([]);
  });
});
