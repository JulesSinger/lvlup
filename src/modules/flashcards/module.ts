import type { AtlasModule } from '../../core/lib/module';
import { FlashcardsScreen } from './FlashcardsScreen';
import { flashcardsStore } from './data';

/**
 * Déclaration du module flashcards.
 *
 * Étape 3 (docs/etude-flashcards.md §9) : le contenu d'un paquet — créer,
 * éditer, supprimer des cartes. Moteur de révision et statistiques arrivent
 * aux étapes suivantes. Orbite n'a aucune sauvegarde antérieure à relire :
 * c'est un module neuf, pas une extraction d'un format à plat existant,
 * donc pas de `fromLegacyBackup`.
 */
export const flashcardsModule: AtlasModule = {
  id: 'flashcards',
  label: 'Orbite',
  emoji: '🪐',
  data: flashcardsStore,
  Screen: FlashcardsScreen,
};
