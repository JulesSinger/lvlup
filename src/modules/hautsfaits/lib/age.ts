/**
 * L'âge qu'on avait, et le temps écoulé — bibliothèque pure.
 *
 * Une date imprécise ne permet pas toujours de dire l'âge exact : le brevet
 * « en 2014 », pour quelqu'un né en mars 1999, tombe à 14 ou 15 ans. Plutôt
 * que de deviner, on dit ce qu'on sait : « l'année de tes 15 ans ».
 */
import { MONTHS, periodLastDay } from './dates';
import type { DatePrecision } from './types';

const parts = (day: string) => day.split('-').map(Number) as [number, number, number];

/** Années révolues à ce jour. */
export function ageOn(birthDate: string, day: string): number {
  const [by, bm, bd] = parts(birthDate);
  const [y, m, d] = parts(day);
  return y - by - (m < bm || (m === bm && d < bd) ? 1 : 0);
}

/** L'âge qu'on atteint au cours d'une année (en-tête de la frise : « 2014 · 15 ans »). */
export function ageReachedIn(birthDate: string, year: number): number {
  return year - parts(birthDate)[0];
}

export interface FeatAge {
  years: number;
  /** Faux quand la période englobe un anniversaire : `years` est alors l'âge atteint. */
  exact: boolean;
}

/** L'âge au moment d'un haut fait, ou `null` sans date de naissance ou avant elle. */
export function ageAtFeat(birthDate: string | null, day: string, precision: DatePrecision): FeatAge | null {
  if (!birthDate) return null;
  const last = periodLastDay(day, precision);
  if (last < birthDate) return null;
  const atStart = Math.max(0, ageOn(birthDate, day));
  const atEnd = ageOn(birthDate, last);
  return { years: atEnd, exact: atStart === atEnd };
}

/** « tu avais 18 ans », « le mois de tes 23 ans », « l'année de tes 15 ans ». */
export function ageLabel(age: FeatAge, precision: DatePrecision): string {
  const years = `${age.years} an${age.years > 1 ? 's' : ''}`;
  if (age.exact) return `tu avais ${years}`;
  return precision === 'month' ? `le mois de tes ${years}` : `l’année de tes ${years}`;
}

/**
 * Le temps écoulé, dit comme on le dirait : « il y a 7 ans », « il y a
 * 3 mois », « hier », « cette année ». On ne dit pas plus précis que la
 * date : un haut fait daté d'une année se compte en années.
 */
export function sinceLabel(day: string, precision: DatePrecision, today: string): string {
  const [y, m] = parts(day);
  const [ty, tm] = parts(today);
  if (precision === 'year') {
    const years = ty - y;
    if (years <= 0) return 'cette année';
    return years === 1 ? 'l’an dernier' : `il y a ${years} ans`;
  }
  if (precision === 'month') {
    const months = (ty - y) * 12 + (tm - m);
    if (months <= 0) return 'ce mois-ci';
    if (months < 12) return months === 1 ? 'le mois dernier' : `il y a ${months} mois`;
    const years = Math.floor(months / 12);
    return years === 1 ? 'il y a 1 an' : `il y a ${years} ans`;
  }
  const years = ageOn(day, today);
  if (years >= 1) return years === 1 ? 'il y a 1 an' : `il y a ${years} ans`;
  const [, , d] = parts(day);
  const [, , td] = parts(today);
  const months = (ty - y) * 12 + (tm - m) - (td < d ? 1 : 0);
  if (months >= 1) return `il y a ${months} mois`;
  const days = Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(y, m - 1, d)) / 86_400_000);
  if (days <= 0) return 'aujourd’hui';
  return days === 1 ? 'hier' : `il y a ${days} jours`;
}

/** Pour les messages : le nom du mois d'un jour. */
export const monthName = (day: string) => MONTHS[parts(day)[1] - 1];
