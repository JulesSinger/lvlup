import type { AtlasModule } from '../../core/lib/module';
import { CeresLandingPreview } from './components/CeresLandingPreview';
import { nutritionStore } from './data';
import { NutritionScreen } from './NutritionScreen';

/**
 * Déclaration du module nutrition.
 *
 * Étape 3 (docs/etude-nutrition.md §10, §14) : la V1 — le journal du jour,
 * avec la table CIQUAL embarquée pour chercher les aliments. Objectifs,
 * aliments perso et code-barres viennent aux étapes suivantes. Cérès n'a aucune sauvegarde
 * antérieure à relire : c'est un module neuf, donc pas de `fromLegacyBackup`.
 */
export const nutritionModule: AtlasModule = {
  id: 'nutrition',
  label: 'Cérès',
  description: 'Calories et macronutriments',
  emoji: '🌾',
  accent: '#9bd16a',
  data: nutritionStore,
  Screen: NutritionScreen,
  LandingPreview: CeresLandingPreview,
};
