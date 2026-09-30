/**
 * Les dates d'un haut fait — bibliothèque pure.
 *
 * Une date est un jour `AAAA-MM-JJ` rangé au PREMIER jour de la période
 * qu'elle décrit, avec sa précision : « 2014 » = 2014-01-01 en `year`,
 * « juin 2018 » = 2018-06-01 en `month`. Trier les chaînes suffit donc à
 * trier les hauts faits, et l'affichage ne dit que ce qu'on sait.
 */
import type { DatePrecision, Feat } from './types';

export const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const;

const parts = (day: string) => day.split('-').map(Number) as [number, number, number];
const pad = (n: number) => String(n).padStart(2, '0');

/** Le premier jour de la période : ce que la base exige pour `month` et `year`. */
export function alignDate(day: string, precision: DatePrecision): string {
  const [y, m] = parts(day);
  if (precision === 'year') return `${y}-01-01`;
  if (precision === 'month') return `${y}-${pad(m)}-01`;
  return day;
}

/** Le dernier jour de la période : le 31 décembre d'une année, le dernier jour d'un mois. */
export function periodLastDay(day: string, precision: DatePrecision): string {
  const [y, m] = parts(day);
  if (precision === 'year') return `${y}-12-31`;
  if (precision === 'month') return `${y}-${pad(m)}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`;
  return day;
}

/** « 2014 », « juin 2018 », « 2 mars 2025 », « 1er juillet 2022 ». */
export function formatFeatDate(day: string, precision: DatePrecision): string {
  const [y, m, d] = parts(day);
  if (precision === 'year') return String(y);
  if (precision === 'month') return `${MONTHS[m - 1]} ${y}`;
  return `${d === 1 ? '1er' : d} ${MONTHS[m - 1]} ${y}`;
}

/**
 * La date d'un haut fait, période comprise, sans répéter ce qui est commun
 * aux deux bouts : « janvier – juin 2021 », « 3 – 10 août 2023 »,
 * « septembre 2019 – juillet 2022 », « 2019 – 2022 ».
 */
export function formatFeatSpan(feat: Pick<Feat, 'dateStart' | 'datePrecision' | 'dateEnd' | 'dateEndPrecision'>): string {
  const start = formatFeatDate(feat.dateStart, feat.datePrecision);
  if (!feat.dateEnd) return start;
  const endPrecision = feat.dateEndPrecision ?? feat.datePrecision;
  const end = formatFeatDate(feat.dateEnd, endPrecision);
  if (start === end) return start;
  if (feat.datePrecision !== endPrecision || feat.datePrecision === 'year') return `${start} – ${end}`;
  const [ys, ms, ds] = parts(feat.dateStart);
  const [ye, me] = parts(feat.dateEnd);
  if (ys !== ye) return `${start} – ${end}`;
  if (feat.datePrecision === 'month') return `${MONTHS[ms - 1]} – ${end}`;
  // Au jour près, dans la même année : on ne répète que ce qui change.
  if (ms === me) return `${ds === 1 ? '1er' : ds} – ${end}`;
  return `${ds === 1 ? '1er' : ds} ${MONTHS[ms - 1]} – ${end}`;
}

/** L'année d'un haut fait (celle de son début, pour une période). */
export const featYear = (feat: Pick<Feat, 'dateStart'>) => parts(feat.dateStart)[0];

/**
 * Tri de la frise : le plus récent en haut par défaut (décision du
 * 29/09/2026). Une date imprécise se place au DÉBUT de sa période, comme elle
 * est rangée : « 2022 » vient après les jours connus de 2022 dans l'ordre
 * récent, avant eux dans l'ordre du livre. À début égal, même logique (le
 * moins précis au début de la période), puis l'ordre d'enregistrement, pour
 * que rien ne saute d'une ouverture à l'autre.
 */
const PRECISION_RANK: Record<DatePrecision, number> = { day: 0, month: 1, year: 2 };

export function sortFeats<T extends Pick<Feat, 'dateStart' | 'datePrecision' | 'createdAt'>>(
  feats: readonly T[],
  order: 'desc' | 'asc' = 'desc',
): T[] {
  const sign = order === 'desc' ? -1 : 1;
  return [...feats].sort((a, b) => {
    if (a.dateStart !== b.dateStart) return a.dateStart < b.dateStart ? -sign : sign;
    if (a.datePrecision !== b.datePrecision) return sign * (PRECISION_RANK[b.datePrecision] - PRECISION_RANK[a.datePrecision]);
    return a.createdAt < b.createdAt ? -sign : a.createdAt > b.createdAt ? sign : 0;
  });
}

/**
 * La durée d'une période, bouts compris et pas plus précise que ses dates :
 * « 8 jours » (3 – 10 août), « 6 mois » (janvier – juin), « 3 ans ». Rien
 * pour une période connue à l'année près : « 2019 – 2022 » dure trois ou
 * quatre ans, on ne sait pas.
 */
export function durationLabel(feat: Pick<Feat, 'dateStart' | 'datePrecision' | 'dateEnd' | 'dateEndPrecision'>): string | null {
  if (!feat.dateEnd) return null;
  const endPrecision = feat.dateEndPrecision ?? feat.datePrecision;
  if (feat.datePrecision === 'year' || endPrecision === 'year') return null;
  const [ys, ms, ds] = parts(feat.dateStart);
  const [ye, me, de] = parts(feat.dateEnd);
  if (feat.datePrecision === 'day' && endPrecision === 'day') {
    const days = Math.round((Date.UTC(ye, me - 1, de) - Date.UTC(ys, ms - 1, ds)) / 86_400_000) + 1;
    if (days < 31) return `${days} jours`;
  }
  const months = (ye - ys) * 12 + (me - ms) + 1;
  if (months < 12) return `${months} mois`;
  const years = Math.round(months / 12);
  return years === 1 ? '1 an' : `${years} ans`;
}
