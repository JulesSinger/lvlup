/**
 * Les types du module Tier lists. Les bornes et les couleurs ont leur pendant
 * dans la migration `2026-11-10-tierlists-tables.sql` : `schema.test.ts`
 * vérifie que les deux disent la même chose (CLAUDE.md §5).
 */

/** Les couleurs d'une rangée : les noms de la palette du socle (`--red`…). */
export const TIER_COLORS = [
  'red',
  'orange',
  'coral',
  'peach',
  'yellow',
  'lime',
  'green',
  'teal',
  'sky',
  'blue',
  'indigo',
  'violet',
  'lavender',
  'pink',
  'gray',
] as const;
export type TierColor = (typeof TIER_COLORS)[number];

export const LIST_TITLE_MAX = 80;
export const LIST_DESCRIPTION_MAX = 500;
export const TIER_LABEL_MAX = 12;
export const TIERS_MAX = 20;
export const ITEM_LABEL_MAX = 120;

/** Taille des images d'un élément, réduites dans le navigateur. */
export const IMAGE_SIZES = { full: 900, thumb: 240 } as const;

export interface TierList {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface TierListInput {
  title: string;
  description?: string;
}

export interface Tier {
  id: string;
  listId: string;
  label: string;
  color: TierColor;
  position: number;
}

export interface TierInput {
  listId: string;
  label: string;
  color: TierColor;
  position: number;
}

export type TierPatch = Partial<Pick<Tier, 'label' | 'color' | 'position'>>;

/** L'image d'un élément : deux fichiers, l'image et sa vignette. */
export interface ItemImage {
  path: string;
  thumbPath: string;
  width: number;
  height: number;
}

export interface TierItem {
  id: string;
  listId: string;
  /** La rangée ; `null` : la réserve, ce qui n'est pas encore classé. */
  tierId: string | null;
  label: string;
  image: ItemImage | null;
  position: number;
  createdAt: string;
}

export interface ItemInput {
  listId: string;
  tierId: string | null;
  label: string;
  position: number;
}

/** Un élément déplacé : sa rangée (ou la réserve) et sa place dedans. */
export interface ItemMove {
  id: string;
  tierId: string | null;
  position: number;
}
