/**
 * Service worker Zénith — offline de base.
 *
 * Stratégie :
 * - assets fingerprintés (/assets/…) : cache-first, ils sont immuables ;
 * - navigations : réseau d'abord, dernière version en cache en secours
 *   (l'app s'ouvre dans le métro, les données locales font le reste) ;
 * - tout le reste (Supabase, etc.) : jamais intercepté.
 */
const CACHE = 'zenith-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })(),
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const response = await fetch(request);
          if (response.ok) cache.put('/index.html', response.clone());
          return response;
        } catch {
          const fallback = await cache.match('/index.html');
          if (fallback) return fallback;
          throw new Error('Hors ligne et aucune version en cache.');
        }
      })(),
    );
  }
});
