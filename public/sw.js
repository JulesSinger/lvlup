/**
 * Service worker Zénith — offline de base + rappels push.
 *
 * Stratégie de cache :
 * - assets fingerprintés (/assets/…) : cache-first, ils sont immuables ;
 * - navigations : la page gardée d'abord, le réseau la remet à jour en
 *   arrière-plan (10/11/2026). Avant, le réseau passait d'abord, sans délai
 *   maximum : au fond d'un hypermarché, un réseau qui traîne ou un Wi-Fi à
 *   portail laissait l'app sur un écran noir (essai de Jules à Auchan). Une
 *   nouvelle version se voit donc à l'ouverture suivante ;
 *   une page qui n'est pas celle d'Atlas (le portail d'un Wi-Fi) n'est jamais gardée ;
 * - tout le reste (Supabase, etc.) : jamais intercepté.
 */
// Changer ce nom vide l'ancien cache à l'activation. v3 (2026-09-29) : les
// icônes d'Atlas remplacent celles de Zénith, et /icons/ est servi cache
// d'abord — sans ça, un appareil garderait l'ancienne icône pour toujours.
const CACHE = 'zenith-v3';

/** Une réponse est-elle bien la page d'Atlas, et pas le portail d'un Wi-Fi public ? */
async function isAtlasPage(response) {
  if (!response || !response.ok || response.redirected || response.type === 'opaqueredirect') return false;
  if (!(response.headers.get('content-type') || '').includes('text/html')) return false;
  const text = await response.clone().text();
  return text.includes('id="root"');
}

/** Va chercher la page d'Atlas et la garde, si c'est bien elle. */
async function refreshPage(cache, request) {
  const url = typeof request === 'string' ? request : request.url;
  const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
  if (await isAtlasPage(response)) await cache.put('/index.html', response.clone());
  return response;
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  // La page gardée dès l'installation : la première ouverture sans réseau la trouve.
  event.waitUntil(
    (async () => {
      try {
        await refreshPage(await caches.open(CACHE), '/');
      } catch {
        // Pas de réseau à l'installation : elle sera gardée à la prochaine navigation.
      }
    })(),
  );
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
        const kept = await cache.match('/index.html');
        const fresh = refreshPage(cache, request);
        if (kept) {
          // La page gardée tout de suite ; la mise à jour continue sans faire attendre.
          event.waitUntil(fresh.catch(() => {}));
          return kept;
        }
        // Jamais gardée (toute première ouverture) : le réseau, il n'y a rien d'autre.
        return fresh;
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

  const title = payload.title || 'Atlas';
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
