/**
 * Ce que la fonction `recettes-import` accepte d'aller chercher
 * (docs/etude-recettes.md §3.1, §16). Elle lit une page à la demande d'un
 * compte connecté : il ne faut jamais qu'on puisse s'en servir pour atteindre
 * une machine privée (le réseau de Supabase, `localhost`) ni pour télécharger
 * n'importe quoi. Règles pures, testées par Vitest.
 */

/** 2 Mo de page au plus, 5 Mo de photo, 10 secondes, 3 redirections. */
export const MAX_PAGE_BYTES = 2 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const TIMEOUT_MS = 10_000;
export const MAX_REDIRECTS = 3;

/** Une adresse IP privée, locale, ou réservée — IPv4 ou IPv6. */
export function isPrivateIp(ip: string): boolean {
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (v6.includes(':')) {
    if (v6 === '::' || v6 === '::1') return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v6);
    if (mapped) return isPrivateIp(mapped[1]);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v6);
  }
  return false;
}

/**
 * Une adresse qu'on accepte d'aller chercher, ou la raison du refus :
 * `http(s)` seulement, ports par défaut, pas d'identifiants dans l'adresse,
 * pas de `localhost`, pas d'adresse IP privée écrite en clair. (Le nom de
 * domaine est aussi résolu avant l'appel, dans la fonction.)
 */
export function checkUrl(raw: string): { url: URL } | { error: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { error: 'Ce n’est pas une adresse web.' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { error: 'Seules les adresses http(s) se lisent.' };
  if (url.username || url.password) return { error: 'Une adresse avec identifiant n’est pas acceptée.' };
  if (url.port && url.port !== '80' && url.port !== '443') return { error: 'Seuls les ports web habituels sont acceptés.' };
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || !host.includes('.')) {
    return { error: 'Cette adresse n’est pas publique.' };
  }
  if (isPrivateIp(host)) return { error: 'Cette adresse n’est pas publique.' };
  return { url };
}

/** `Uint8Array` → base64, par morceaux (une photo de 5 Mo dépasserait la pile d'un seul appel). */
export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
