import { hkdfSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  b64urlDecode,
  b64urlEncode,
  encryptPayload,
  hkdfExpand,
  hkdfExtract,
  normalizeVapidSubject,
  vapidHeader,
} from '../../supabase/functions/send-reminders/webpush.ts';

/**
 * Le chiffrement Web Push est écrit à la main : sans test, c'est le genre de
 * code qui « part » sans erreur et n'arrive jamais. On le vérifie donc de
 * trois façons indépendantes :
 *
 *  1. la dérivation de clés est comparée à l'implémentation HKDF de Node,
 *     écrite par d'autres et éprouvée ;
 *  2. la signature VAPID est re-vérifiée avec la clé publique correspondante ;
 *  3. le message chiffré est déchiffré en refaisant le calcul du côté du
 *     navigateur — un chemin de calcul réellement différent (ECDH dans
 *     l'autre sens), donc une vraie vérification et pas une tautologie.
 */

const utf8 = (s: string) => new TextEncoder().encode(s);

/**
 * WebCrypto attend un `BufferSource` adossé à un `ArrayBuffer` ; TypeScript
 * type `Uint8Array` sur `ArrayBufferLike`, qui inclut `SharedArrayBuffer`.
 * Le décalage est purement déclaratif, d'où ce petit passe-plat.
 */
const bs = (u: Uint8Array): BufferSource => u as unknown as BufferSource;

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

describe('base64url', () => {
  it('fait l’aller-retour sans perte, y compris avec du bourrage', () => {
    for (const length of [1, 2, 3, 16, 32, 65]) {
      const bytes = new Uint8Array(length).map((_, i) => (i * 37 + 11) % 256);
      expect([...b64urlDecode(b64urlEncode(bytes))]).toEqual([...bytes]);
    }
  });

  it('n’émet ni « + », ni « / », ni « = »', () => {
    const bytes = new Uint8Array([251, 255, 190, 254, 0, 1]);
    expect(b64urlEncode(bytes)).not.toMatch(/[+/=]/);
  });
});

describe('HKDF', () => {
  it('donne le même résultat que l’implémentation de Node', async () => {
    const ikm = new Uint8Array(32).fill(0x0b);
    const salt = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const info = utf8('Content-Encoding: aes128gcm\0');

    const mine = await hkdfExpand(await hkdfExtract(salt, ikm), info, 16);
    const node = new Uint8Array(hkdfSync('sha256', ikm, salt, info, 16));
    expect([...mine]).toEqual([...node]);
  });

  it('coïncide aussi sur une sortie de 32 octets et un sel vide', async () => {
    const ikm = new Uint8Array([1, 2, 3, 4, 5]);
    const salt = new Uint8Array(32); // HKDF remplace un sel absent par des zéros
    const info = utf8('WebPush: info\0');

    const mine = await hkdfExpand(await hkdfExtract(salt, ikm), info, 32);
    const node = new Uint8Array(hkdfSync('sha256', ikm, salt, info, 32));
    expect([...mine]).toEqual([...node]);
  });

  it('refuse une sortie plus longue qu’un bloc', async () => {
    await expect(hkdfExpand(new Uint8Array(32), utf8('x'), 33)).rejects.toThrow();
  });
});

/** Paire VAPID générée à la volée, au format attendu par la fonction. */
async function makeVapidKeys() {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return { publicKey: b64urlEncode(raw), privateKey: jwk.d as string, verifyKey: pair.publicKey };
}

