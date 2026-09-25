import type { AtlasModule } from '../../core/lib/module';
import { CeresLandingPreview } from './components/CeresLandingPreview';
import { nutritionStore } from './data';
import { NutritionScreen } from './NutritionScreen';

/**
 * Déclaration du module nutrition.
 *
 * Étape 1 (docs/etude-nutrition.md §10) : le module existe, vide — stockage
 * dans les deux modes, un écran signet. Cérès n'a aucune sauvegarde
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
