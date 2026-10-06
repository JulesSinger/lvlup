import { readExifDate } from '../../lib/exif';
import { fitWithin, type PreparedImage } from '../../lib/images';

/**
 * Réduire une photo dans le navigateur, avant tout envoi
 * (docs/etude-hauts-faits.md §5.2).
 *
 * Une photo de téléphone pèse 3 à 5 Mo ; on en garde une grande version
 * (2 048 px) et une miniature, en JPEG. Le ré-encodage retire au passage
 * toutes les métadonnées, dont la position GPS : c'est voulu. La date de
 * prise de vue, elle, est lue AVANT, pour pouvoir la proposer.
 *
 * Safari sur iPhone fournit déjà du JPEG pour une photo HEIC choisie dans la
 * photothèque. Un navigateur d'ordinateur qui ne sait pas lire le fichier
 * (un HEIC sur Chrome) le dit en toutes lettres.
 *
 * Remonté de Hauts faits au socle le 2026-10-06 : chaque module choisit ses
 * tailles (`full`, `thumb`, en pixels sur le grand côté).
 */
export async function prepareImage(file: File, sizes: { full: number; thumb: number }): Promise<PreparedImage> {
  const takenAt = readExifDate(await file.arrayBuffer());
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(`« ${file.name} » n’est pas une image que ce navigateur sait lire.`);
  }
  try {
    const full = await encode(bitmap, sizes.full, 0.82);
    const thumb = await encode(bitmap, sizes.thumb, 0.8);
    return { full: full.blob, thumb: thumb.blob, width: full.width, height: full.height, takenAt };
  } finally {
    bitmap.close();
  }
}

async function encode(bitmap: ImageBitmap, max: number, quality: number): Promise<{ blob: Blob; width: number; height: number }> {
  const { width, height } = fitWithin(bitmap.width, bitmap.height, max);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Le navigateur refuse de préparer la photo.');
  // Un PNG transparent deviendrait noir en JPEG : fond blanc d'abord.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new Error('Le navigateur refuse de préparer la photo.');
  return { blob, width, height };
}
