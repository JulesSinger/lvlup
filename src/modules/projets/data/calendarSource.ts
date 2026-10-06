import type { CalendarSource } from '../../../core/lib/services';
import { markTarget, projectMarks } from '../lib/calendarMarks';
import type { ProjetsStore } from './projetsStore';

/**
 * Le calque de Projets que Calendar affiche (`core/lib/services.ts`) : les
 * tâches datées, cochables et déplaçables, la mise en ligne des projets, la
 * fin des chantiers et les paiements attendus — ces trois-là déplaçables à
 * un autre jour, ce qui change la date chez Projets. `afterWrite` : ce qui
 * doit suivre une écriture (les rappels à recalculer).
 */
export function createCalendarSource(store: ProjetsStore, afterWrite: () => Promise<void> = async () => {}): CalendarSource {
  async function load() {
    const [clients, projects, workstreams, tasks, payments] = await Promise.all([
      store.listClients(),
      store.listProjects(),
      store.listWorkstreams(),
      store.listTasks(),
      store.listPayments(),
    ]);
    return { clients, projects, workstreams, tasks, payments };
  }

  return {
    id: 'projets',
    label: 'Projets',
    color: '#6fa8f5',
    defaultVisible: true,
    async marksBetween(from, to) {
      return projectMarks(await load(), from, to);
    },
    async toggleMark(markId) {
      const target = markTarget(markId);
      if (target?.kind !== 'task') throw new Error('Seule une tâche se coche.');
      const task = (await store.listTasks()).find((t) => t.id === target.id);
      if (!task) throw new Error('Cette tâche n’existe plus.');
      await store.updateTask(task.id, { completedAt: task.completedAt ? null : new Date().toISOString() });
      await afterWrite().catch(() => {});
    },
    /**
     * Glisser une marque à un autre jour change sa date chez Projets. Tout
     * se fait à la journée : posée sur une heure, la marque est refusée et
     * revient à sa place, avec le message.
     */
    async moveMark(markId, to) {
      if (to.time !== null) throw new Error('Les dates d’un projet se posent à la journée : glisse-la dans la bande « Journée ».');
      const target = markTarget(markId);
      if (!target) throw new Error('Cette marque ne se déplace pas.');
      if (target.kind === 'task') await store.updateTask(target.id, { plannedDay: to.day });
      else if (target.kind === 'due') await store.updateProject(target.id, { dueDay: to.day });
      else if (target.kind === 'ws') await store.updateWorkstream(target.id, { dueDay: to.day });
      else await store.updatePayment(target.id, { expectedDay: to.day });
      await afterWrite().catch(() => {});
    },
  };
}
