/**
 * La récurrence — bibliothèque pure, commune aux modules qui répètent des
 * choses dans le temps. Écrite pour Éclipse (docs/etude-calendrier.md §14),
 * remontée dans le socle le 27/09/2026 pour Polaris (docs/etude-taches.md
 * §7, §12) : une pièce dont deux modules ont besoin appartient au socle, et
 * un bug corrigé ici l'est pour les deux.
 *
 * Une règle est le sous-ensemble utile de la RRULE (RFC 5545). Le moteur
 * parcourt les jours un à un et demande à chacun « es-tu dans la série ? »,
 * plutôt que de sauter d'occurrence en occurrence. Plus lent en théorie,
 * négligeable pour un usage personnel, et bien plus facile à rendre juste
 * sur les cas piégeux :
 *  · un « 31 de chaque mois » saute les mois sans 31 (comme la RFC 5545 et
 *    Google Agenda), il ne glisse pas au 30 ;
 *  · un « 29 février chaque année » n'a lieu que les années bissextiles ;
 *  · `count` compte les occurrences de la règle depuis le début, exceptions
 *    comprises : supprimer une occurrence n'en ajoute pas une à la fin.
 *
 * Tout est en jours LOCAUX : une série « tous les mardis à 9 h » reste à 9 h
 * après le changement d'heure, puisqu'aucune heure n'est jamais convertie.
 */
import { daysBetween, maxDay, mondayOf, monthsBetween, shiftDay, weekday } from './day';

/**
 * Fréquences de récurrence. Chaque module qui stocke une règle compare ce
 * tableau à la contrainte CHECK de sa table (`schema.test.ts` du module).
 */
export const FREQUENCIES = ['daily', 'weekly', 'monthly', 'yearly'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

/**
 * Une règle de récurrence. `byWeekday` : jours de la semaine, 0 = dimanche
 * … 6 = samedi (convention de `Date.getDay`). `until` (jour inclus) et
 * `count` sont exclusifs ; sans l'un ni l'autre, la série ne finit pas.
 */
export interface Recurrence {
  freq: Frequency;
  /** Tous les N (jours, semaines, mois, ans) ; 1 par défaut */
  interval: number;
  byWeekday?: number[];
  until?: string;
  count?: number;
}

/** Ce dont le moteur a besoin : un jour de départ et, peut-être, une règle. */
export interface Series {
  startDay: string;
  recurrence: Recurrence | null;
}

/** Garde-fou : une série est dépliée au plus sur ce nombre de jours. */
const MAX_SPAN_DAYS = 366 * 30;

/** Le jour appartient-il au motif de la règle ? (sans tenir compte de la fin de série) */
function matches(rule: Recurrence, start: string, day: string): boolean {
  const interval = Math.max(1, rule.interval || 1);
  switch (rule.freq) {
    case 'daily':
      return daysBetween(start, day) % interval === 0;
    case 'weekly': {
      const days = rule.byWeekday && rule.byWeekday.length > 0 ? rule.byWeekday : [weekday(start)];
      if (!days.includes(weekday(day))) return false;
      const weeks = daysBetween(mondayOf(start), mondayOf(day)) / 7;
      return weeks % interval === 0;
    }
    case 'monthly':
      return day.slice(8) === start.slice(8) && monthsBetween(start, day) % interval === 0;
    case 'yearly':
      return day.slice(5) === start.slice(5) && (Number(day.slice(0, 4)) - Number(start.slice(0, 4))) % interval === 0;
  }
}

/**
 * Les jours des occurrences d'une série compris entre `from` et `to`
 * (inclus). Sans règle, il n'y en a qu'un : le jour de départ.
 */
export function ruleDays(series: Series, from: string, to: string): string[] {
  const rule = series.recurrence;
  if (!rule) return series.startDay >= from && series.startDay <= to ? [series.startDay] : [];

  const last = rule.until && rule.until < to ? rule.until : to;
  const days: string[] = [];
  let seen = 0;
  // `count` oblige à compter depuis le début de la série ; sinon, on peut
  // commencer directement à `from`.
  let day = rule.count ? series.startDay : maxDay(series.startDay, from);
  const stop = daysBetween(day, last);
  for (let i = 0; i <= Math.min(stop, MAX_SPAN_DAYS); i++, day = shiftDay(day, 1)) {
    if (!matches(rule, series.startDay, day)) continue;
    seen += 1;
    if (rule.count && seen > rule.count) break;
    if (day >= from) days.push(day);
  }
  return days;
}

/**
 * « Tous les suivants » : couper une série au jour `from`. La série
 * d'origine s'arrête la veille ; la suite repart de `from` avec la même
 * règle — et, si la série comptait ses occurrences, avec celles qui restent.
 * Rend `null` pour l'ancienne partie si `from` est la toute première
 * occurrence (il n'y a alors rien avant).
 */
export function splitSeries(series: Series, from: string): { before: Recurrence | null; after: Recurrence } {
  const rule = series.recurrence as Recurrence;
  const earlier = ruleDays(series, series.startDay, shiftDay(from, -1)).length;
  const { count: _count, until: _until, ...rest } = rule;
  const before: Recurrence | null = earlier === 0 ? null : { ...rest, until: shiftDay(from, -1) };
  const after: Recurrence = { ...rest };
  if (rule.count) after.count = Math.max(1, rule.count - earlier);
  else if (rule.until) after.until = rule.until;
  return { before, after };
}

// --- Validation, en français -------------------------------------------------

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Rend le message de la première règle enfreinte, ou `null` si la règle a du sens. */
export function validateRecurrence(rule: Recurrence, startDay: string): string | null {
  if (!Number.isInteger(rule.interval) || rule.interval < 1 || rule.interval > 99) {
    return 'L’intervalle de répétition doit être un nombre entier entre 1 et 99.';
  }
  if (rule.byWeekday && rule.byWeekday.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
    return 'Jours de la semaine invalides.';
  }
  if (rule.freq === 'weekly' && rule.byWeekday && rule.byWeekday.length === 0) {
    return 'Choisis au moins un jour de la semaine.';
  }
  if (rule.until !== undefined && rule.count !== undefined) {
    return 'Une série finit à une date ou après un nombre de fois, pas les deux.';
  }
  if (rule.until !== undefined && (!DAY.test(rule.until) || rule.until < startDay)) {
    return 'La date de fin de la série doit être après son début.';
  }
  if (rule.count !== undefined && (!Number.isInteger(rule.count) || rule.count < 1 || rule.count > 999)) {
    return 'Le nombre de répétitions doit être un nombre entier entre 1 et 999.';
  }
  return null;
}

// --- En toutes lettres ------------------------------------------------------------

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

/** Une série en toutes lettres : « Toutes les 2 semaines le mardi et le jeudi, jusqu'au 31 décembre 2026 ». */
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
