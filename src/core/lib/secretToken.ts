/**
 * Un jeton secret, tiré sur l'appareil — remonté de Sport le 11/10/2026, quand
 * le connecteur de Claude en a eu besoin à son tour (CLAUDE.md §3 : une pièce
 * dont deux usages ont besoin appartient au socle).
 *
 * Montré une seule fois, jamais rangé : seule son empreinte SHA-256 part en
 * base. Les fonctions qui le reçoivent (`sport-import`, `atlas-mcp`) calculent
 * la même empreinte — même texte, même encodage, même hachage, sinon aucun
 * jeton ne serait jamais reconnu (un test le vérifie sur un exemple connu).
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
/** 40 caractères parmi 62 : environ 238 bits, impossible à deviner. */
const LENGTH = 40;

/** Le préfixe (« spt_ », « atl_ ») dit d'un coup d'œil à quoi sert le texte. */
export function newSecretToken(prefix: string, random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  let out = '';
  // Rejet des octets ≥ 248 : 248 = 4 × 62, chaque caractère reste équiprobable.
  while (out.length < LENGTH) {
    for (const b of random(LENGTH * 2)) {
      if (b < 248 && out.length < LENGTH) out += ALPHABET[b % 62];
    }
  }
  return `${prefix}${out}`;
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
