/**
 * Une vie en semaines — bibliothèque pure (docs/etude-hauts-faits.md §4.3).
 *
 * La grille de Tim Urban : une ligne par année de vie, 52 cases par ligne.
 * Une case est repérée par son numéro, `âge × 52 + semaine` ; la semaine se
 * compte depuis l'anniversaire de cette année-là, et les un ou deux jours qui
 * dépassent 52 semaines tombent dans la dernière case : chaque ligne commence
 * pile à un anniversaire, la grille ne dérive jamais.
 *
 * Un haut fait se pose au DÉBUT de sa période, comme il est rangé (« 2014 »
 * dans la case du 1er janvier) ; sa date exacte reste dans son libellé.
 */
import { ageOn } from './age';
import { periodLastDay, sortFeats } from './dates';
import type { Feat } from './types';

export const WEEKS_PER_ROW = 52;
/** La bascule « jusqu'à 90 ans » (décision du 29/09/2026). */
export const LIFE_YEARS = 90;

export type LifeHorizon = 'today' | 'life';

export interface LifeDot {
  index: number;
  /** Plusieurs hauts faits peuvent tomber la même semaine ; le plus récent d'abord. */
  feats: Feat[];
}

export interface LifeBand {
  from: number;
  to: number;
  feat: Feat;
}

export interface LifeWeeks {
  /** Nombre de lignes (années de vie) dessinées. */
  rows: number;
  /** La case de cette semaine ; celles d'avant sont vécues. */
  current: number;
  dots: LifeDot[];
  /** Les périodes, en bandes de cases. */
  bands: LifeBand[];
}

const parts = (day: string) => day.split('-').map(Number) as [number, number, number];
const utc = (day: string) => {
  const [y, m, d] = parts(day);
  return Date.UTC(y, m - 1, d);
};

/** L'anniversaire d'un âge donné ; un 29 février se fête le 28 les autres années. */
function birthday(birthDate: string, age: number): number {
  const [y, m, d] = parts(birthDate);
  const year = y + age;
  const last = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return Date.UTC(year, m - 1, Math.min(d, last));
}

/** La case d'un jour (qui n'est pas avant la naissance). */
export function weekIndex(birthDate: string, day: string): number {
  let age = ageOn(birthDate, day);
  // Né un 29 février : la ligne suivante commence dès le 28 les autres années.
  if (birthday(birthDate, age + 1) <= utc(day)) age += 1;
  const week = Math.floor((utc(day) - birthday(birthDate, age)) / (7 * 86_400_000));
  return age * WEEKS_PER_ROW + Math.min(WEEKS_PER_ROW - 1, week);
}

/** La grille, ou `null` sans date de naissance (ou une naissance à venir). */
export function buildLifeWeeks(feats: readonly Feat[], birthDate: string | null, today: string, horizon: LifeHorizon): LifeWeeks | null {
  if (!birthDate || birthDate > today) return null;
  const current = weekIndex(birthDate, today);
  const lived = Math.floor(current / WEEKS_PER_ROW) + 1;
  const rows = horizon === 'life' ? Math.max(LIFE_YEARS, lived) : lived;
  const cells = rows * WEEKS_PER_ROW;

  const byIndex = new Map<number, Feat[]>();
  const bands: LifeBand[] = [];
  // Du plus ancien au plus récent : une période plus récente se dessine par-dessus.
  for (const feat of sortFeats(feats, 'asc')) {
    if (feat.dateEnd) {
      const last = periodLastDay(feat.dateEnd, feat.dateEndPrecision ?? feat.datePrecision);
      if (last < birthDate) continue;
      const from = weekIndex(birthDate, feat.dateStart < birthDate ? birthDate : feat.dateStart);
      const to = Math.min(cells - 1, weekIndex(birthDate, last));
      if (from < cells) bands.push({ from, to, feat });
    }
    if (feat.dateStart < birthDate) continue;
    const index = weekIndex(birthDate, feat.dateStart);
    if (index >= cells) continue;
    byIndex.set(index, [feat, ...(byIndex.get(index) ?? [])]);
  }
  const dots = [...byIndex.entries()].sort((a, b) => a[0] - b[0]).map(([index, list]) => ({ index, feats: list }));
  return { rows, current, dots, bands };
}

/** « 1 352 semaines vécues », et « sur 4 680 » quand la grille va jusqu'à 90 ans. */
export function livedLabel(weeks: LifeWeeks, horizon: LifeHorizon): string {
  const n = (v: number) => v.toLocaleString('fr-FR');
  const lived = `${n(weeks.current)} semaine${weeks.current > 1 ? 's' : ''} vécue${weeks.current > 1 ? 's' : ''}`;
  return horizon === 'life' ? `${lived} sur ${n(weeks.rows * WEEKS_PER_ROW)}` : lived;
}
