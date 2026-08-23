import type { AtlasModule } from '../../core/lib/module';
import { BudgetScreen } from './BudgetScreen';
import { budgetStore } from './data';

/**
 * Déclaration du module budget.
 *
 * Étape 2 (docs/etude-astra.md §7) : les catégories se créent et s'éditent.
 * Saisie manuelle, liste des opérations, camembert et import viennent aux
 * étapes suivantes. Astra n'a aucune sauvegarde antérieure à relire : c'est
 * un module neuf, pas une extraction d'un format à plat existant, donc pas
 * de `fromLegacyBackup`.
 */
export const budgetModule: AtlasModule = {
  id: 'budget',
  label: 'Astra',
  emoji: '✦',
  data: budgetStore,
  Screen: BudgetScreen,
};
