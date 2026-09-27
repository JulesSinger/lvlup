/**
 * Une série dite en toutes lettres — bibliothèque pure, pour l'écran
 * (étape 4) : « Toutes les 2 semaines le mardi et le jeudi, jusqu'au
 * 31 décembre 2026 ».
 */
import { weekday } from './day';
import type { Recurrence } from './types';

const DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTH_NAMES = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** « le mardi », « le mardi et le jeudi », « le lundi, le mardi et le jeudi » — dans l'ordre de la semaine, lundi d'abord. */
function weekdaysText(days: number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const names = sorted.map((d) => `le ${DAY_NAMES[d]}`);
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}`;
}

function dateText(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return `${d === 1 ? '1er' : d} ${MONTH_NAMES[m - 1]} ${y}`;
}

export function describeRecurrence(rule: Recurrence, startDay: string): string {
  const n = rule.interval > 1 ? rule.interval : 1;
  const [, month, dayOfMonth] = startDay.split('-').map(Number);
  let text: string;
  switch (rule.freq) {
    case 'daily':
      text = n === 1 ? 'Tous les jours' : `Tous les ${n} jours`;
      break;
    case 'weekly': {
      const days = rule.byWeekday && rule.byWeekday.length > 0 ? rule.byWeekday : [weekday(startDay)];
      text = `${n === 1 ? 'Toutes les semaines' : `Toutes les ${n} semaines`} ${weekdaysText(days)}`;
      break;
    }
    case 'monthly':
      text = `${n === 1 ? 'Tous les mois' : `Tous les ${n} mois`} le ${dayOfMonth === 1 ? '1er' : dayOfMonth}`;
      break;
    case 'yearly':
      text = `${n === 1 ? 'Tous les ans' : `Tous les ${n} ans`} le ${dayOfMonth === 1 ? '1er' : dayOfMonth} ${MONTH_NAMES[month - 1]}`;
      break;
  }
  if (rule.until) return `${text}, jusqu’au ${dateText(rule.until)}`;
  if (rule.count) return `${text}, ${rule.count} fois`;
  return text;
}
