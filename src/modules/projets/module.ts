import type { AtlasModule } from '../../core/lib/module';
import { ProjetsLandingPreview } from './components/ProjetsLandingPreview';
import { projetsStore } from './data';
import { createCalendarSource } from './data/calendarSource';
import { syncReminders } from './data/syncReminders';
import { ProjetsScreen } from './ProjetsScreen';

/**
 * Déclaration du module Projets — les projets clients d'un freelance
 * (docs/etude-projets.md).
 *
 * Module neuf, donc pas de `fromLegacyBackup`. Couleur : le bleu de la
 * palette (`--blue`), la seule teinte qu'aucun module ne portait encore
 * (étude §9).
 */
export const projetsModule: AtlasModule = {
  id: 'projets',
  label: 'Projets',
  description: 'Tes projets clients, leurs chantiers et leurs échéances',
  emoji: '💼',
  accent: '#6fa8f5',
  data: projetsStore,
  Screen: ProjetsScreen,
  // Les dates des projets en calque dans Calendar, cochables et déplaçables (étape 6) ;
  // un geste dans le calendrier recalcule les rappels, comme dans l'écran.
  provides: { calendarSources: [createCalendarSource(projetsStore, () => syncReminders())] },
  LandingPreview: ProjetsLandingPreview,
};
