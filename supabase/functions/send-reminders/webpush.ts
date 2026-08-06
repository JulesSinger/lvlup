/**
 * Web Push, écrit à la main sur WebCrypto.
 *
 * Pourquoi ne pas prendre la bibliothèque `web-push` de npm ? Parce qu'elle
 * dépend des modules Node (`crypto`, `https`) et que sa compatibilité avec le
 * runtime Deno de Supabase est une inconnue de plus au moment précis où l'on
 * cherche à en supprimer. Tout ce dont on a besoin tient dans WebCrypto, qui
 * est natif ici — et qui se teste, lui, sans déployer quoi que ce soit.
 *
 * Deux spécifications se combinent :
 *  · RFC 8291 — chiffrement du contenu (aes128gcm) avec la clé publique et le
 *    secret d'authentification fournis par le navigateur ;
 *  · RFC 8292 (VAPID) — signature qui prouve au service de push que l'envoi
 *    vient bien de nous.
 */

// ---------------------------------------------------------------- base64url

export function b64urlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const full = padded + '='.repeat((4 - (padded.length % 4)) % 4);
  const binary = atob(full);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

export function b64urlEncode(bytes: Uint8Array | ArrayBuffer): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

const utf8 = (s: string) => new TextEncoder().encode(s);

// ------------------------------------------------------------------- HKDF
// On implémente extract et expand séparément : le schéma de RFC 8291 enchaîne
// deux HKDF distincts, ce que l'API `deriveBits` de WebCrypto ne permet pas
// d'exprimer en une fois.

async function hmac(key: Uint8Array, message: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, message as BufferSource));
}

/** HKDF-Extract : PRK = HMAC(salt, IKM). */
export async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
  return hmac(salt, ikm);
}

/** HKDF-Expand limité à un seul bloc (32 octets max), ce qui suffit ici. */
export async function hkdfExpand(
  prk: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  if (length > 32) throw new Error('hkdfExpand : 32 octets maximum');
  const block = await hmac(prk, concat(info, new Uint8Array([1])));
  return block.slice(0, length);
}

// -------------------------------------------------------------------- VAPID

/** Reconstruit une clé privée ECDSA à partir des clés VAPID (base64url). */
async function importVapidKey(publicKey: string, privateKey: string): Promise<CryptoKey> {
  const pub = b64urlDecode(publicKey);
  if (pub.length !== 65 || pub[0] !== 0x04) {
    throw new Error(
      `Clé publique VAPID invalide : ${pub.length} octets (65 attendus, non compressée).`,
    );
  }
  const d = b64urlDecode(privateKey);
  if (d.length !== 32) {
    throw new Error(`Clé privée VAPID invalide : ${d.length} octets (32 attendus).`);
  }
  return crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      x: b64urlEncode(pub.slice(1, 33)),
      y: b64urlEncode(pub.slice(33, 65)),
      d: b64urlEncode(d),
      ext: true,
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
}

/**
 * Normalise le sujet VAPID.
 *
 * La spécification veut une URI `mailto:` ou `https:`, mais l'erreur humaine
 * la plus fréquente est d'y mettre une adresse e-mail nue — ou de coller la
 * valeur avec ses guillemets. Refuser sèchement dans ces cas-là ne rend
 * service à personne : on répare ce qui est réparable sans ambiguïté, et on
 * n'échoue que sur ce qui est vraiment inutilisable.
 */
