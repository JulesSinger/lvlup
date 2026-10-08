import type { AtlasModule } from '../../core/lib/module';
import { RecettesLandingPreview } from './components/RecettesLandingPreview';
import { recettesStore } from './data';
import { createCalendarSource } from './data/calendarSource';
import { RecettesScreen } from './RecettesScreen';

/**
 * Déclaration du module Recettes — le carnet de recettes, le menu de la
 * semaine, et la liste de courses à la demande (docs/etude-recettes.md).
 *
 * Module neuf, donc pas de `fromLegacyBackup`. Couleur : l'orange de la
 * palette (`--orange`), qu'aucun module ne portait encore.
 */
export const recettesModule: AtlasModule = {
  id: 'recettes',
  label: 'Recettes',
  description: 'Ton carnet de recettes et le menu de la semaine',
  emoji: '🍳',
  accent: '#eba95c',
  data: recettesStore,
  Screen: RecettesScreen,
  LandingPreview: RecettesLandingPreview,
  provides: { calendarSources: [createCalendarSource(recettesStore)] },
};
