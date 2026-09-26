import type { AtlasModule } from '../../core/lib/module';
import { AstraLandingPreview } from './components/AstraLandingPreview';
import { BudgetScreen } from './BudgetScreen';
import { budgetStore } from './data';
import { createExpenseService } from './data/expenseService';

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
  description: 'Dépenses et budget',
  emoji: '✦',
  accent: '#9c8cf6',
  data: budgetStore,
  Screen: BudgetScreen,
  LandingPreview: AstraLandingPreview,
  // Astra enregistre les dépenses que d'autres modules lui envoient — les
  // courses terminées de Comète (core/lib/services.ts, 26/09/2026).
  provides: { expenses: createExpenseService(budgetStore) },
};
