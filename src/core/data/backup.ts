import type { AtlasModule } from '../lib/module';
import type { CoreStore, Settings } from './coreStore';

/**
 * Le fichier de sauvegarde.
 *
 * Jusqu'à la v4, tout vivait à plat : `goals`, `actions`, `checkins`… c'est-à-dire
 * les champs d'un seul module, promus au rang de format d'échange. Ajouter un
 * domaine aurait obligé à ajouter des champs frères, et le socle à connaître
 * le vocabulaire de chacun.
 *
 * La v5 range chaque module dans sa propre section, sous son nom technique.
 * Le socle n'y garde que ce qui lui appartient : les réglages.
 */
export const BACKUP_VERSION = 5;

export interface BackupFile {
  version: number;
  settings?: Settings;
  /** Une entrée par module, indexée par son nom technique. */
  modules: Record<string, unknown>;
}

export async function exportBackup(
  modules: readonly AtlasModule[],
  core: Pick<CoreStore, 'getSettings'>,
): Promise<BackupFile> {
  const sections: Record<string, unknown> = {};
  for (const module of modules) sections[module.id] = await module.data.exportData();
  return { version: BACKUP_VERSION, settings: await core.getSettings(), modules: sections };
}

/**
 * Normalise un fichier lu sur le disque, quel que soit son âge.
 *
 * Lève si rien d'exploitable n'y est trouvé — mieux vaut refuser un fichier
 * étranger que d'écraser des données réelles avec du vide.
 */
export function readBackupFile(raw: unknown, modules: readonly AtlasModule[]): BackupFile {
  if (!raw || typeof raw !== 'object') throw new Error('Fichier de sauvegarde non reconnu.');
  const file = raw as Record<string, unknown>;
  const version = typeof file.version === 'number' ? file.version : 0;
  const settings = (file.settings as Settings | undefined) ?? undefined;

  if (version >= BACKUP_VERSION && file.modules && typeof file.modules === 'object') {
    return { version, settings, modules: file.modules as Record<string, unknown> };
  }

  // Format à plat : chaque module vient y chercher ce qui le concerne.
  const sections: Record<string, unknown> = {};
  for (const module of modules) {
    const section = module.fromLegacyBackup?.(file) ?? null;
    if (section !== null) sections[module.id] = section;
  }
  if (Object.keys(sections).length === 0) throw new Error('Fichier de sauvegarde non reconnu.');
  return { version: version || 1, settings, modules: sections };
}

/**
 * Restaure. Les sections d'un module inconnu sont ignorées sans bruit : une
 * sauvegarde faite avec un module de plus doit rester importable.
 */
export async function importBackup(
  file: BackupFile,
  modules: readonly AtlasModule[],
  core: Pick<CoreStore, 'updateSettings'>,
): Promise<void> {
  for (const module of modules) {
    const section = file.modules[module.id];
    if (section !== undefined) await module.data.importData(section);
  }
  if (file.settings) await core.updateSettings(file.settings);
}
