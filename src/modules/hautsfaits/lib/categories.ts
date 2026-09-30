/**
 * Ce que chaque catégorie montre : un nom, un emoji, une couleur.
 *
 * Liste fixe (décision du 29/09/2026). La couleur est une couleur d'identité,
 * permise en TypeScript (CLAUDE.md §5) : on la prend dans la palette commune
 * par sa variable, pour qu'elle suive le thème clair.
 */
import type { FeatCategory } from './types';

export interface CategoryInfo {
  label: string;
  emoji: string;
  color: string;
}

export const CATEGORY_INFO: Record<FeatCategory, CategoryInfo> = {
  etudes: { label: 'Études', emoji: '🎓', color: 'var(--sky)' },
  sport: { label: 'Sport', emoji: '🏃', color: 'var(--green)' },
  voyage: { label: 'Voyage', emoji: '✈️', color: 'var(--coral)' },
  chezsoi: { label: 'Chez-soi', emoji: '🔑', color: 'var(--violet)' },
  travail: { label: 'Travail', emoji: '💼', color: 'var(--teal)' },
  proches: { label: 'Famille & amis', emoji: '🫶', color: 'var(--pink)' },
  creation: { label: 'Création', emoji: '🎨', color: 'var(--yellow)' },
  autre: { label: 'Autre', emoji: '⭐', color: 'var(--gray)' },
};