describe('normalizeVapidSubject', () => {
  it('laisse intacte une valeur déjà correcte', () => {
    expect(normalizeVapidSubject('mailto:jules@exemple.fr')).toBe('mailto:jules@exemple.fr');
    expect(normalizeVapidSubject('https://zenith.app')).toBe('https://zenith.app');
  });

  it('répare les erreurs de saisie fréquentes', () => {
    expect(normalizeVapidSubject('jules@exemple.fr')).toBe('mailto:jules@exemple.fr');
    expect(normalizeVapidSubject('  mailto:jules@exemple.fr  ')).toBe('mailto:jules@exemple.fr');
    // Valeur collée avec ses guillemets depuis l'interface de Supabase.
    expect(normalizeVapidSubject('"mailto:jules@exemple.fr"')).toBe('mailto:jules@exemple.fr');
    expect(normalizeVapidSubject("'jules@exemple.fr'")).toBe('mailto:jules@exemple.fr');
    expect(normalizeVapidSubject('zenith.app')).toBe('https://zenith.app');
    expect(normalizeVapidSubject('MAILTO:Jules@Exemple.fr')).toBe('MAILTO:Jules@Exemple.fr');
  });

  it('refuse ce qui n’est réparable en rien, en disant ce qu’il a reçu', () => {
    expect(() => normalizeVapidSubject('')).toThrow(/inutilisable/);
    expect(() => normalizeVapidSubject('jules')).toThrow(/inutilisable/);
    expect(() => normalizeVapidSubject('coucou toi')).toThrow(/coucou toi/);
  });
});

describe('VAPID', () => {
  it('produit un en-tête « vapid t=…, k=… » signé et vérifiable', async () => {
    const keys = await makeVapidKeys();
    const header = await vapidHeader(
      'https://web.push.apple.com/abcdef',
      'mailto:jules@exemple.fr',
      keys.publicKey,
      keys.privateKey,
      Date.UTC(2026, 7, 6, 12, 0, 0),
    );

    const match = /^vapid t=([\w-]+\.[\w-]+\.[\w-]+), k=([\w-]+)$/.exec(header);
    expect(match).not.toBeNull();
    const [, jwt, k] = match!;
    expect(k).toBe(keys.publicKey);

    const [head, payload, signature] = jwt.split('.');
    expect(JSON.parse(new TextDecoder().decode(b64urlDecode(head)))).toEqual({
      typ: 'JWT',
      alg: 'ES256',
    });

    const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
    // L'audience doit être l'origine seule, pas l'URL complète de l'abonnement.
    expect(claims.aud).toBe('https://web.push.apple.com');
    expect(claims.sub).toBe('mailto:jules@exemple.fr');
    expect(claims.exp).toBe(Math.floor(Date.UTC(2026, 7, 6, 12, 0, 0) / 1000) + 12 * 3600);

    const valid = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      keys.verifyKey,
      bs(b64urlDecode(signature)),
      bs(utf8(`${head}.${payload}`)),
    );
    expect(valid).toBe(true);
  });

  it('accepte une adresse e-mail nue en lui remettant son schéma', async () => {
    // Erreur humaine la plus fréquente : coller l'adresse sans « mailto: ».
    // La refuser ne servait qu'à faire perdre du temps.
    const keys = await makeVapidKeys();
    const header = await vapidHeader(
      'https://fcm.googleapis.com/x',
      'jules@exemple.fr',
      keys.publicKey,
      keys.privateKey,
    );
    const payload = header.split('.')[1];
    const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
    expect(claims.sub).toBe('mailto:jules@exemple.fr');
  });

  it('signale une clé privée de mauvaise taille plutôt que d’échouer plus loin', async () => {
    const keys = await makeVapidKeys();
    await expect(
      vapidHeader('https://fcm.googleapis.com/x', 'mailto:a@b.fr', keys.publicKey, b64urlEncode(new Uint8Array(16))),
    ).rejects.toThrow(/privée VAPID invalide/);
  });
});

/** Simule l'abonnement d'un navigateur : paire ECDH + secret d'authentification. */
async function makeSubscription() {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])) as CryptoKeyPair;
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(16));
  return { p256dh: b64urlEncode(raw), auth: b64urlEncode(auth), privateKey: pair.privateKey, raw };
}

