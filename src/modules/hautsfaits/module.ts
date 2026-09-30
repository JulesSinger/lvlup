import type { AtlasModule } from '../../core/lib/module';
import { HautsFaitsLandingPreview } from './components/HautsFaitsLandingPreview';
import { hautsFaitsStore } from './data';
import { HautsFaitsScreen } from './HautsFaitsScreen';
import { HautsFaitsSettingsSection } from './HautsFaitsSettingsSection';

/**
 * Déclaration du module Hauts faits.
 *
 * Étape 3 (docs/etude-hauts-faits.md §11) : la frise, sans photos encore,
 * et la date de naissance dans les réglages. Module neuf, donc pas de
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
  SettingsSection: HautsFaitsSettingsSection,
  LandingPreview: HautsFaitsLandingPreview,
};
