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

/** La taille d'une image qui tient dans `max` pixels sur son grand côté, sans jamais l'agrandir. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** « 340 Ko », « 12,4 Mo », « 1,2 Go ». */
export function formatBytes(bytes: number): string {
  if (bytes < 1000 * 1000) return `${Math.max(0, Math.round(bytes / 1000))} Ko`;
  const units = ['Mo', 'Go'];
  let value = bytes / (1000 * 1000);
  let unit = 0;
  if (value >= 1000) {
    value /= 1000;
    unit = 1;
  }
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} ${units[unit]}`;
}

/** Le jour d'une date de prise de vue (« 2025-03-02T09:41:07 » → « 2025-03-02 »). */
export const takenDay = (takenAt: string) => takenAt.slice(0, 10);
