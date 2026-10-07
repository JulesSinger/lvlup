import { describe, expect, it } from 'vitest';
import { HARD_KINDS } from './kinds';
import { generatePlan, matchSession, mondayOfWeek, planDrafts, planWeekCount, weekOfPlan, type PlanOptions } from './plan';
import { MARATHON_M, type PlanSession } from './types';

/** Le cas de Jules : début le lundi 12 octobre 2026, Annecy le 25 avril 2027 (date provisoire). */
const ANNECY: PlanOptions = {
  startDay: '2026-10-14',
  raceDay: '2027-04-25',
  raceTitle: 'Marathon d’Annecy',
  sessionsPerWeek: 4,
  reference: { distanceM: 10_000, timeS: 3000 },
  currentWeeklyM: 25_000,
  longestRecentM: 12_000,
};

const longOf = (w: ReturnType<typeof generatePlan>[number]) =>
  w.sessions.find((s) => s.kind === 'longue' || s.kind === 'course')!.distanceM!;

describe('les semaines du plan', () => {
  it('commencent le lundi de la semaine du début, celle de la course comprise', () => {
    expect(planWeekCount('2026-10-14', '2027-04-25')).toBe(28);
    expect(mondayOfWeek('2026-10-14', 1)).toBe('2026-10-12');
    expect(mondayOfWeek('2026-10-14', 28)).toBe('2027-04-19');
    expect(weekOfPlan('2026-10-14', '2026-10-18')).toBe(1);
    expect(weekOfPlan('2026-10-14', '2026-10-19')).toBe(2);
    expect(weekOfPlan('2026-10-14', '2026-10-11')).toBe(0);
  });
});

describe('le plan marathon', () => {
  const weeks = generatePlan(ANNECY);

  it('base, bloc spécifique de quinze semaines, deux d’affûtage, puis la course', () => {
    expect(weeks).toHaveLength(28);
    expect(weeks.filter((w) => w.phase === 'base')).toHaveLength(10);
    expect(weeks.filter((w) => w.phase === 'specifique')).toHaveLength(15);
    expect(weeks.filter((w) => w.phase === 'affutage').map((w) => w.week)).toEqual([26, 27]);
    expect(weeks[27].phase).toBe('course');
  });

  it('autant de séances que demandé, et la course le jour de la course', () => {
    for (const w of weeks.slice(0, 27)) expect(w.sessions).toHaveLength(4);
    const race = weeks[27].sessions.at(-1)!;
    expect(race).toMatchObject({ kind: 'course', title: 'Marathon d’Annecy', distanceM: MARATHON_M, day: '2027-04-25' });
  });

  it('la base n’a que de l’endurance ; le bloc spécifique alterne seuil et fractionné', () => {
    for (const w of weeks.filter((x) => x.phase === 'base')) {
      expect(w.sessions.every((s) => s.kind === 'footing' || s.kind === 'longue')).toBe(true);
    }
    const quality = weeks.filter((w) => w.phase === 'specifique').map((w) => w.sessions.find((s) => s.kind === 'seuil' || s.kind === 'fractionne')!.kind);
    expect(quality.slice(0, 4)).toEqual(['seuil', 'fractionne', 'seuil', 'fractionne']);
  });

  it('le volume monte d’au plus 8 % par semaine, hors retour d’une semaine allégée', () => {
    for (let i = 1; i < 25; i++) {
      if (weeks[i - 1].recovery || weeks[i].recovery) continue;
      // Les séances sont arrondies au demi-kilomètre : 2 km de marge.
      expect(weeks[i].volumeM).toBeLessThanOrEqual(weeks[i - 1].volumeM * 1.08 + 2000);
    }
  });

  it('une semaine sur quatre est allégée, plus légère que la précédente', () => {
    const recovery = weeks.filter((w) => w.recovery).map((w) => w.week);
    expect(recovery).toEqual([4, 8, 12, 16, 20, 24]);
    for (const week of recovery) expect(weeks[week - 1].volumeM).toBeLessThan(weeks[week - 2].volumeM);
  });

  it('la sortie longue : jamais plus de 2 km de plus, 18 km au plus en base, le pic juste avant l’affûtage', () => {
    for (let i = 1; i < 25; i++) {
      if (weeks[i - 1].recovery || weeks[i].recovery) continue;
      expect(longOf(weeks[i]) - longOf(weeks[i - 1])).toBeLessThanOrEqual(2000 + 500);
    }
    for (const w of weeks.filter((x) => x.phase === 'base')) expect(longOf(w)).toBeLessThanOrEqual(18_000);
    const longs = weeks.slice(0, 25).map(longOf);
    expect(Math.max(...longs)).toBe(32_000);
    expect(longs.indexOf(32_000)).toBe(24);
    // Deux ou trois très longues sorties (28 km et plus), pas neuf.
    expect(longs.filter((m) => m >= 28_000).length).toBeLessThanOrEqual(4);
  });

  it('jamais deux séances dures d’affilée, la plus longue en fin de semaine', () => {
    for (const w of weeks) {
      for (let i = 1; i < w.sessions.length; i++) {
        const both = HARD_KINDS.includes(w.sessions[i].kind) && HARD_KINDS.includes(w.sessions[i - 1].kind);
        expect(both, `semaine ${w.week} : ${w.sessions.map((s) => s.title).join(' > ')}`).toBe(false);
      }
      expect(w.sessions.at(-1)!.distanceM).toBe(Math.max(...w.sessions.map((s) => s.distanceM ?? 0)));
    }
  });

  it('des allures d’après le temps de référence ; sans référence, des zones seulement', () => {
    const footing = weeks[0].sessions.find((s) => s.kind === 'footing')!;
    expect(footing.paceMinS).toBeGreaterThan(360);
    expect(footing.hrZone).toBe(2);
    const blind = generatePlan({ ...ANNECY, reference: null });
    expect(blind.flatMap((w) => w.sessions).every((s) => s.paceMinS === null)).toBe(true);
    expect(blind[0].sessions.find((s) => s.kind === 'footing')!.hrZone).toBe(2);
  });

  it('à trois séances, le pic est plus bas et la sortie longue s’arrête à 30 km', () => {
    const three = generatePlan({ ...ANNECY, sessionsPerWeek: 3 });
    expect(three[0].sessions).toHaveLength(3);
    expect(Math.max(...three.slice(0, 25).map(longOf))).toBe(30_000);
    expect(Math.max(...three.map((w) => (w.phase === 'course' ? 0 : w.volumeM)))).toBeLessThanOrEqual(51_000);
  });

  it('part de ce que Jules court déjà, sans descendre sous 20 km', () => {
    expect(generatePlan({ ...ANNECY, currentWeeklyM: 0 })[0].volumeM).toBeGreaterThanOrEqual(19_000);
    expect(generatePlan({ ...ANNECY, currentWeeklyM: 40_000 })[0].volumeM).toBeGreaterThan(weeks[0].volumeM);
  });

  it('refuse une course trop proche ; un plan court n’a pas de base', () => {
    expect(() => generatePlan({ ...ANNECY, startDay: '2027-04-22' })).toThrow();
    const short = generatePlan({ ...ANNECY, startDay: '2027-02-01' });
    expect(short.some((w) => w.phase === 'base')).toBe(false);
    expect(short.at(-1)!.phase).toBe('course');
  });

  it('pose chaque séance avec son identifiant, sa semaine et sa place', () => {
    let n = 0;
    const drafts = planDrafts('p-1', weeks.slice(0, 2), () => `s${n++}`);
    expect(drafts).toHaveLength(8);
    expect(drafts[5]).toMatchObject({ id: 's5', planId: 'p-1', week: 2, position: 1 });
  });
});

