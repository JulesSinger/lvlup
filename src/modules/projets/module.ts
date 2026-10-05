import type { AtlasModule } from '../../core/lib/module';
import { ProjetsLandingPreview } from './components/ProjetsLandingPreview';
import { projetsStore } from './data';
import { ProjetsScreen } from './ProjetsScreen';

/**
 * Déclaration du module Projets — les projets clients d'un freelance
 * (docs/etude-projets.md).
 *
 * Étape 1 : le stockage et un signet. Module neuf, donc pas de
 * `fromLegacyBackup`. Couleur : le bleu de la palette (`--blue`), la seule
 * teinte qu'aucun module ne portait encore (étude §9).
 */
export const projetsModule: AtlasModule = {
  id: 'projets',
  label: 'Projets',
  description: 'Tes projets clients, leurs chantiers et leurs échéances',
  emoji: '💼',
  accent: '#6fa8f5',
  data: projetsStore,
  Screen: ProjetsScreen,
  LandingPreview: ProjetsLandingPreview,
};
