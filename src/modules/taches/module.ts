import type { AtlasModule } from '../../core/lib/module';
import { PolarisLandingPreview } from './components/PolarisLandingPreview';
import { tachesStore } from './data';
import { CalendarTaskEditor } from './components/CalendarTaskEditor';
import { createCalendarSource } from './data/calendarSource';
import { syncReminders } from './data/syncReminders';
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
  label: 'Tâches',
  description: 'À faire, par jour et par liste',
  emoji: '✅',
  accent: '#ff9f7a',
  data: tachesStore,
  Screen: TachesScreen,
  // Les rappels (étape 5) : à l'heure des tâches, et le résumé du matin.
  SettingsSection: TachesSettingsSection,
  // Les tâches datées en calque dans Éclipse, cochables depuis le calendrier (étape 6) ;
  // une coche y recalcule les rappels, comme dans Polaris. Depuis le 06/10/2026, la
  // fenêtre d'une tâche s'ouvre aussi dans le calendrier, pour la modifier ou en créer une.
  provides: {
    calendarSources: [{ ...createCalendarSource(tachesStore, () => syncReminders()), Editor: CalendarTaskEditor, createLabel: 'Tâche' }],
  },
  LandingPreview: PolarisLandingPreview,
};
