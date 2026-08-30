import type { AtlasModule } from '../../core/lib/module';
import { FlashcardsScreen } from './FlashcardsScreen';
import { flashcardsStore } from './data';

/**
 * Déclaration du module flashcards.
 *
 * Étape 2 (docs/etude-flashcards.md §9) : les paquets se créent, se
 * renomment, s'archivent. Cartes, moteur de révision et statistiques
 * arrivent aux étapes suivantes. Orbite n'a aucune sauvegarde antérieure à
 * relire : c'est un module neuf, pas une extraction d'un format à plat
 * existant, donc pas de `fromLegacyBackup`.
 */
export const flashcardsModule: AtlasModule = {
  id: 'flashcards',
  label: 'Orbite',
  emoji: '🪐',
  data: flashcardsStore,
  Screen: FlashcardsScreen,
};
