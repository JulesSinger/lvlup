/**
 * « L'onboarding a-t-il déjà été vu ? »
 *
 * Le marqueur était global à l'appareil. Conséquence trouvée à l'usage : créer
 * un compte tout neuf dans un navigateur qui avait déjà servi sautait
 * l'accompagnement — le nouvel utilisateur atterrissait sur un écran vide sans
 * qu'on lui explique ce qu'est un palier. C'est précisément la personne à qui
 * l'accompagnement était destiné.
 *
 * Le marqueur est donc porté par l'utilisateur, pas par le navigateur. Il
 * reste dans le `localStorage` et non en base, pour deux raisons : il doit
 * répondre avant que la moindre requête réseau ait abouti (sinon l'onboarding
 * clignote au démarrage), et une réinstallation sur un nouvel appareil mérite
 * de toute façon un rappel du principe.
 */

/** Ancien marqueur, global à l'appareil. Conservé pour être récupéré une fois. */
const LEGACY_KEY = 'zenith.onboarded';
const PREFIX = 'zenith.onboarded.';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    // Stockage refusé (navigation privée verrouillée, cookies bloqués) :
    // l'onboarding se represente. C'est le bon sens de l'échec.
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Rien à faire : l'onboarding se represente à la prochaine ouverture.
  }
}

export function hasOnboarded(userId: string): boolean {
  return read(PREFIX + userId) === '1';
}

export function markOnboarded(userId: string) {
  write(PREFIX + userId, '1');
}

/**
 * Récupère l'ancien marqueur global au profit du premier utilisateur qui se
 * connecte après la mise à jour.
 *
 * On ne peut pas savoir à qui il appartenait — il n'a jamais porté d'identité.
 * L'attribuer à celui qui arrive est le meilleur pari disponible : dans le cas
 * courant (un seul compte sur cet appareil) c'est exact, et dans le pire des
 * cas quelqu'un revoit l'accompagnement une fois. L'ancien marqueur est retiré
 * pour que ça n'arrive qu'une seule fois.
 */
export function adoptLegacyOnboarding(userId: string): boolean {
  if (read(LEGACY_KEY) !== '1') return false;
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // Si on ne peut pas l'effacer, le marqueur par utilisateur suffit à ce
    // que l'accompagnement ne se represente pas.
  }
  if (hasOnboarded(userId)) return false;
  markOnboarded(userId);
  return true;
}
