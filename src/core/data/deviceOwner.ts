/**
 * À qui appartient ce que l'appareil garde — docs/securite.md §3.
 *
 * Tant qu'Atlas n'avait qu'un utilisateur, un appareil n'avait qu'un compte.
 * Partagé, un téléphone peut voir passer deux comptes : il ne faut alors ni
 * montrer à l'un ce que l'autre a laissé (la copie hors ligne du carnet de
 * recettes, les photos en cache), ni — surtout — **envoyer dans le compte de
 * l'un les écritures que l'autre a faites hors ligne** : la file d'attente
 * (`outbox.ts`) envoie ses opérations au compte connecté, quel qu'il soit.
 *
 * L'appareil retient donc le dernier compte connecté (`atlas.owner.v1`). Quand
 * un autre compte se connecte, chaque file non vide est **mise de côté** sous
 * le nom de son propriétaire — jamais envoyée, jamais effacée : c'est le bug
 * impardonnable (CLAUDE.md §1, règle 3) — et la sienne, s'il en avait laissé
 * une, revient. Les files se reconnaissent à la forme de leur clé
 * (`<module>.outbox.v<n>`, imposée par `createOutbox`) : une file dont le
 * module n'est pas encore chargé est protégée aussi.
 */

export const OWNER_KEY = 'atlas.owner.v1';
export const OUTBOX_KEY_PATTERN = /^[a-z]+\.outbox\.v\d+$/;
const PARKED = '.parked.';

const parkedKey = (key: string, owner: string) => `${key}${PARKED}${owner}`;

function keysOf(storage: Storage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k !== null) keys.push(k);
  }
  return keys;
}

function readOps(storage: Storage, key: string): unknown[] {
  try {
    const parsed = JSON.parse(storage.getItem(key) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Le compte `userId` prend l'appareil. Rend `true` si l'appareil changeait de
 * compte : ce qui y restait de l'autre (copies, caches) est alors à oublier.
 * Appelé avant que le moindre écran de module ne vide sa file.
 */
export function claimDevice(userId: string, storage: Storage | undefined = globalThis.localStorage): boolean {
  if (!storage) return false;
  let previous: string | null = null;
  try {
    previous = storage.getItem(OWNER_KEY);
  } catch {
    return false;
  }
  if (previous === userId) return false;

  const keys = keysOf(storage);
  // 1. Les files en cours appartiennent à l'ancien compte : de côté, à son nom.
  //    Sans propriétaire connu (appareil d'avant ce mécanisme), elles restent :
  //    jusqu'ici, un appareil n'avait qu'un compte, c'est le sien.
  if (previous !== null) {
    for (const key of keys.filter((k) => OUTBOX_KEY_PATTERN.test(k))) {
      const ops = readOps(storage, key);
      if (ops.length === 0) continue;
      const parked = parkedKey(key, previous);
      storage.setItem(parked, JSON.stringify([...readOps(storage, parked), ...ops]));
      storage.removeItem(key);
    }
  }
  // 2. Celles que ce compte avait laissées reviennent, avant tout envoi.
  const mine = keys.filter((k) => k.endsWith(`${PARKED}${userId}`));
  for (const parked of mine) {
    const key = parked.slice(0, -(PARKED.length + userId.length));
    storage.setItem(key, JSON.stringify([...readOps(storage, parked), ...readOps(storage, key)]));
    storage.removeItem(parked);
  }
  storage.setItem(OWNER_KEY, userId);
  return previous !== null;
}

/** Combien d'écritures attendent encore d'être envoyées, toutes files confondues. */
export function pendingWrites(storage: Storage | undefined = globalThis.localStorage): number {
  if (!storage) return 0;
  try {
    return keysOf(storage)
      .filter((k) => OUTBOX_KEY_PATTERN.test(k))
      .reduce((sum, k) => sum + readOps(storage, k).length, 0);
  } catch {
    return 0;
  }
}

/**
 * Oublie ce que l'appareil garde du compte qui part : les photos en cache
 * (Cache API, hors cache de l'app elle-même), puis ce que chaque module
 * déclare (`AtlasModule.forgetDevice`). Les files d'attente ne sont jamais
 * touchées ici : elles partent à la prochaine connexion de leur compte.
 */
export async function forgetDeviceData(hooks: readonly (() => void | Promise<void>)[], appCachePrefix = 'zenith-'): Promise<void> {
  try {
    if (typeof caches !== 'undefined') {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => !n.startsWith(appCachePrefix)).map((n) => caches.delete(n)));
    }
  } catch {
    // Pas de Cache API (navigation privée) : rien à oublier.
  }
  for (const hook of hooks) {
    try {
      await hook();
    } catch {
      // Un module qui n'arrive pas à oublier n'empêche pas les autres.
    }
  }
}
