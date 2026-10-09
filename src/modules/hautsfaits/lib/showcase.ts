/**
 * La vitrine — bibliothèque pure (docs/etude-hauts-faits.md §4.5) : un
 * médaillon par haut fait, rangés par catégorie dans l'ordre fixe des
 * catégories, le plus récent d'abord. Une catégorie sans haut fait n'a pas
 * d'étagère : jamais de médaillon vide pour ce qu'on n'a pas fait (§2).
 */
import { sortFeats } from './dates';
import { FEAT_CATEGORIES, type Feat, type FeatCategory } from './types';

export interface Shelf {
  category: FeatCategory;
  feats: Feat[];
}

export function buildShowcase(feats: readonly Feat[]): Shelf[] {
  const sorted = sortFeats(feats, 'desc');
  return FEAT_CATEGORIES.map((category) => ({ category, feats: sorted.filter((f) => f.category === category) })).filter((s) => s.feats.length > 0);
}