describe('rattacher une sortie à sa séance', () => {
  const session = (id: string, week: number, kind: PlanSession['kind'], km: number, day: string | null = null): PlanSession => ({
    id, planId: 'p', week, position: 0, kind, title: kind, distanceM: km * 1000, durationS: null,
    paceMinS: null, paceMaxS: null, hrZone: null, instructions: '', day, createdAt: '',
  });
  const sessions = [
    session('f1', 1, 'footing', 8),
    session('q1', 1, 'seuil', 10),
    session('l1', 1, 'longue', 18),
    session('f2', 2, 'footing', 8),
  ];

  it('dans sa semaine, la séance la plus ressemblante qui n’est pas déjà faite', () => {
    expect(matchSession({ day: '2026-10-17', distanceM: 17_200, kind: 'longue' }, '2026-10-14', sessions, new Set())).toBe('l1');
    expect(matchSession({ day: '2026-10-13', distanceM: 8300, kind: 'footing' }, '2026-10-14', sessions, new Set())).toBe('f1');
    // Le footing est déjà fait : un second footing se rabat sur la séance de seuil.
    expect(matchSession({ day: '2026-10-15', distanceM: 9000, kind: 'footing' }, '2026-10-14', sessions, new Set(['f1']))).toBe('q1');
    expect(matchSession({ day: '2026-10-20', distanceM: 8000, kind: 'footing' }, '2026-10-14', sessions, new Set())).toBe('f2');
  });

  it('rien si rien ne ressemble, ou hors du plan', () => {
    expect(matchSession({ day: '2026-10-13', distanceM: 40_000, kind: 'footing' }, '2026-10-14', sessions, new Set())).toBeNull();
    expect(matchSession({ day: '2026-10-05', distanceM: 8000, kind: 'footing' }, '2026-10-14', sessions, new Set())).toBeNull();
  });

  it('une séance datée — la course — ne se fait que ce jour-là', () => {
    const race = [session('race', 1, 'course', 42.195, '2026-10-18')];
    expect(matchSession({ day: '2026-10-17', distanceM: 42_195, kind: 'course' }, '2026-10-14', race, new Set())).toBeNull();
    expect(matchSession({ day: '2026-10-18', distanceM: 42_400, kind: 'course' }, '2026-10-14', race, new Set())).toBe('race');
  });
});
