/**
 * Les images — bibliothèque pure du socle. Remontée de Hauts faits le
 * 2026-10-06, quand Projets est devenu le deuxième module à ranger des images
 * (CLAUDE.md §3 : une pièce dont deux modules ont besoin appartient au socle).
 */

/** Une image réduite dans le navigateur, prête à ranger : grande version et miniature, en JPEG. */
export interface PreparedImage {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
  /** La date de prise de vue lue dans l'EXIF, avant le ré-encodage qui l'efface. */
  takenAt: string | null;
}

export type ImageSize = 'thumb' | 'full';

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
