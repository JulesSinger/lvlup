/**
 * La double authentification — règles pures, testées (docs/securite.md §7).
 *
 * Supabase délivre d'abord une session « aal1 » (le mot de passe), puis
 * « aal2 » une fois le code à six chiffres donné. Un compte qui a activé la
 * double authentification ne doit rien voir tant qu'il est en aal1 : la base
 * le refuse (politiques restrictives `<table>_mfa`, migration du 14/10/2026),
 * et l'app montre l'écran du code plutôt que des modules vides.
 *
 * L'état se lit dans la session elle-même, sans appel réseau : le niveau dans
 * le jeton d'accès (`aal`), les facteurs dans l'utilisateur. Le rappel de
 * `onAuthStateChange` ne doit pas attendre d'appel à Supabase.
 */

export interface SessionLike {
  access_token: string;
  user: { factors?: { status: string; factor_type?: string }[] | null };
}

/** Le contenu d'un jeton JWT, sans vérifier sa signature (le serveur, lui, la vérifie). */
export function jwtClaims(token: string): Record<string, unknown> {
  try {
    const part = token.split('.')[1] ?? '';
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const json = decodeURIComponent(
      [...atob(base64)].map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''),
    );
    const claims = JSON.parse(json);
    return typeof claims === 'object' && claims !== null ? claims : {};
  } catch {
    return {};
  }
}

/** Le compte a-t-il une double authentification active ? */
export const hasSecondFactor = (session: SessionLike) => (session.user.factors ?? []).some((f) => f.status === 'verified');

/** Le mot de passe est donné, le code pas encore : l'app demande le code. */
export function needsSecondFactor(session: SessionLike): boolean {
  return hasSecondFactor(session) && jwtClaims(session.access_token).aal !== 'aal2';
}

/** Un code à six chiffres, espaces tolérés (« 123 456 »). */
export function readTotpCode(text: string): string | null {
  const digits = text.replace(/\s+/g, '');
  return /^\d{6}$/.test(digits) ? digits : null;
}

/** La phrase à recopier pour supprimer son compte. */
export const DELETE_PHRASE = 'SUPPRIMER';
