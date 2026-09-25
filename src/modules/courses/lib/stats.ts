/**
 * Les chiffres des courses — bibliothèque pure (docs/etude-courses.md §6).
 * Rien n'est stocké : tout se recalcule depuis les courses, comme le total
 * du mois d'Astra, et ne peut donc pas diverger.
 */
import type { Trip } from './types';

export interface MonthTotal {
  /** « 2026-09 » */
  month: string;
  totalCents: number;
  trips: number;
}

/**
 * Dépense par mois, du plus ancien au plus récent, mois sans course
 * compris entre le premier et le dernier (un mois sans course est un vrai
 * zéro, pas un trou à sauter dans un graphique).
 */
export function monthlyTotals(trips: readonly Trip[]): MonthTotal[] {
  if (trips.length === 0) return [];
  const byMonth = new Map<string, MonthTotal>();
  for (const t of trips) {
    const month = t.day.slice(0, 7);
    const m = byMonth.get(month) ?? { month, totalCents: 0, trips: 0 };
    m.totalCents += t.totalCents;
    m.trips += 1;
    byMonth.set(month, m);
  }
  const months = [...byMonth.keys()].sort();
  const result: MonthTotal[] = [];
  let [y, mo] = months[0].split('-').map(Number);
  const last = months[months.length - 1];
  for (;;) {
    const key = `${y}-${String(mo).padStart(2, '0')}`;
    result.push(byMonth.get(key) ?? { month: key, totalCents: 0, trips: 0 });
    if (key === last) break;
    mo += 1;
    if (mo === 13) {
      mo = 1;
      y += 1;
    }
  }
  return result;
}

/** Le panier moyen, arrondi au centime ; `null` sans course. */
export function averageBasket(trips: readonly Trip[]): number | null {
  if (trips.length === 0) return null;
  return Math.round(trips.reduce((sum, t) => sum + t.totalCents, 0) / trips.length);
}

export interface StoreTotal {
  storeName: string;
  trips: number;
  totalCents: number;
  averageCents: number;
}

/**
 * Par magasin, le plus fréquenté d'abord. Regroupé par nom figé plutôt que
 * par identifiant : une course dont le magasin a été supprimé depuis reste
 * comptée sous son nom. Une course sans magasin tombe sous « Sans magasin ».
 */
export function byStore(trips: readonly Trip[]): StoreTotal[] {
  const groups = new Map<string, { trips: number; totalCents: number }>();
  for (const t of trips) {
    const name = t.storeName.trim() || 'Sans magasin';
    const g = groups.get(name) ?? { trips: 0, totalCents: 0 };
    g.trips += 1;
    g.totalCents += t.totalCents;
    groups.set(name, g);
  }
  return [...groups.entries()]
    .map(([storeName, g]) => ({ storeName, ...g, averageCents: Math.round(g.totalCents / g.trips) }))
    .sort((a, b) => b.trips - a.trips || b.totalCents - a.totalCents);
}
