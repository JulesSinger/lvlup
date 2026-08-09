import type { AtlasModule } from '../../core/lib/module';
import { goalsStore } from './data';
import type { GoalsBackup } from './data/goalsStore';
import { ZenithScreen } from './ZenithScreen';
import { ZenithSettingsSection } from './ZenithSettingsSection';

/**
 * Déclaration du module objectifs.
 *
 * `id` est technique et figé ; `label` est la marque et se change ici seul.
 */
export const objectifsModule: AtlasModule = {
  id: 'objectifs',
  label: 'Zénith',
  emoji: '▲',
  data: goalsStore,
  Screen: ZenithScreen,
  SettingsSection: ZenithSettingsSection,

  fromLegacyBackup(raw) {
    // Avant la v5, les objectifs occupaient la racine du fichier. Les
    // sauvegardes les plus anciennes n'ont ni check-ins (v1) ni trophées (v2).
    if (!Array.isArray(raw.goals)) return null;
    const backup: GoalsBackup = {
      goals: raw.goals as GoalsBackup['goals'],
      actions: Array.isArray(raw.actions) ? (raw.actions as GoalsBackup['actions']) : [],
      checkins: Array.isArray(raw.checkins) ? (raw.checkins as GoalsBackup['checkins']) : [],
      achievements: Array.isArray(raw.achievements)
        ? (raw.achievements as GoalsBackup['achievements'])
        : [],
    };
    return backup;
  },
};
