import type { AtlasModule } from '../../core/lib/module';
import { TierlistsLandingPreview } from './components/TierlistsLandingPreview';
import { tierlistsStore } from './data';
import { TierlistsScreen } from './TierlistsScreen';

/**
 * Déclaration du module Tier lists — créer et remplir des tier lists, du texte
 * ou des images glissés de rangée en rangée (docs/etude-tierlists.md).
 *
 * Module neuf, donc pas de `fromLegacyBackup`. Couleur : le violet de la
 * palette (`--violet`), qu'aucun module ne portait encore.
 */
export const tierlistsModule: AtlasModule = {
  id: 'tierlists',
  label: 'Tier lists',
  description: 'Classe ce que tu veux, de S à D, en glissant',
  emoji: '🏆',
  accent: '#b49af2',
  data: tierlistsStore,
  Screen: TierlistsScreen,
  LandingPreview: TierlistsLandingPreview,
};
