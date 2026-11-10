import { ITEM_LABEL_MAX, LIST_DESCRIPTION_MAX, LIST_TITLE_MAX, TIER_COLORS, TIER_LABEL_MAX, type TierColor } from './types';

/** Chaque règle rend la raison d'un refus, ou `null` : les deux stockages et les écrans la partagent. */

export function validateList(input: { title?: string; description?: string }): string | null {
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) return 'Donne un titre à la tier list.';
    if (title.length > LIST_TITLE_MAX) return `Le titre fait ${LIST_TITLE_MAX} caractères au plus.`;
  }
  if (input.description !== undefined && input.description.length > LIST_DESCRIPTION_MAX) {
    return `La description fait ${LIST_DESCRIPTION_MAX} caractères au plus.`;
  }
  return null;
}

export function validateTier(input: { label?: string; color?: string }): string | null {
  if (input.label !== undefined) {
    const label = input.label.trim();
    if (!label) return 'Donne un nom à la rangée (S, A, « Top »…).';
    if (label.length > TIER_LABEL_MAX) return `Le nom d’une rangée fait ${TIER_LABEL_MAX} caractères au plus.`;
  }
  if (input.color !== undefined && !(TIER_COLORS as readonly string[]).includes(input.color)) return 'Cette couleur n’existe pas.';
  return null;
}

/** Un élément est un texte, une image, ou les deux : jamais rien. */
export function validateItem(input: { label?: string }, hasImage: boolean): string | null {
  const label = (input.label ?? '').trim();
  if (!label && !hasImage) return 'Écris quelque chose ou ajoute une image.';
  if (label.length > ITEM_LABEL_MAX) return `Un élément fait ${ITEM_LABEL_MAX} caractères au plus.`;
  return null;
}

export const isTierColor = (value: unknown): value is TierColor => (TIER_COLORS as readonly unknown[]).includes(value);
