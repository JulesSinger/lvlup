/**
 * Rappels push — côté navigateur.
 *
 * Le standard Web Push est le même partout : un abonnement obtenu du
 * navigateur (endpoint + deux clés), stocké côté serveur, qui sert ensuite à
 * chiffrer et livrer les notifications. Le code ci-dessous est donc identique
 * sur iPhone, Android et ordinateur.
 *
 * La seule vraie différence est iOS, et elle est de taille :
 *  · les notifications n'existent QUE si l'app a été ajoutée à l'écran
 *    d'accueil (Safari > Partager > Sur l'écran d'accueil) ;
 *  · il faut iOS 16.4 ou plus ;
 *  · la demande d'autorisation doit partir d'un vrai geste de l'utilisateur —
 *    d'où l'appel depuis un onClick, jamais au chargement.
 *
 * C'est pour ça que `pushStatus()` distingue « pas supporté » de « il faut
 * d'abord installer l'app » : le second cas se répare, et l'app doit le dire.
 */

export type PushAvailability =
  | 'ok' // on peut demander l'autorisation
  | 'needs-install' // iOS, mais l'app n'est pas sur l'écran d'accueil
  | 'unsupported' // navigateur sans Web Push
  | 'no-key'; // VITE_VAPID_PUBLIC_KEY absente du build

export interface PushStatus {
  availability: PushAvailability;
  /** État de l'autorisation navigateur ('default' | 'granted' | 'denied') */
  permission: NotificationPermission | null;
  /** true si CE navigateur est déjà abonné */
  subscribed: boolean;
  /** true si on tourne en mode application installée */
  standalone: boolean;
}

export const VAPID_PUBLIC_KEY: string = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';

/** L'app tourne-t-elle depuis l'écran d'accueil plutôt que dans le navigateur ? */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  // `navigator.standalone` est la version historique d'Apple, toujours la
  // seule fiable sur iPhone.
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches;
}

export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ se présente comme un Mac : le test tactile lève l'ambiguïté.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function supported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function pushStatus(): Promise<PushStatus> {
  const standalone = isStandalone();
  if (!supported()) {
    // Sur iPhone, l'absence de PushManager signifie presque toujours « pas
    // encore installée » plutôt que « jamais possible » : on oriente vers la
    // marche à suivre au lieu d'annoncer une impasse.
    return {
      availability: isIOS() && !standalone ? 'needs-install' : 'unsupported',
      permission: null,
      subscribed: false,
      standalone,
    };
  }
  if (isIOS() && !standalone) {
    return { availability: 'needs-install', permission: null, subscribed: false, standalone };
  }
  if (!VAPID_PUBLIC_KEY) {
    return {
      availability: 'no-key',
      permission: Notification.permission,
      subscribed: false,
      standalone,
    };
  }

  let subscribed = false;
  try {
    const registration = await navigator.serviceWorker.ready;
    subscribed = (await registration.pushManager.getSubscription()) !== null;
  } catch {
    subscribed = false;
  }
  return { availability: 'ok', permission: Notification.permission, subscribed, standalone };
}

/** Clé VAPID base64url → Uint8Array, format attendu par `subscribe()`. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalized);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

function encodeKey(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export interface PushSubscriptionPayload {
  endpoint: string;
  p256dh: string;
  auth: string;
  label: string;
}

/** Nom lisible de l'appareil, pour que les réglages sachent quoi afficher. */
function deviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Appareil';
  const ua = navigator.userAgent;
  const platform = isIOS()
    ? /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
      ? 'iPad'
      : 'iPhone'
    : /Android/.test(ua)
      ? 'Android'
      : /Macintosh/.test(ua)
        ? 'Mac'
        : /Windows/.test(ua)
          ? 'Windows'
          : 'Ordinateur';
  const browser = /CriOS|Chrome/.test(ua)
    ? 'Chrome'
    : /Firefox/.test(ua)
      ? 'Firefox'
      : /Safari/.test(ua)
        ? 'Safari'
        : 'Navigateur';
  return `${platform} · ${browser}`;
}

/**
 * Demande l'autorisation puis abonne ce navigateur.
 * À appeler depuis un gestionnaire de clic — iOS refuse autrement.
 */
export async function subscribeToPush(): Promise<PushSubscriptionPayload> {
  if (!supported()) throw new Error("Ce navigateur ne gère pas les notifications.");
  if (!VAPID_PUBLIC_KEY) {
    throw new Error("Clé de notification absente du build (VITE_VAPID_PUBLIC_KEY).");
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error(
      permission === 'denied'
        ? "Les notifications sont bloquées pour ce site. Réautorise-les dans les réglages du navigateur."
        : 'Autorisation non accordée.',
    );
  }

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    }));

  const json = subscription.toJSON();
  return {
    endpoint: subscription.endpoint,
    p256dh: json.keys?.p256dh ?? encodeKey(subscription.getKey('p256dh')),
    auth: json.keys?.auth ?? encodeKey(subscription.getKey('auth')),
    label: deviceLabel(),
  };
}

/** Désabonne ce navigateur. Renvoie l'endpoint retiré, ou null. */
export async function unsubscribeFromPush(): Promise<string | null> {
  if (!supported()) return null;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return null;
  const { endpoint } = subscription;
  await subscription.unsubscribe();
  return endpoint;
}

/** Décalage entre UTC et l'heure locale, en minutes (Paris l'été : +120). */
export function timezoneOffsetMinutes(): number {
  return -new Date().getTimezoneOffset();
}
