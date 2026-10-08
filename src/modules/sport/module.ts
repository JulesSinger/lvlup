import type { AtlasModule } from '../../core/lib/module';
import { SportLandingPreview } from './components/SportLandingPreview';
import { sportStore } from './data';
import { createCalendarSource } from './data/calendarSource';
import { syncReminders } from './data/syncReminders';
import { SportScreen } from './SportScreen';

/**
 * Déclaration du module Sport — la course à pied : sorties venues de l'Apple
 * Watch, progression, plan marathon (docs/etude-sport.md).
 *
 * Module neuf, donc pas de `fromLegacyBackup`. Couleur : le rouge de la
 * palette (`--red`), qu'aucun module ne portait encore.
 */
export const sportModule: AtlasModule = {
  id: 'sport',
  label: 'Sport',
  description: 'Tes sorties de course, ta progression et ton plan marathon',
  emoji: '🏃',
  accent: '#ff8b8b',
  data: sportStore,
  Screen: SportScreen,
  LandingPreview: SportLandingPreview,
  provides: { calendarSources: [createCalendarSource(sportStore, () => syncReminders())] },
};
