import type { Settings } from './coreStore';

/**
 * Les réglages d'Atlas gardés sur l'appareil (09/11/2026), pour l'ouvrir sans
 * réseau tel qu'on l'a rangé — modules affichés, ordre, mode travail — au lieu
 * d'un message d'erreur et des réglages par défaut. Rangés au nom du compte :
 * ceux d'un autre compte ne servent jamais.
 *
 * `atlas.settings.v1` est un identifiant de stockage (CLAUDE.md §4) ; le perdre
 * ne coûte rien : la copie se refait à la prochaine lecture réussie.
 */
export const SETTINGS_COPY_KEY = 'atlas.settings.v1';

export function saveSettingsCopy(userId: string | null, settings: Settings, storage: Storage | undefined = globalThis.localStorage): void {
  if (!userId) return;
  try {
    storage?.setItem(SETTINGS_COPY_KEY, JSON.stringify({ userId, settings }));
  } catch {
    // Stockage plein ou refusé : pas de copie, rien de grave.
  }
}

export function readSettingsCopy(userId: string | null, storage: Storage | undefined = globalThis.localStorage): Settings | null {
  if (!userId) return null;
  try {
    const raw = storage?.getItem(SETTINGS_COPY_KEY);
    if (!raw) return null;
    const copy = JSON.parse(raw) as { userId?: string; settings?: Settings };
    return copy.userId === userId && copy.settings ? copy.settings : null;
  } catch {
    return null;
  }
}
