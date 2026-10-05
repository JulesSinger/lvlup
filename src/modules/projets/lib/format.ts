/**
 * Les dates dites en français — bibliothèque pure.
 */
import { daysBetween } from '../../../core/lib/day';

const SHORT_MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const SHORT_DAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

/** « 6 oct. », avec l'année si elle n'est pas celle de `today`. */
export function shortDate(day: string, today: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const year = day.slice(0, 4) === today.slice(0, 4) ? '' : ` ${y}`;
  return `${d === 1 ? '1er' : d} ${SHORT_MONTHS[m - 1]}${year}`;
}

/**
 * Un jour proche dit simplement : « aujourd'hui », « demain », « hier »,
 * « jeu. 8 » dans la semaine qui vient, sinon la date courte.
 */
export function dayLabel(day: string, today: string): string {
  const diff = daysBetween(today, day);
  if (diff === 0) return 'aujourd’hui';
  if (diff === 1) return 'demain';
  if (diff === -1) return 'hier';
  if (diff > 1 && diff < 7) {
    const [y, m, d] = day.split('-').map(Number);
    return `${SHORT_DAYS[new Date(y, m - 1, d).getDay()]} ${d}`;
  }
  return shortDate(day, today);
}

/** Jusqu'à l'échéance : « dans 5 j », « aujourd'hui », « dépassée de 3 j ». */
export function dueLabel(daysLeft: number): string {
  if (daysLeft === 0) return 'aujourd’hui';
  if (daysLeft > 0) return `dans ${daysLeft} j`;
  return `dépassée de ${-daysLeft} j`;
}

/** « depuis 9 jours », pour une attente. */
export function sinceLabel(days: number): string {
  if (days <= 0) return 'depuis aujourd’hui';
  if (days === 1) return 'depuis hier';
  return `depuis ${days} jours`;
}
