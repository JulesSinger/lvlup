/**
 * Le calque de Polaris dans Éclipse — bibliothèque pure (étape 6,
 * docs/etude-taches.md §6). Chaque tâche datée devient une marque de son jour
 * prévu (à son heure s'il y en a une), ou de son échéance si elle n'a pas de
 * jour prévu ; faite ou non, et **cochable** depuis le calendrier.
 */
import type { CalendarMark } from '../../../core/lib/services';
import { dueLabel } from './format';
import type { Task, TaskList } from './types';

const PRIORITY = { normale: '', importante: 'importante', urgente: 'urgente' };

export function taskMarks(tasks: readonly Task[], lists: readonly TaskList[], from: string, to: string): CalendarMark[] {
  const listName = new Map(lists.map((l) => [l.id, l.name]));
  const marks: CalendarMark[] = [];
  for (const task of tasks) {
    if (task.parentId) continue; // une sous-tâche vit sous sa tâche, pas seule dans le calendrier
    const day = task.plannedDay ?? task.dueDay;
    if (!day || day < from || day > to) continue;
    const detail = [
      task.listId ? listName.get(task.listId) : 'Boîte de réception',
      PRIORITY[task.priority],
      task.dueDay ? dueLabel(task.dueDay, day) : '',
      task.recurrence ? 'répétée' : '',
    ]
      .filter(Boolean)
      .join(' · ');
    marks.push({
      id: `task:${task.id}`,
      day,
      title: task.plannedDay ? task.title : `⚑ ${task.title}`,
      detail,
      ...(task.plannedDay && task.plannedTime ? { time: task.plannedTime } : {}),
      checkable: true,
      done: task.completedAt !== null,
    });
  }
  return marks.sort((a, b) => a.day.localeCompare(b.day) || (a.time ?? '').localeCompare(b.time ?? '') || a.title.localeCompare(b.title, 'fr'));
}

/** L'identifiant de la tâche d'une marque, ou `null` si la marque n'en est pas une. */
export function taskIdOf(markId: string): string | null {
  return markId.startsWith('task:') ? markId.slice(5) : null;
}
