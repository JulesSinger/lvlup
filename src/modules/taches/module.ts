import type { AtlasModule } from '../../core/lib/module';
import { PolarisLandingPreview } from './components/PolarisLandingPreview';
import { tachesStore } from './data';
import { TachesScreen } from './TachesScreen';
import { TachesSettingsSection } from './TachesSettingsSection';

/**
 * Déclaration du module tâches.
 *
 * Étape 1 (docs/etude-taches.md §12) : le module existe, vide — stockage
 * dans les deux modes, un écran signet. Polaris n'a aucune sauvegarde
 * antérieure à relire : c'est un module neuf, donc pas de `fromLegacyBackup`.
 */
export const tachesModule: AtlasModule = {
  id: 'taches',
  label: 'Polaris',
  description: 'Tâches à faire, par jour et par liste',
  emoji: '⭐',
  accent: '#ff9f7a',
  data: tachesStore,
  Screen: TachesScreen,
  // Les rappels (étape 5) : à l'heure des tâches, et le résumé du matin.
  SettingsSection: TachesSettingsSection,
  LandingPreview: PolarisLandingPreview,
};
