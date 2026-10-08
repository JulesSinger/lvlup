import type { AtlasModule } from '../../core/lib/module';
import { CometeLandingPreview } from './components/CometeLandingPreview';
import { CoursesScreen } from './CoursesScreen';
import { coursesStore } from './data';
import { createCalendarSource } from './data/calendarSource';
import { createShoppingService } from './data/shoppingService';

/**
 * Déclaration du module courses.
 *
 * Étape 1 (docs/etude-courses.md §12) : le module existe, vide — stockage
 * dans les deux modes, un écran signet. Comète n'a aucune sauvegarde
 * antérieure à relire : c'est un module neuf, donc pas de `fromLegacyBackup`.
 */
export const coursesModule: AtlasModule = {
  id: 'courses',
  label: 'Courses',
  description: 'La liste, le magasin, le prix de chaque article',
  emoji: '🛒',
  accent: '#6fb6ff',
  data: coursesStore,
  Screen: CoursesScreen,
  LandingPreview: CometeLandingPreview,
  // Les courses faites, en calque dans le calendrier (Éclipse).
  provides: { calendarSources: [createCalendarSource(coursesStore)], shopping: createShoppingService(coursesStore) },
};
