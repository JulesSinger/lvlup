import type { AtlasModule } from '../../core/lib/module';
import { CometeLandingPreview } from './components/CometeLandingPreview';
import { CoursesScreen } from './CoursesScreen';
import { coursesStore } from './data';

/**
 * Déclaration du module courses.
 *
 * Étape 1 (docs/etude-courses.md §12) : le module existe, vide — stockage
 * dans les deux modes, un écran signet. Comète n'a aucune sauvegarde
 * antérieure à relire : c'est un module neuf, donc pas de `fromLegacyBackup`.
 */
export const coursesModule: AtlasModule = {
  id: 'courses',
  label: 'Comète',
  description: 'Liste de courses et ce qu’elles coûtent',
  emoji: '☄️',
  accent: '#6fb6ff',
  data: coursesStore,
  Screen: CoursesScreen,
  LandingPreview: CometeLandingPreview,
};
