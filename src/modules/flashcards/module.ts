import type { AtlasModule } from '../../core/lib/module';
import { FlashcardsScreen } from './FlashcardsScreen';
import { flashcardsStore } from './data';

/**
 * Déclaration du module flashcards.
 *
 * Étape 5 (docs/etude-flashcards.md §9) : « le module devient utilisable
 * seul, la V1 est atteinte » — l'écran de révision enchaîne les cartes
 * dues, recto puis verso, juste ou faux. Les statistiques arrivent à
 * l'étape suivante. Orbite n'a aucune sauvegarde antérieure à relire :
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
