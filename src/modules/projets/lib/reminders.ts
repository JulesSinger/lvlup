/**
 * Les rappels de Projets — bibliothèque pure (docs/etude-projets.md §6, étape 6).
 * Le module calcule ce qui doit partir dans les jours qui viennent et le
 * déclare au socle (`coreStore.scheduleReminders`), qui l'envoie à l'heure.
 *
 * Trois rappels, le matin à 9 h, pour ce qui se rate le plus en freelance :
 *  · une **mise en ligne dans deux jours** encore inachevée ;
 *  · un **paiement attendu** ce jour-là ;
 *  · une **relance** : une attente du client qui atteint une semaine.
 */
import type { ReminderInput } from '../../../core/data/coreStore';
import { dayString, shiftDay } from '../../../core/lib/day';
import { NUDGE_DAYS } from './dashboard';
import { formatEuros } from './money';
import { projectProgress } from './progress';
import { isClosed } from './status';
import type { Client, Payment, Project, ProjectTask } from './types';

export const REMINDER_HORIZON_DAYS = 7;
export const REMINDER_TIME = '09:00';
/** La mise en ligne se rappelle tant de jours avant. */
export const DUE_NOTICE_DAYS = 2;

/** L'instant d'une heure locale d'un jour donné, changement d'heure compris. */
function localInstant(day: string, time: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
}

export interface ReminderData {
  clients: readonly Client[];
  projects: readonly Project[];
  tasks: readonly ProjectTask[];
  payments: readonly Payment[];
}

export function plannedReminders(data: ReminderData, now: Date, horizonDays = REMINDER_HORIZON_DAYS): ReminderInput[] {
  const today = dayString(now);
  const last = shiftDay(today, horizonDays - 1);
  const client = new Map(data.clients.map((c) => [c.id, c.name]));
  const open = new Map(data.projects.filter((p) => !isClosed(p.status)).map((p) => [p.id, p]));
  const who = (p: Project) => client.get(p.clientId) ?? p.title;
  const reminders: ReminderInput[] = [];
  const push = (ref: string, day: string, title: string, body: string) => {
    if (day < today || day > last) return;
    const at = localInstant(day, REMINDER_TIME);
    if (at <= now) return;
    reminders.push({ ref, fireAt: at.toISOString(), title, body, url: '/#/projets' });
  };

  for (const project of open.values()) {
    if (project.dueDay) {
      const progress = projectProgress(project.id, data.tasks);
      const remaining = progress.total - progress.done;
      if (remaining > 0) {
        push(
          `due:${project.id}:${project.dueDay}`,
          shiftDay(project.dueDay, -DUE_NOTICE_DAYS),
          `🚀 ${who(project)} : mise en ligne après-demain`,
          `${project.title} — ${remaining} tâche${remaining > 1 ? 's' : ''} sur ${progress.total} restent`,
        );
      }
    }
    if (project.waitingFor && project.waitingSince) {
      push(
        `nudge:${project.id}:${project.waitingSince}`,
        shiftDay(project.waitingSince, NUDGE_DAYS),
        `⏳ Relancer ${who(project)}`,
        `Tu attends ${project.waitingFor} depuis une semaine.`,
      );
    }
  }

  for (const payment of data.payments) {
    const project = open.get(payment.projectId);
    if (!project || payment.receivedDay || !payment.expectedDay) continue;
    push(
      `pay:${payment.id}:${payment.expectedDay}`,
      payment.expectedDay,
      `💶 ${payment.label} attendu aujourd’hui`,
      `${who(project)} — ${formatEuros(payment.amountCents)} (${project.title})`,
    );
  }

  return reminders.sort((a, b) => a.fireAt.localeCompare(b.fireAt) || a.ref.localeCompare(b.ref));
}
