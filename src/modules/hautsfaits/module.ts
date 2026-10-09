import type { AtlasModule } from '../../core/lib/module';
import { HautsFaitsLandingPreview } from './components/HautsFaitsLandingPreview';
import { hautsFaitsStore } from './data';
import { createCalendarSource } from './data/calendarSource';
import { HautsFaitsScreen } from './HautsFaitsScreen';
import { HautsFaitsSettingsSection } from './HautsFaitsSettingsSection';

/**
 * Déclaration du module Hauts faits.
 *
 * La frise, ses photos, une vie en semaines, la vitrine, et depuis l'étape 6
 * (docs/etude-hauts-faits.md §19) le calque des anniversaires dans Calendar. Module neuf, donc pas de
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
  provides: { calendarSources: [createCalendarSource(hautsFaitsStore)] },
};