/** Déchiffrement côté navigateur, écrit indépendamment de l'émetteur. */
async function decryptAsBrowser(
  body: Uint8Array,
  subscription: Awaited<ReturnType<typeof makeSubscription>>,
): Promise<string> {
  const salt = body.slice(0, 16);
  const recordSize = new DataView(body.buffer, body.byteOffset + 16, 4).getUint32(0, false);
  const idLength = body[20];
  const serverPublic = body.slice(21, 21 + idLength);
  const ciphertext = body.slice(21 + idLength);
  expect(recordSize).toBe(4096);
  expect(idLength).toBe(65);

  const serverKey = await crypto.subtle.importKey(
    'raw',
    bs(serverPublic),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: serverKey },
      subscription.privateKey,
      256,
    ),
  );

  const keyInfo = concat(
    utf8('WebPush: info'),
    new Uint8Array([0]),
    subscription.raw,
    serverPublic,
  );
  const ikm = new Uint8Array(
    hkdfSync('sha256', shared, b64urlDecode(subscription.auth), keyInfo, 32),
  );
  const cek = new Uint8Array(hkdfSync('sha256', ikm, salt, utf8('Content-Encoding: aes128gcm\0'), 16));
  const nonce = new Uint8Array(hkdfSync('sha256', ikm, salt, utf8('Content-Encoding: nonce\0'), 12));

  const aesKey = await crypto.subtle.importKey('raw', bs(cek), 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: bs(nonce), tagLength: 128 },
      aesKey,
      bs(ciphertext),
    ),
  );
  // Le dernier octet est le délimiteur de fin d'enregistrement.
  expect(plain[plain.length - 1]).toBe(2);
  return new TextDecoder().decode(plain.slice(0, -1));
}

describe('chiffrement de la charge utile', () => {
  it('produit un message que le navigateur destinataire sait déchiffrer', async () => {
    const subscription = await makeSubscription();
    const message = JSON.stringify({
      title: '🔥 Ta série de 12 jours t’attend',
      body: 'Une seule action suffit à la prolonger.',
      url: '/',
    });

    const { body } = await encryptPayload(message, subscription.p256dh, subscription.auth);
    expect(await decryptAsBrowser(body, subscription)).toBe(message);
  });

  it('respecte la mise en forme d’en-tête de RFC 8188', async () => {
    const subscription = await makeSubscription();
    const { body, salt, serverPublicKey } = await encryptPayload(
      'coucou',
      subscription.p256dh,
      subscription.auth,
    );
    expect([...body.slice(0, 16)]).toEqual([...salt]);
    expect([...body.slice(16, 20)]).toEqual([0, 0, 0x10, 0x00]); // 4096, gros-boutien
    expect(body[20]).toBe(65);
    expect([...body.slice(21, 86)]).toEqual([...serverPublicKey]);
    // « coucou » (6 octets) + délimiteur (1) + étiquette GCM (16) = 23.
    expect(body.length).toBe(86 + 23);
  });

  it('tire un sel différent à chaque envoi', async () => {
    const subscription = await makeSubscription();
    const a = await encryptPayload('x', subscription.p256dh, subscription.auth);
    const b = await encryptPayload('x', subscription.p256dh, subscription.auth);
    expect(b64urlEncode(a.salt)).not.toBe(b64urlEncode(b.salt));
    expect(b64urlEncode(a.serverPublicKey)).not.toBe(b64urlEncode(b.serverPublicKey));
  });

  it('refuse une clé p256dh ou un secret auth de mauvaise taille', async () => {
    const subscription = await makeSubscription();
    await expect(
      encryptPayload('x', b64urlEncode(new Uint8Array(32)), subscription.auth),
    ).rejects.toThrow(/p256dh invalide/);
    await expect(
      encryptPayload('x', subscription.p256dh, b64urlEncode(new Uint8Array(8))),
    ).rejects.toThrow(/auth invalide/);
  });

  it('refuse une charge utile trop longue pour un enregistrement', async () => {
    const subscription = await makeSubscription();
    await expect(
      encryptPayload('x'.repeat(4090), subscription.p256dh, subscription.auth),
    ).rejects.toThrow(/trop longue/);
  });
});
