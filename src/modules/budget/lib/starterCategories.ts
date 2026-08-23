import type { BudgetCategoryInput } from './types';

/**
 * Catégories proposées à la création du compte — un premier appartement
 * seul, en France (docs/etude-astra.md §3). Toutes renommables et
 * supprimables : ce ne sont que des valeurs de départ, pas un cadre.
 *
 * L'ordre du tableau devient la `position` d'affichage à la création.
 */
export const STARTER_CATEGORIES: BudgetCategoryInput[] = [
  // --- Fixes -------------------------------------------------------------
  { name: 'Loyer', emoji: '🏠', color: '#6b8cae', kind: 'fixe' },
  { name: 'Charges & copropriété', emoji: '🧾', color: '#7c96b0', kind: 'fixe' },
  { name: 'Électricité / gaz', emoji: '⚡', color: '#e0a94c', kind: 'fixe' },
  { name: 'Internet & mobile', emoji: '📶', color: '#5aa9c9', kind: 'fixe' },
  { name: 'Assurances', emoji: '🛡️', color: '#8f8fd1', kind: 'fixe' },
  { name: 'Abonnements', emoji: '🔁', color: '#b98fd1', kind: 'fixe' },
  { name: 'Transport (forfait)', emoji: '🚌', color: '#6fae8f', kind: 'fixe' },

  // --- Variables -----------------------------------------------------------
  { name: 'Courses', emoji: '🛒', color: '#e0724c', kind: 'variable' },
  { name: 'Restaurants & bars', emoji: '🍽️', color: '#e0895a', kind: 'variable' },
  { name: 'Sorties & loisirs', emoji: '🎉', color: '#d16fa8', kind: 'variable' },
  { name: 'Vêtements', emoji: '👕', color: '#c98fd1', kind: 'variable' },
  { name: 'Santé', emoji: '💊', color: '#4cb6a0', kind: 'variable' },
  { name: 'Maison & équipement', emoji: '🔧', color: '#a0a0a0', kind: 'variable' },
  { name: 'Cadeaux', emoji: '🎁', color: '#e05c8a', kind: 'variable' },
  { name: 'Voyages', emoji: '✈️', color: '#4c9fe0', kind: 'variable' },
  { name: 'Divers', emoji: '🧩', color: '#8a8a8a', kind: 'variable' },

  // --- Revenus -------------------------------------------------------------
  { name: 'Salaire', emoji: '💼', color: '#4cae5c', kind: 'revenu' },
  { name: 'Aides (APL)', emoji: '🏛️', color: '#6fbf7f', kind: 'revenu' },
  { name: 'Remboursements', emoji: '💳', color: '#8fd1a0', kind: 'revenu' },

  // --- Transferts : exclus du camembert, voir docs/etude-astra.md §2 -----
  { name: 'Épargne', emoji: '🏦', color: '#b0b0b0', kind: 'transfert' },
  { name: 'Virements internes', emoji: '🔄', color: '#909090', kind: 'transfert' },
];
