/**
 * Chaque photo ne traverse le réseau qu'une fois par appareil
 * (docs/etude-hauts-faits.md §5.4).
 *
 * Un bucket privé se lit par des liens signés qui changent à chaque demande :
 * le cache du service worker ne les reconnaîtrait pas. On garde donc l'image
 * elle-même, dans le Cache API, sous son chemin — qui ne change jamais,
 * puisqu'une photo n'est jamais réécrite. Sans Cache API (navigation privée
 * de certains navigateurs), on télécharge simplement à chaque fois.
 *
 * Le nom du cache est un identifiant de stockage (CLAUDE.md §4).
 */
const CACHE = 'hautsfaits-photos-v1';
const keyOf = (path: string) => new Request(`/__hautsfaits-photo/${encodeURIComponent(path)}`);

async function openCache(): Promise<Cache | null> {
  try {
    return typeof caches === 'undefined' ? null : await caches.open(CACHE);
  } catch {
    return null;
  }
}

export async function cachedBlob(path: string, download: () => Promise<Blob>): Promise<Blob> {
  const cache = await openCache();
  const hit = await cache?.match(keyOf(path));
  if (hit) return hit.blob();
  const blob = await download();
  try {
    await cache?.put(keyOf(path), new Response(blob, { headers: { 'Content-Type': blob.type || 'image/jpeg' } }));
  } catch {
    // Cache plein ou refusé : la photo s'affiche quand même, elle sera retéléchargée.
  }
  return blob;
}

export async function forgetCached(paths: string[]) {
  const cache = await openCache();
  if (!cache) return;
  await Promise.all(paths.map((path) => cache.delete(keyOf(path))));
}
