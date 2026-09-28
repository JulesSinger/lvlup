/**
 * Le calque de Polaris dans Éclipse — bibliothèque pure (étape 6,
 * docs/etude-taches.md §6). Chaque tâche datée devient une marque de son jour
 * prévu (à son heure s'il y en a une), ou de son échéance si elle n'a pas de
 * jour prévu ; faite ou non, et **cochable** depuis le calendrier.
 */
import type { CalendarMark } from '../../../core/lib/services';
import { dueLabel } from './format';
import { upcomingOccurrences } from './repeat';
import type { Task, TaskList } from './types';

const PRIORITY = { normale: '', importante: 'importante', urgente: 'urgente' };

export function taskMarks(tasks: readonly Task[], lists: readonly TaskList[], from: string, to: string, today: string): CalendarMark[] {
  const listName = new Map(lists.map((l) => [l.id, l.name]));
  const marks: CalendarMark[] = [];
  for (const task of tasks) {
    if (task.parentId) continue; // une sous-tâche vit sous sa tâche, pas seule dans le calendrier
    const day = task.plannedDay ?? task.dueDay;
    if (!day) continue;
    const detail = [
      task.listId ? listName.get(task.listId) : 'Boîte de réception',
      PRIORITY[task.priority],
      task.dueDay ? dueLabel(task.dueDay, day) : '',
      task.recurrence ? 'répétée' : '',
    ]
      .filter(Boolean)
      .join(' · ');
    // L'occurrence en cours, si elle tombe dans la période. Les suivantes, elles,
    // peuvent y tomber même quand celle-ci n'y est pas (la semaine d'après).
    if (day >= from && day <= to) {
      marks.push({
        id: `task:${task.id}`,
        day,
        title: task.plannedDay ? task.title : `⚑ ${task.title}`,
        detail,
        ...(task.plannedDay && task.plannedTime ? { time: task.plannedTime } : {}),
        ...(task.plannedDay && task.plannedTime && task.durationMinutes ? { duration: task.durationMinutes } : {}),
        checkable: true,
        done: task.completedAt !== null,
        // « Modifier dans Polaris » depuis le calendrier ouvre la fenêtre de cette tâche.
        link: `task:${task.id}`,
      });
    }
    // Les occurrences suivantes d'une tâche répétée, en aperçu : ni cochables
    // ni stockées — on coche celle en cours, la suivante prend sa place.
    for (const next of upcomingOccurrences(task, today, from, to)) {
      marks.push({
        id: `forecast:${task.id}:${next}`,
        day: next,
        title: task.title,
        detail: `${task.repeatFrom === 'completion' ? 'Prochaine fois, si elle est faite à temps' : 'Prochaine fois'}${detail ? ` · ${detail}` : ''}`,
        ...(task.plannedTime ? { time: task.plannedTime } : {}),
        ...(task.plannedTime && task.durationMinutes ? { duration: task.durationMinutes } : {}),
        tentative: true,
        link: `task:${task.id}`,
      });
    }
  }
  return marks.sort((a, b) => a.day.localeCompare(b.day) || (a.time ?? '').localeCompare(b.time ?? '') || a.title.localeCompare(b.title, 'fr'));
}

/** L'identifiant de la tâche d'une marque, ou `null` si la marque n'en est pas une. */
export function taskIdOf(markId: string): string | null {
  return markId.startsWith('task:') ? markId.slice(5) : null;
}
