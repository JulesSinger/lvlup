import type { AtlasModule } from '../../core/lib/module';
import { RecettesLandingPreview } from './components/RecettesLandingPreview';
import { recettesStore } from './data';
import { recettesDemo } from './demo';
import { createCalendarSource } from './data/calendarSource';
import { forgetOfflineCopy } from './data/offlineCopy';
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
  // La démo (15/10/2026) : des exemples et une visite, proposées à la première ouverture.
  demo: recettesDemo,
  provides: { calendarSources: [createCalendarSource(recettesStore)] },
  // La copie du carnet pour le lire sans réseau : celle du compte qui part.
  forgetDevice: () => forgetOfflineCopy(),
};
