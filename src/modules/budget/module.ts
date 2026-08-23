import type { AtlasModule } from '../../core/lib/module';
import { BudgetScreen } from './BudgetScreen';
import { budgetStore } from './data';

/**
 * Déclaration du module budget.
 *
 * Étape 1 seulement (docs/etude-astra.md §7) : le stockage existe dans les
 * deux modes, l'écran n'est qu'un signet — catégories, saisie, camembert et
 * import viennent aux étapes suivantes. Astra n'a aucune sauvegarde
 * antérieure à relire : c'est un module neuf, pas une extraction d'un
 * format à plat existant, donc pas de `fromLegacyBackup`.
 */
export const budgetModule: AtlasModule = {
  id: 'budget',
  label: 'Astra',
  emoji: '✦',
  data: budgetStore,
  Screen: BudgetScreen,
};
