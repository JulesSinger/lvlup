/**
 * « Ce jour-là » — bibliothèque pure (docs/etude-hauts-faits.md §4.4).
 *
 * Un haut fait daté au jour revient à sa date, les années suivantes ; daté
 * au mois, il revient tout ce mois-là. Daté d'une année seulement, il ne
 * revient jamais : on ne sait pas quel jour fêter. Une période revient à son
 * début.
 */
import type { Feat } from './types';

export interface OnThisDay {
  feat: Feat;
  /** Nombre d'années écoulées. */
  years: number;
  scope: 'day' | 'month';
}

const parts = (day: string) => day.split('-').map(Number) as [number, number, number];
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/**
 * Ce qui revient aujourd'hui : les dates exactes d'abord, puis les mois ;
 * dans chaque groupe, le plus récent d'abord. Un 29 février revient le
 * 28 les années qui n'en ont pas.
 */
export function onThisDay(feats: readonly Feat[], today: string): OnThisDay[] {
  const [ty, tm, td] = parts(today);
  const found: OnThisDay[] = [];
  for (const feat of feats) {
    const [y, m, d] = parts(feat.dateStart);
    if (y >= ty) continue;
    if (feat.datePrecision === 'day') {
      const sameDay = m === tm && (d === td || (m === 2 && d === 29 && td === 28 && !isLeap(ty)));
      if (sameDay) found.push({ feat, years: ty - y, scope: 'day' });
    } else if (feat.datePrecision === 'month' && m === tm) {
      found.push({ feat, years: ty - y, scope: 'month' });
    }
  }
  return found.sort((a, b) => (a.scope !== b.scope ? (a.scope === 'day' ? -1 : 1) : a.years - b.years));
}

/** « Il y a 3 ans aujourd'hui », « Il y a 6 ans ce mois-ci ». */
export function onThisDayLabel(item: OnThisDay): string {
  const years = item.years === 1 ? '1 an' : `${item.years} ans`;
  return `Il y a ${years} ${item.scope === 'day' ? 'aujourd’hui' : 'ce mois-ci'}`;
}
