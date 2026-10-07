/**
 * Le plan vu depuis aujourd'hui — bibliothèque pure (docs/etude-sport.md §12).
 *
 * Ce qui a été fait ne se range pas sur la séance : une sortie se rattache à
 * la séance qui lui ressemble le plus dans sa semaine, recalculé à chaque
 * affichage. Seul un choix fait à la main (« cette sortie, c'était le seuil »)
 * est rangé, sur la sortie (`Run.sessionId`), et l'emporte toujours.
 */
import { daysBetween, mondayOf } from '../../../core/lib/day';
import {
  generatePlan,
  matchSession,
  mondayOfWeek,
  planDrafts,
  planWeekCount,
  weekOfPlan,
  weekPhase,
  type PlanOptions,
  type PlanPhase,
} from './plan';
import type { Plan, PlanSession, PlanSessionDraft, Run } from './types';

/** Quelle sortie a fait quelle séance : `Map<séance, sortie>`. */
export function assignRuns(plan: Plan, sessions: PlanSession[], runs: Run[]): Map<string, Run> {
  const mine = sessions.filter((s) => s.planId === plan.id);
  const ids = new Set(mine.map((s) => s.id));
  const done = new Map<string, Run>();
  // D'abord les choix faits à la main.
  for (const run of runs) if (run.sessionId && ids.has(run.sessionId) && !done.has(run.sessionId)) done.set(run.sessionId, run);
  const chosen = new Set([...done.values()].map((r) => r.id));
  // Puis, dans l'ordre du temps, chaque sortie du plan vers la séance qui lui ressemble.
  const candidates = runs
    .filter((r) => !r.sessionId && !chosen.has(r.id) && r.day >= mondayOf(plan.startDay) && r.day <= plan.raceDay)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  for (const run of candidates) {
    const id = matchSession(run, plan.startDay, mine, new Set(done.keys()));
    if (id) done.set(id, run);
  }
  return done;
}

export type SessionState = 'faite' | 'a-faire' | 'manquee' | 'a-venir';

export interface SessionStatus {
  session: PlanSession;
  run: Run | null;
  state: SessionState;
}

export interface WeekStatus {
  week: number;
  monday: string;
  phase: PlanPhase;
  recovery: boolean;
  /** Passée, en cours, à venir. */
  when: 'passee' | 'en-cours' | 'a-venir';
  plannedM: number;
  /** Les kilomètres courus cette semaine-là, toutes sorties comprises (pas seulement les séances). */
  doneM: number;
  sessions: SessionStatus[];
}

/** Chaque semaine du plan, et l'état de chacune de ses séances, vus d'aujourd'hui. */
export function planWeeks(plan: Plan, sessions: PlanSession[], runs: Run[], today: string): WeekStatus[] {
  const total = planWeekCount(plan.startDay, plan.raceDay);
  const current = weekOfPlan(plan.startDay, today);
  const done = assignRuns(plan, sessions, runs);
  const mine = sessions.filter((s) => s.planId === plan.id);
  const out: WeekStatus[] = [];
  for (let week = 1; week <= total; week++) {
    const monday = mondayOfWeek(plan.startDay, week);
    const when = week < current ? 'passee' : week === current ? 'en-cours' : 'a-venir';
    const inWeek = mine.filter((s) => s.week === week).sort((a, b) => a.position - b.position);
    const end = mondayOfWeek(plan.startDay, week + 1);
    out.push({
      week,
      monday,
      ...weekPhase(week, total),
      when,
      plannedM: inWeek.reduce((sum, s) => sum + (s.distanceM ?? 0), 0),
      doneM: runs.filter((r) => r.day >= monday && r.day < end).reduce((sum, r) => sum + r.distanceM, 0),
      sessions: inWeek.map((session) => {
        const run = done.get(session.id) ?? null;
        const state: SessionState = run ? 'faite' : when === 'passee' ? 'manquee' : when === 'en-cours' ? 'a-faire' : 'a-venir';
        return { session, run, state };
      }),
    });
  }
  return out;
}

/**
 * La séance suivante : la première pas encore faite de la semaine en cours,
 * dans l'ordre conseillé ; si la semaine est bouclée, la première de la
 * suivante. `null` une fois la course passée.
 */
export function nextSession(weeks: WeekStatus[]): { session: PlanSession; week: number } | null {
  for (const w of weeks) {
    if (w.when === 'passee') continue;
    const open = w.sessions.find((s) => s.state !== 'faite');
    if (open) return { session: open.session, week: w.week };
  }
  return null;
}

/** Les jours jusqu'à la course (0 le jour même, négatif après). */
export function daysToRace(plan: Plan, today: string): number {
  return daysBetween(today, plan.raceDay);
}

/**
 * Changer la date de la course (Annecy n'a pas encore la sienne) : les
 * semaines passées restent telles qu'elles ont été vécues ; la semaine en
 * cours et les suivantes sont recalculées pour la nouvelle date. Rend les
 * séances à retirer et celles à poser. Une séance modifiée à la main dans les
 * semaines à venir est recalculée elle aussi : l'écran le dit avant.
 */
export function reschedule(
  plan: Plan,
  sessions: PlanSession[],
  options: Omit<PlanOptions, 'startDay' | 'raceDay' | 'raceTitle' | 'sessionsPerWeek'> & { raceDay: string },
  today: string,
  newId: () => string,
): { removeIds: string[]; add: PlanSessionDraft[] } {
  const keepBefore = Math.max(1, weekOfPlan(plan.startDay, today));
  const weeks = generatePlan({
    ...options,
    startDay: plan.startDay,
    raceTitle: plan.title,
    sessionsPerWeek: plan.sessionsPerWeek,
  }).filter((w) => w.week >= keepBefore);
  const removeIds = sessions.filter((s) => s.planId === plan.id && s.week >= keepBefore).map((s) => s.id);
  return { removeIds, add: planDrafts(plan.id, weeks, newId) };
}
