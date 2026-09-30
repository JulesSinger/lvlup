/**
 * La frise, mise en lignes — bibliothèque pure (docs/etude-hauts-faits.md §4.1).
 *
 * L'écran ne fait que dessiner ce que rend `buildTimeline` : une ligne par
 * année qui a des hauts faits (avec l'âge atteint cette année-là), les
 * hauts faits de l'année, et une ligne `gap` qui resserre les années vides
 * au lieu de laisser des trous.
 */
import { ageReachedIn } from './age';
import { featYear, sortFeats } from './dates';
import type { Feat, FeatCategory } from './types';

export type TimelineRow =
  | { kind: 'year'; year: number; age: number | null }
  | { kind: 'gap'; from: number; to: number }
  | { kind: 'feat'; feat: Feat };

export interface TimelineOptions {
  order?: 'desc' | 'asc';
  birthDate?: string | null;
  /** Filtre par catégorie ; `null` = tout. */
  category?: FeatCategory | null;
}

export function buildTimeline(feats: readonly Feat[], options: TimelineOptions = {}): TimelineRow[] {
  const { order = 'desc', birthDate = null, category = null } = options;
  const shown = sortFeats(
    feats.filter((f) => !category || f.category === category),
    order,
  );
  const rows: TimelineRow[] = [];
  let previous: number | null = null;
  for (const feat of shown) {
    const year = featYear(feat);
    if (year !== previous) {
      if (previous !== null && Math.abs(year - previous) > 1) {
        const step = order === 'desc' ? -1 : 1;
        const a = previous + step;
        const b = year - step;
        rows.push({ kind: 'gap', from: Math.min(a, b), to: Math.max(a, b) });
      }
      const age = birthDate ? ageReachedIn(birthDate, year) : null;
      rows.push({ kind: 'year', year, age: age !== null && age >= 0 ? age : null });
      previous = year;
    }
    rows.push({ kind: 'feat', feat });
  }
  return rows;
}

/** « 2015 – 2016 », ou « 2015 » pour une seule année vide. */
export const gapLabel = (row: { from: number; to: number }) => (row.from === row.to ? String(row.from) : `${row.from} – ${row.to}`);
