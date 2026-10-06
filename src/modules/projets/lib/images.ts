/**
 * Les images d'un projet, rangées — bibliothèque pure (docs/etude-projets.md §3.6).
 */
import { PROJECT_IMAGES_MAX, type ProjectImage, type ProjectImageKind } from './types';

export const IMAGE_KIND_LABELS: Record<ProjectImageKind, string> = {
  logo: 'Logo',
  photo: 'Photo',
  maquette: 'Maquette',
};

/** Les images d'un projet : les logos d'abord, puis les photos, puis les maquettes, chacune dans son ordre. */
export function imagesOf(images: readonly ProjectImage[], projectId: string): ProjectImage[] {
  const rank: Record<ProjectImageKind, number> = { logo: 0, photo: 1, maquette: 2 };
  return images
    .filter((i) => i.projectId === projectId)
    .sort((a, b) => rank[a.kind] - rank[b.kind] || a.position - b.position || a.createdAt.localeCompare(b.createdAt));
}

/** Le logo du projet : sa première image de sorte « logo », s'il y en a une. */
export function logoOf(images: readonly ProjectImage[], projectId: string): ProjectImage | null {
  return imagesOf(images, projectId).find((i) => i.kind === 'logo') ?? null;
}

/**
 * Combien d'images on peut encore ajouter, et ce qu'on garde d'une sélection
 * trop grande : les premières, dans l'ordre choisi — dit à l'écran plutôt
 * que refusé en bloc.
 */
export function imageRoom(images: readonly ProjectImage[], projectId: string, wanted: number): { accepted: number; refused: number } {
  const room = Math.max(0, PROJECT_IMAGES_MAX - images.filter((i) => i.projectId === projectId).length);
  const accepted = Math.min(room, wanted);
  return { accepted, refused: wanted - accepted };
}

/** La position d'une nouvelle image : après les autres. */
export const nextImagePosition = (images: readonly ProjectImage[], projectId: string) =>
  images.filter((i) => i.projectId === projectId).reduce((max, i) => Math.max(max, i.position + 1), 0);
