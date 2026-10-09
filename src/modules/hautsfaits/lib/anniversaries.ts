/**
 * Les anniversaires des hauts faits — bibliothèque pure (docs/etude-hauts-faits.md
 * §7, étape 6) : le calque de Calendar et le rappel « Ce jour-là ».
 *
 * Seuls les hauts faits datés au JOUR ont un anniversaire : daté au mois, on
 * ne sait pas quel jour le marquer (le bandeau « Ce jour-là » le rappelle
 * tout le mois, cela suffit) ; daté à l'année, encore moins. Comme le
 * bandeau, un 29 février revient le 28 les années qui n'en ont pas.
 */
import type { ReminderInput } from '../../../core/data/coreStore';
import type { CalendarMark } from '../../../core/lib/services';
import { dayString, shiftDay } from '../../../core/lib/day';
import type { Feat } from './types';

export interface Anniversary {
  feat: Feat;
  /** AAAA-MM-JJ, le jour où il revient. */
  day: string;
  years: number;
}

const pad = (n: number) => String(n).padStart(2, '0');
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Les anniversaires tombant entre `from` et `to`, inclus, dans l'ordre des jours. */
export function anniversariesBetween(feats: readonly Feat[], from: string, to: string): Anniversary[] {
  const first = Number(from.slice(0, 4));
  const last = Number(to.slice(0, 4));
  const found: Anniversary[] = [];
  for (const feat of feats) {
    if (feat.datePrecision !== 'day') continue;
    const [y, m, d] = feat.dateStart.split('-').map(Number);
    for (let year = Math.max(first, y + 1); year <= last; year++) {
      const dd = m === 2 && d === 29 && !isLeap(year) ? 28 : d;
      const day = `${year}-${pad(m)}-${pad(dd)}`;
      if (day >= from && day <= to) found.push({ feat, day, years: year - y });
    }
  }
  return found.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.years - b.years));
}

const yearsLabel = (years: number) => (years === 1 ? '1 an' : `${years} ans`);

/** Le calque de Calendar : une marque d'une journée par anniversaire, qui ouvre le haut fait. */
export function anniversaryMarks(feats: readonly Feat[], from: string, to: string): CalendarMark[] {
  return anniversariesBetween(feats, from, to).map(({ feat, day, years }) => ({
    id: `feat:${feat.id}:${day.slice(0, 4)}`,
    day,
    title: `${feat.title} · ${yearsLabel(years)}`,
    detail: `Il y a ${yearsLabel(years)}`,
    link: `feat:${feat.id}`,
  }));
}

export const REMINDER_HORIZON_DAYS = 30;
export const REMINDER_TIME = '09:00';

/**
 * Le rappel « Ce jour-là » (coupé par défaut, étude §4.4) : le matin à 9 h,
 * pour chaque anniversaire des trente prochains jours. Rien si le réglage est
 * coupé : déclarer une liste vide retire ce qui était prévu.
 */
export function plannedReminders(feats: readonly Feat[], enabled: boolean, now: Date, horizonDays = REMINDER_HORIZON_DAYS): ReminderInput[] {
  if (!enabled) return [];
  const today = dayString(now);
  const reminders: ReminderInput[] = [];
  for (const { feat, day, years } of anniversariesBetween(feats, today, shiftDay(today, horizonDays - 1))) {
    const [y, m, d] = day.split('-').map(Number);
    const [h, min] = REMINDER_TIME.split(':').map(Number);
    const at = new Date(y, m - 1, d, h, min);
    if (at <= now) continue;
    reminders.push({
      ref: `feat:${feat.id}:${day}`,
      fireAt: at.toISOString(),
      title: `✨ Ce jour-là, il y a ${yearsLabel(years)}`,
      body: feat.title,
      url: '/#/hautsfaits',
    });
  }
  return reminders;
}
