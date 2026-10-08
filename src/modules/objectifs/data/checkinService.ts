import { dayString } from '../../../core/lib/day';
import type { CheckinService } from '../../../core/lib/services';
import type { GoalsStore } from './goalsStore';

/**
 * Le service `checkins` qu'Objectifs rend aux autres modules
 * (`core/lib/services.ts`, docs/etude-sport.md §18) : Sport coche l'action
 * choisie chaque jour couru, avec les kilomètres du jour. Les PP sont ceux
 * de l'action, figés à la pose comme pour toute coche ; le palier, le
 * streak, la grille et les trophées avancent sans que Sport en sache rien.
 */
export function createCheckinService(store: GoalsStore): CheckinService {
  return {
    async actions() {
      const [goals, actions] = await Promise.all([store.listGoals(), store.listActions()]);
      const open = new Map(goals.filter((g) => !g.archived).map((g) => [g.id, g]));
      return actions
        .filter((a) => !a.archived && !a.isMeasure && open.has(a.goalId))
        .map((a) => {
          const goal = open.get(a.goalId)!;
          return { actionId: a.id, goalTitle: goal.title, actionTitle: a.title, unit: a.unit, since: dayString(new Date(goal.createdAt)) };
        });
    },

    async record(request) {
      const action = (await store.listActions()).find((a) => a.id === request.actionId);
      if (!action) throw new Error('Cette action d’Objectifs n’existe plus : choisis-en une autre dans Sport.');
      return store.saveRefCheckin({
        ref: request.ref,
        goalId: action.goalId,
        actionId: action.id,
        day: request.day,
        pp: action.pp,
        value: request.value,
        note: request.note,
      });
    },

    remove: (ref) => store.deleteRefCheckin(ref),

    async list(prefix) {
      return (await store.listCheckins())
        .filter((c): c is typeof c & { ref: string } => typeof c.ref === 'string' && c.ref.startsWith(prefix))
        .map((c) => ({ ref: c.ref, actionId: c.actionId, day: c.day, value: c.value, note: c.note }));
    },
  };
}
