import type { AtlasModule } from '../../core/lib/module';
import { CalendarScreen } from './CalendarScreen';
import { CalendarSettingsSection } from './CalendarSettingsSection';
import { EclipseLandingPreview } from './components/EclipseLandingPreview';
import { calendarStore } from './data';

/**
 * Déclaration du module calendrier.
 *
 * Étape 3 (docs/etude-calendrier.md §12) : la V1 — quatre vues avec
 * FullCalendar, créer, déplacer, étirer, modifier un événement. Depuis le
 * 01/10/2026, ses rappels par défaut dans les réglages. Éclipse n'a aucune sauvegarde
 * antérieure à relire : c'est un module neuf, donc pas de `fromLegacyBackup`.
 */
export const calendrierModule: AtlasModule = {
  id: 'calendrier',
  label: 'Calendar',
  description: 'Rendez-vous et événements, jour, semaine, mois',
  emoji: '📅',
  accent: '#c9a0ff',
  data: calendarStore,
  Screen: CalendarScreen,
  SettingsSection: CalendarSettingsSection,
  LandingPreview: EclipseLandingPreview,
};
