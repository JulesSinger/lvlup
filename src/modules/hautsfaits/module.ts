import type { AtlasModule } from '../../core/lib/module';
import { HautsFaitsLandingPreview } from './components/HautsFaitsLandingPreview';
import { hautsFaitsStore } from './data';
import { HautsFaitsScreen } from './HautsFaitsScreen';

/**
 * Déclaration du module Hauts faits.
 *
 * Étape 1 (docs/etude-hauts-faits.md §11) : le module existe, vide —
 * stockage dans les deux modes, un écran signet. Module neuf, donc pas de
 * `fromLegacyBackup`. Couleur rose : la seule teinte de la palette qu'aucun
 * module ne portait encore, et l'or aurait prêté à confusion avec Objectifs.
 */
export const hautsfaitsModule: AtlasModule = {
  id: 'hautsfaits',
  label: 'Hauts faits',
  description: 'Les grands moments de ta vie, en frise et en photos',
  emoji: '🏅',
  accent: '#ee88b2',
  data: hautsFaitsStore,
  Screen: HautsFaitsScreen,
  LandingPreview: HautsFaitsLandingPreview,
};
