import { newId } from '../../../core/data/coreStore';
import { dayString } from '../../../core/lib/day';
import type { CalendarSource } from '../../../core/lib/services';
import { taskIdOf, taskMarks } from '../lib/calendarMarks';
import { completionPlan } from '../lib/repeat';
import { subtasksOf } from '../lib/views';
import { applyCompletion } from './applyPlans';
import type { TachesStore } from './tachesStore';

/**
 * Le calque de Polaris qu'Éclipse affiche (`core/lib/services.ts`) — et le
 * premier qui écrit : cocher une tâche dans le calendrier la coche
 * vraiment, par la même règle que l'écran de Polaris (`completionPlan`),
 * répétition comprise. `afterWrite` : ce qui doit suivre une écriture (les
 * rappels à recalculer).
 */
export function createCalendarSource(store: TachesStore, afterWrite: () => Promise<void> = async () => {}): CalendarSource {
  return {
    id: 'taches',
    label: 'Polaris',
    color: '#ff9f7a',
    defaultVisible: true,
    async marksBetween(from, to) {
      const [tasks, lists] = await Promise.all([store.listTasks(), store.listLists()]);
      return taskMarks(tasks, lists, from, to, dayString());
    },
    async toggleMark(markId) {
      const id = taskIdOf(markId);
      const tasks = await store.listTasks();
      const task = tasks.find((t) => t.id === id);
      if (!task) throw new Error('Cette tâche n’existe plus.');
      if (task.completedAt) await store.updateTask(task.id, { completedAt: null });
      else await applyCompletion(store, completionPlan(task, subtasksOf(tasks, task.id), new Date().toISOString(), dayString(), newId()));
      await afterWrite().catch(() => {});
    },
  };
}
