/**
 * Les rappels de Polaris — bibliothèque pure (étape 5, docs/etude-taches.md
 * §6 et §12). Polaris calcule lui-même ce qui doit partir dans les jours qui
 * viennent et le déclare au socle (`coreStore.scheduleReminders`), qui
 * l'envoie à l'heure : le serveur ne sait rien des tâches.
 *
 *  · **à l'heure d'une tâche** qui en a une : « Appeler le garage — prévue à 9 h » ;
 *  · **le résumé du matin**, seulement s'il y a quelque chose à faire ce
 *    jour-là : « ☀️ 4 tâches aujourd'hui, dont 1 urgente ». Un rappel
 *    inutile est la meilleure façon de se faire couper le son.
 *
 * Les rappels sont recalculés à chaque changement : un résumé du matin
 * annoncé pour après-demain suit donc ce qui est prévu, tant que l'app est
 * ouverte d'ici là sur l'un des appareils.
 */
import type { ReminderInput } from '../../../core/data/coreStore';
import { dayString, shiftDay } from '../../../core/lib/day';
import { dueLabel, timeLabel } from './format';
import type { TachesSettings, Task } from './types';
import { todayView } from './views';

/** Jusqu'où les rappels sont posés à l'avance. */
export const REMINDER_HORIZON_DAYS = 7;

/** L'instant d'une heure locale d'un jour donné, changement d'heure compris. */
export function localInstant(day: string, time: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
}

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? 's' : ''}`;

export function plannedReminders(tasks: readonly Task[], settings: TachesSettings, now: Date, horizonDays = REMINDER_HORIZON_DAYS): ReminderInput[] {
  const today = dayString(now);
  const last = shiftDay(today, horizonDays - 1);
  const reminders: ReminderInput[] = [];

  if (settings.taskReminders) {
    for (const task of tasks) {
      if (task.completedAt || task.parentId || !task.plannedDay || !task.plannedTime) continue;
      if (task.plannedDay > last) continue;
      const at = localInstant(task.plannedDay, task.plannedTime);
      if (at <= now) continue;
      reminders.push({
        ref: `task:${task.id}:${task.plannedDay}`,
        fireAt: at.toISOString(),
        title: task.title,
        body: `Prévue à ${timeLabel(task.plannedTime)}${task.dueDay ? ` · ${dueLabel(task.dueDay, task.plannedDay)}` : ''}`,
      });
    }
  }

  if (settings.morningEnabled) {
    for (let i = 0; i < horizonDays; i++) {
      const day = shiftDay(today, i);
      const at = localInstant(day, settings.morningTime);
      if (at <= now) continue;
      const view = todayView(tasks, day);
      const all = [...view.overdue, ...view.today];
      if (all.length === 0) continue;
      const urgent = all.filter((t) => t.priority === 'urgente').length;
      const shown = all.slice(0, 3).map((t) => t.title);
      reminders.push({
        ref: `morning:${day}`,
        fireAt: at.toISOString(),
        title: `☀️ ${plural(all.length, 'tâche')} aujourd’hui${urgent > 0 ? `, dont ${urgent} urgente${urgent > 1 ? 's' : ''}` : ''}`,
        body: `${shown.join(' · ')}${all.length > 3 ? ` et ${plural(all.length - 3, 'autre')}` : ''}`,
      });
    }
  }

  return reminders.sort((a, b) => a.fireAt.localeCompare(b.fireAt));
}
