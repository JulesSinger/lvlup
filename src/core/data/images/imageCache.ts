/**
 * Chaque image ne traverse le réseau qu'une fois par appareil
 * (docs/etude-hauts-faits.md §5.4).
 *
 * Un bucket privé se lit par des liens signés qui changent à chaque demande :
 * le cache du service worker ne les reconnaîtrait pas. On garde donc l'image
 * elle-même, dans le Cache API, sous son chemin — qui ne change jamais,
 * puisqu'une image n'est jamais réécrite. Sans Cache API (navigation privée
 * de certains navigateurs), on télécharge simplement à chaque fois.
 *
 * Remonté de Hauts faits au socle le 2026-10-06 : chaque module a SON cache.
 * Le nom du cache est un identifiant de stockage (CLAUDE.md §4).
 */
export interface ImageCache {
  cachedBlob(path: string, download: () => Promise<Blob>): Promise<Blob>;
  forgetCached(paths: string[]): Promise<void>;
}

/** `prefix` : le faux chemin sous lequel les images sont rangées (« /__hautsfaits-photo/ »). */
export function createImageCache(cacheName: string, prefix: string): ImageCache {
  const keyOf = (path: string) => new Request(`${prefix}${encodeURIComponent(path)}`);

  async function openCache(): Promise<Cache | null> {
    try {
      return typeof caches === 'undefined' ? null : await caches.open(cacheName);
    } catch {
      return null;
    }
  }

  return {
    async cachedBlob(path, download) {
      const cache = await openCache();
      const hit = await cache?.match(keyOf(path));
      if (hit) return hit.blob();
      const blob = await download();
      try {
        await cache?.put(keyOf(path), new Response(blob, { headers: { 'Content-Type': blob.type || 'image/jpeg' } }));
      } catch {
        // Cache plein ou refusé : l'image s'affiche quand même, elle sera retéléchargée.
      }
      return blob;
    },
    async forgetCached(paths) {
      const cache = await openCache();
      if (!cache) return;
      await Promise.all(paths.map((path) => cache.delete(keyOf(path))));
    },
  };
}
