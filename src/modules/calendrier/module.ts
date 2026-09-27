import type { AtlasModule } from '../../core/lib/module';
import { CalendarScreen } from './CalendarScreen';
import { EclipseLandingPreview } from './components/EclipseLandingPreview';
import { calendarStore } from './data';

/**
 * Déclaration du module calendrier.
 *
 * Étape 1 (docs/etude-calendrier.md §12) : le module existe, vide — stockage
 * dans les deux modes, un écran signet. Éclipse n'a aucune sauvegarde
 * antérieure à relire : c'est un module neuf, donc pas de `fromLegacyBackup`.
 */
export const calendrierModule: AtlasModule = {
  id: 'calendrier',
  label: 'Éclipse',
  description: 'Calendrier et rendez-vous',
  emoji: '🌒',
  accent: '#c9a0ff',
  data: calendarStore,
  Screen: CalendarScreen,
  LandingPreview: EclipseLandingPreview,
};
