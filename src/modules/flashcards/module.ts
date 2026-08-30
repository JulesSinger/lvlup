import type { AtlasModule } from '../../core/lib/module';
import { FlashcardsScreen } from './FlashcardsScreen';
import { flashcardsStore } from './data';

/**
 * Déclaration du module flashcards.
 *
 * Étape 1 (docs/etude-flashcards.md §9) : paquets et cartes se stockent,
 * dans les deux modes, mais aucun écran réel n'existe encore. Orbite n'a
 * aucune sauvegarde antérieure à relire : c'est un module neuf, pas une
 * extraction d'un format à plat existant, donc pas de `fromLegacyBackup`.
 */
export const flashcardsModule: AtlasModule = {
  id: 'flashcards',
  label: 'Orbite',
  emoji: '🪐',
  data: flashcardsStore,
  Screen: FlashcardsScreen,
};
