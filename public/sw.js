/**
 * Service worker Zénith — offline de base + rappels push.
 *
 * Stratégie de cache :
 * - assets fingerprintés (/assets/…) : cache-first, ils sont immuables ;
 * - navigations : réseau d'abord, dernière version en cache en secours
 *   (l'app s'ouvre dans le métro, les données locales font le reste) ;
 * - tout le reste (Supabase, etc.) : jamais intercepté.
 */
const CACHE = 'zenith-v2';

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

/* =====================================================================
 * Rappels push
 *
 * iOS n'affiche une notification que si le service worker en montre une
 * pour CHAQUE message reçu — pas de push silencieux toléré. On garde donc
 * un texte de repli si la charge utile est vide ou illisible.
 * ===================================================================== */

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Zénith';
  const options = {
    body: payload.body || "Une action aujourd'hui, et la série continue.",
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    // Un même tag remplace la notification précédente au lieu d'empiler.
    tag: payload.tag || 'zenith',
    renotify: true,
    data: { url: payload.url || '/' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href;

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      // Si l'app est déjà ouverte quelque part, on la ramène au premier plan
      // plutôt que d'ouvrir un deuxième onglet.
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          await client.focus();
          if ('navigate' in client && client.url !== target) await client.navigate(target);
          return;
        }
      }
      await self.clients.openWindow(target);
    })(),
  );
});
