/**
 * Les prix — bibliothèque pure (docs/etude-courses.md §12). Rien n'est
 * stocké en plus de l'historique des courses : le prix d'un article, son
 * évolution et l'estimation d'une liste s'en déduisent.
 *
 * Un prix est celui **d'une ligne** (la quantité achetée ce jour-là), pas
 * d'une unité : la quantité est un texte libre (« 2 », « 1 kg »), qu'on ne
 * sait pas diviser. L'estimation reprend donc le dernier prix de ligne
 * connu — juste si l'on achète à peu près la même chose, ce qui est le cas
 * des articles habituels.
 */
import type { ListEntry, Trip, TripItem } from './types';

export interface PricePoint {
  day: string;
  storeId: string | null;
  storeName: string;
  priceCents: number;
  quantity: string;
  tripNumber: number;
}

/** Les prix payés pour un article, du plus ancien au plus récent. */
export function priceHistory(itemId: string, tripItems: readonly TripItem[], trips: readonly Trip[]): PricePoint[] {
  const tripById = new Map(trips.map((t) => [t.id, t]));
  const points: PricePoint[] = [];
  for (const ti of tripItems) {
    if (ti.itemId !== itemId || ti.priceCents === null) continue;
    const trip = tripById.get(ti.tripId);
    if (!trip) continue;
    points.push({
      day: trip.day,
      storeId: trip.storeId,
      storeName: trip.storeName,
      priceCents: ti.priceCents,
      quantity: ti.quantity,
      tripNumber: trip.number,
    });
  }
  return points.sort((a, b) => a.tripNumber - b.tripNumber);
}

/**
 * Le dernier prix connu d'un article : dans ce magasin s'il y a été acheté,
 * sinon ailleurs (en le disant), sinon aucun.
 */
export function lastPrice(
  itemId: string,
  tripItems: readonly TripItem[],
  trips: readonly Trip[],
  storeId: string | null = null,
): { priceCents: number; sameStore: boolean; storeName: string } | null {
  const history = priceHistory(itemId, tripItems, trips);
  const here = storeId === null ? [] : history.filter((p) => p.storeId === storeId);
  const pick = (here.length > 0 ? here : history).at(-1);
  if (!pick) return null;
  return { priceCents: pick.priceCents, sameStore: here.length > 0, storeName: pick.storeName };
}

export interface ListEstimate {
  totalCents: number;
  /** Lignes dont on connaît un prix */
  known: number;
  /** Lignes jamais achetées avec un prix : l'estimation les ignore, et le dit */
  unknown: number;
}

/**
 * Ce que la liste devrait coûter, d'après les derniers prix — dans le
 * magasin choisi quand on le connaît. Le prix déjà saisi sur une ligne
 * l'emporte sur l'historique.
 */
export function estimateList(
  entries: readonly ListEntry[],
  tripItems: readonly TripItem[],
  trips: readonly Trip[],
  storeId: string | null = null,
): ListEstimate {
  let totalCents = 0;
  let known = 0;
  let unknown = 0;
  for (const entry of entries) {
    const price = entry.priceCents ?? lastPrice(entry.itemId, tripItems, trips, storeId)?.priceCents ?? null;
    if (price === null) {
      unknown += 1;
    } else {
      totalCents += price;
      known += 1;
    }
  }
  return { totalCents, known, unknown };
}

export interface PriceSummary {
  first: PricePoint;
  last: PricePoint;
  minCents: number;
  maxCents: number;
  /** Évolution du premier au dernier prix, en pourcentage entier ; `null` avec un seul prix */
  changePercent: number | null;
}

/**
 * Le résumé d'un historique de prix. L'évolution compare le premier et le
 * dernier prix payés, tous magasins confondus — un changement de magasin
 * peut donc l'expliquer autant qu'une hausse : l'écran montre le magasin de
 * chaque prix à côté.
 */
export function priceSummary(points: readonly PricePoint[]): PriceSummary | null {
  if (points.length === 0) return null;
  const first = points[0];
  const last = points[points.length - 1];
  const cents = points.map((p) => p.priceCents);
  return {
    first,
    last,
    minCents: Math.min(...cents),
    maxCents: Math.max(...cents),
    changePercent:
      points.length < 2 || first.priceCents === 0
        ? null
        : Math.round(((last.priceCents - first.priceCents) / first.priceCents) * 100),
  };
}

/** Les articles dont on connaît au moins un prix, par ordre alphabétique — ceux qu'on peut suivre. */
export function pricedItems<T extends { id: string; name: string }>(items: readonly T[], tripItems: readonly TripItem[]): T[] {
  const priced = new Set(tripItems.filter((ti) => ti.priceCents !== null && ti.itemId).map((ti) => ti.itemId));
  return items.filter((i) => priced.has(i.id)).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}
