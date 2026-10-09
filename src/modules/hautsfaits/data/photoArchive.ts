import { archiveFolders } from '../lib/archive';
import { hautsFaitsStore } from './index';

/**
 * « Télécharger toutes mes photos » (docs/etude-hauts-faits.md §5.6) : la
 * sauvegarde JSON garde la liste des photos, pas leur contenu ; cette
 * archive, écrite dans le navigateur, en garde une copie. Un dossier par haut
 * fait, nommé par sa date et son titre, les photos dans leur ordre.
 *
 * `fflate` (déjà là pour l'archive Strava de Sport) n'est chargé qu'au clic.
 * Les JPEG sont rangés sans recompression : ils ne gagneraient rien.
 */
export async function buildPhotoArchive(onProgress: (done: number, total: number) => void): Promise<{ blob: Blob; missing: number }> {
  const [{ zipSync }, feats, photos] = await Promise.all([import('fflate'), hautsFaitsStore.listFeats(), hautsFaitsStore.listPhotos()]);
  const folders = archiveFolders(feats);
  const sorted = [...photos].sort((a, b) => (a.featId === b.featId ? a.position - b.position : a.featId < b.featId ? -1 : 1));
  const files: Record<string, [Uint8Array, { level: 0 }]> = {};
  const counters = new Map<string, number>();
  let missing = 0;
  for (const [i, photo] of sorted.entries()) {
    const folder = folders.get(photo.featId);
    try {
      if (!folder) throw new Error('haut fait introuvable');
      const blob = await hautsFaitsStore.photoBlob(photo, 'full');
      const n = (counters.get(photo.featId) ?? 0) + 1;
      counters.set(photo.featId, n);
      files[`Hauts faits/${folder}/${String(n).padStart(2, '0')}.jpg`] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }];
    } catch {
      // Une photo illisible (restaurée ailleurs, retirée du stockage) n'empêche pas les autres.
      missing++;
    }
    onProgress(i + 1, sorted.length);
  }
  return { blob: new Blob([zipSync(files)], { type: 'application/zip' }), missing };
}
