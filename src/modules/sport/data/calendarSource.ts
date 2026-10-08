import { dayString } from '../../../core/lib/day';
import type { CalendarSource } from '../../../core/lib/services';
import { markTarget, sessionMoveError, sportMarks } from '../lib/calendarMarks';
import { mondayOfWeek } from '../lib/plan';
import type { SportStore } from './sportStore';

/**
 * Le calque de Sport que Calendar affiche (`core/lib/services.ts`,
 * docs/etude-sport.md §18) : les sorties faites, les séances du plan et la
 * course. Une séance datée se glisse à un autre jour de sa semaine ; c'est
 * Sport qui écrit. `afterWrite` : ce qui doit suivre (les rappels).
 */
export function createCalendarSource(store: SportStore, afterWrite: () => Promise<void> = async () => {}): CalendarSource {
  async function load() {
    const [runs, plans, sessions] = await Promise.all([store.listRuns(), store.listPlans(), store.listSessions()]);
    return { runs, plans, sessions };
  }

  return {
    id: 'sport',
    label: 'Sport',
    color: '#ff8b8b',
    defaultVisible: true,
    async marksBetween(from, to) {
      return sportMarks(await load(), from, to, dayString());
    },
    async moveMark(markId, to) {
      const target = markTarget(markId);
      if (target?.kind !== 'session') throw new Error('Seule une séance datée du plan se déplace.');
      const { plans, sessions } = await load();
      const session = sessions.find((s) => s.id === target.id);
      const plan = session && plans.find((p) => p.id === session.planId);
      if (!session || !plan) throw new Error('Cette séance n’existe plus.');
      const problem = sessionMoveError(mondayOfWeek(plan.startDay, session.week), to);
      if (problem) throw new Error(problem);
      await store.updateSession(session.id, { day: to.day });
      await afterWrite().catch(() => {});
    },
  };
}
