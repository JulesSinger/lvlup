/**
 * Les jours de Polaris dits en français — bibliothèque pure (étape 3).
 * « Aujourd'hui », « Demain », « Hier », sinon « mer. 30 sept. » (l'année
 * seulement si ce n'est pas celle d'aujourd'hui).
 */
import { daysBetween, weekday } from '../../../core/lib/day';

const WEEKDAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const WEEKDAYS_LONG = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** « 30 sept. », « 1er oct. 2027 ». */
export function shortDate(day: string, today: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const text = `${d === 1 ? '1er' : d} ${MONTHS[m - 1]}`;
  return y === Number(today.slice(0, 4)) ? text : `${text} ${y}`;
}

/** « Aujourd'hui », « Demain », « Hier », « lundi » dans la semaine qui vient, sinon « mer. 30 sept. ». */
export function dayLabel(day: string, today: string): string {
  const diff = daysBetween(today, day);
  if (diff === 0) return 'Aujourd’hui';
  if (diff === 1) return 'Demain';
  if (diff === -1) return 'Hier';
  if (diff > 1 && diff < 7) return WEEKDAYS_LONG[weekday(day)];
  return `${WEEKDAYS[weekday(day)]} ${shortDate(day, today)}`;
}

/** « 9 h », « 18 h 30 » — l'heure à la française. */
export function timeLabel(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

/** « 1 h 30 », « 45 min », « 2 h » — une durée à la française. */
export function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
}

/** « 15 h – 16 h 30 » avec une durée, « 15 h » sans. */
export function timeRangeLabel(time: string, durationMinutes: number | null): string {
  if (!durationMinutes) return timeLabel(time);
  const [h, m] = time.split(':').map(Number);
  const end = (h * 60 + m + durationMinutes) % 1440;
  return `${timeLabel(time)} – ${timeLabel(`${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`)}`;
}

/** L'échéance : « à faire aujourd'hui », « d'ici demain », « avant le 30 sept. », ou dépassée. */
export function dueLabel(day: string, today: string): string {
  const diff = daysBetween(today, day);
  if (diff < 0) return `échéance dépassée (${shortDate(day, today)})`;
  if (diff === 0) return 'à faire aujourd’hui';
  if (diff === 1) return 'à faire d’ici demain';
  return `avant le ${shortDate(day, today)}`;
}
