/**
 * Les photos, rangées — bibliothèque pure.
 */
import type { FeatPhoto } from './types';

/** Les photos de chaque haut fait, dans leur ordre : la première est la couverture. */
export function photosByFeat(photos: readonly FeatPhoto[]): Map<string, FeatPhoto[]> {
  const map = new Map<string, FeatPhoto[]>();
  for (const photo of photos) {
    const list = map.get(photo.featId) ?? [];
    list.push(photo);
    map.set(photo.featId, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.position - b.position || (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));
  }
  return map;
}

/**
 * Faire d'une photo la couverture : elle passe en tête, les autres gardent
 * leur ordre. Rend les seules positions qui changent.
 */
export function coverPositions(photos: readonly FeatPhoto[], coverId: string): { id: string; position: number }[] {
  const cover = photos.find((p) => p.id === coverId);
  if (!cover) return [];
  const order = [cover, ...photos.filter((p) => p.id !== coverId)];
  return order.map((p, position) => ({ id: p.id, position })).filter(({ id, position }) => photos.find((p) => p.id === id)!.position !== position);
}

/** Le jour d'une date de prise de vue (« 2025-03-02T09:41:07 » → « 2025-03-02 »). */
export const takenDay = (takenAt: string) => takenAt.slice(0, 10);
