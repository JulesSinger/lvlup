/**
 * Le jeton du raccourci iPhone (docs/etude-sport.md §3.3, §15).
 *
 * Créé sur l'appareil, montré une seule fois, jamais rangé : seule son
 * empreinte SHA-256 part en base (`createToken`). La fonction `sport-import`
 * calcule la même empreinte sur ce que le raccourci lui envoie — même texte,
 * même encodage, même hachage, sinon aucun jeton ne serait jamais reconnu
 * (un test le vérifie sur un exemple connu).
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
/** 40 caractères parmi 62 : environ 238 bits, impossible à deviner. */
const LENGTH = 40;

/** « spt_… » : on reconnaît d'un coup d'œil à quoi sert ce texte collé dans un raccourci. */
export function newImportToken(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  let out = '';
  // Rejet des octets ≥ 248 : 248 = 4 × 62, chaque caractère reste équiprobable.
  while (out.length < LENGTH) {
    for (const b of random(LENGTH * 2)) {
      if (b < 248 && out.length < LENGTH) out += ALPHABET[b % 62];
    }
  }
  return `spt_${out}`;
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