export function normalizeVapidSubject(raw: string): string {
  const cleaned = raw.trim().replace(/^["']|["']$/g, '').trim();
  if (/^(mailto:|https:)/i.test(cleaned)) return cleaned;
  // Une adresse e-mail nue : on lui remet son schéma.
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) return `mailto:${cleaned}`;
  // Un domaine ou une URL sans schéma.
  if (/^www\.|^[^\s/]+\.[a-z]{2,}(\/|$)/i.test(cleaned)) return `https://${cleaned}`;
  throw new Error(
    `VAPID_SUBJECT inutilisable (« ${cleaned.slice(0, 24)} ») : mets une adresse e-mail ` +
      'ou une URL, par exemple mailto:toi@exemple.fr',
  );
}

/** En-tête `Authorization: vapid t=…, k=…` pour un endpoint donné. */
export async function vapidHeader(
  endpoint: string,
  subject: string,
  publicKey: string,
  privateKey: string,
  now = Date.now(),
): Promise<string> {
  const normalizedSubject = normalizeVapidSubject(subject);
  const audience = new URL(endpoint).origin;
  const header = b64urlEncode(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const payload = b64urlEncode(
    utf8(
      JSON.stringify({
        aud: audience,
        // 12 h : bien en deçà des 24 h maximum tolérées par les services de push.
        exp: Math.floor(now / 1000) + 12 * 3600,
        sub: normalizedSubject,
      }),
    ),
  );
  const signingInput = utf8(`${header}.${payload}`);
  const key = await importVapidKey(publicKey, privateKey);
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    signingInput as BufferSource,
  );
  return `vapid t=${header}.${payload}.${b64urlEncode(signature)}, k=${publicKey}`;
}

// -------------------------------------------------- chiffrement du contenu

const RECORD_SIZE = 4096;

export interface EncryptedPush {
  body: Uint8Array;
  /** Clé publique éphémère utilisée, exposée pour les tests */
  serverPublicKey: Uint8Array;
  salt: Uint8Array;
}

/**
 * Chiffre la charge utile selon RFC 8291.
 *
 * `salt` et `serverKeys` ne sont là que pour les tests : en production on
 * laisse la fonction tirer un sel aléatoire et une paire de clés éphémère,
 * comme l'exige la spécification.
 */
export async function encryptPayload(
  payload: string,
  uaPublicKey: string,
  authSecret: string,
  options: { salt?: Uint8Array; serverKeys?: CryptoKeyPair } = {},
): Promise<EncryptedPush> {
  const uaPublic = b64urlDecode(uaPublicKey);
  if (uaPublic.length !== 65 || uaPublic[0] !== 0x04) {
    throw new Error(`Clé p256dh invalide : ${uaPublic.length} octets (65 attendus).`);
  }
  const auth = b64urlDecode(authSecret);
  if (auth.length !== 16) {
    throw new Error(`Secret auth invalide : ${auth.length} octets (16 attendus).`);
  }

  const salt = options.salt ?? crypto.getRandomValues(new Uint8Array(16));
  const serverKeys =
    options.serverKeys ??
    ((await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
      'deriveBits',
    ])) as CryptoKeyPair);

  const serverPublicKey = new Uint8Array(
    await crypto.subtle.exportKey('raw', serverKeys.publicKey),
  );

  const uaKey = await crypto.subtle.importKey(
    'raw',
    uaPublic as BufferSource,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, serverKeys.privateKey, 256),
  );

  // Première dérivation : le secret d'authentification lie la clé au couple
  // d'appareils, de sorte qu'un ECDH intercepté ne suffise pas.
  const prkKey = await hkdfExtract(auth, sharedSecret);
  const keyInfo = concat(utf8('WebPush: info'), new Uint8Array([0]), uaPublic, serverPublicKey);
  const ikm = await hkdfExpand(prkKey, keyInfo, 32);

  // Seconde dérivation : clé de chiffrement et nonce, comme dans RFC 8188.
  const prk = await hkdfExtract(salt, ikm);
  const cek = await hkdfExpand(prk, concat(utf8('Content-Encoding: aes128gcm'), new Uint8Array([0])), 16);
  const nonce = await hkdfExpand(prk, concat(utf8('Content-Encoding: nonce'), new Uint8Array([0])), 12);

  const plaintext = utf8(payload);
  if (plaintext.length + 17 > RECORD_SIZE) {
    throw new Error('Charge utile trop longue pour un seul enregistrement.');
  }
  // 0x02 : délimiteur de dernier enregistrement (RFC 8188 §2).
  const padded = concat(plaintext, new Uint8Array([2]));

  const aesKey = await crypto.subtle.importKey('raw', cek as BufferSource, 'AES-GCM', false, [
    'encrypt',
  ]);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce as BufferSource, tagLength: 128 },
      aesKey,
      padded as BufferSource,
    ),
  );

  // En-tête RFC 8188 : sel | taille d'enregistrement | longueur de l'id | id.
  const recordSize = new Uint8Array(4);
  new DataView(recordSize.buffer).setUint32(0, RECORD_SIZE, false);
  const body = concat(
    salt,
    recordSize,
    new Uint8Array([serverPublicKey.length]),
    serverPublicKey,
    ciphertext,
  );

  return { body, serverPublicKey, salt };
}

// ------------------------------------------------------------------- envoi

export interface SendOptions {
  subscription: { endpoint: string; p256dh: string; auth: string };
  payload: string;
  vapid: { publicKey: string; privateKey: string; subject: string };
  ttl?: number;
}

/** Envoie la notification. Renvoie le code HTTP du service de push. */
export async function sendWebPush(options: SendOptions): Promise<number> {
  const { subscription, payload, vapid, ttl = 3600 } = options;
  const { body } = await encryptPayload(payload, subscription.p256dh, subscription.auth);
  const authorization = await vapidHeader(
    subscription.endpoint,
    vapid.subject,
    vapid.publicKey,
    vapid.privateKey,
  );

  const response = await fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      Authorization: authorization,
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttl),
      Urgency: 'normal',
    },
    body: body as BodyInit,
  });

  if (response.status >= 400) {
    // Le corps de la réponse contient souvent la vraie raison (clé VAPID qui
    // ne correspond pas, abonnement expiré…). On la remonte dans le journal.
    const detail = await response.text().catch(() => '');
    console.error('push', response.status, detail.slice(0, 300));
  }
  return response.status;
}
