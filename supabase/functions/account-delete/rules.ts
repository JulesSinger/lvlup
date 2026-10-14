/**
 * Supprimer son compte — les règles, pures, testées par Vitest
 * (`src/core/lib/accountDelete.test.ts`) ; docs/securite.md §8.
 */

/** Les espaces de fichiers d'Atlas : chaque compte y a son dossier, `<compte>/…`. */
export const BUCKETS = ['hautsfaits', 'projets', 'recettes'] as const;

/** Une connexion plus ancienne ne suffit pas : le mot de passe vient d'être redonné. */
export const FRESH_LOGIN_SECONDS = 10 * 60;

/**
 * La demande peut-elle aller au bout ? Le jeton a déjà été vérifié par Supabase
 * (`auth.getUser`) : ici, ses revendications disent si la connexion est récente
 * et, pour un compte à double authentification, si le code a été donné.
 */
export function deletionRefusal(claims: Record<string, unknown>, hasVerifiedFactor: boolean, nowSeconds: number): string | null {
  const authenticatedAt = latestAuthentication(claims);
  if (authenticatedAt === null || nowSeconds - authenticatedAt > FRESH_LOGIN_SECONDS) {
    return 'Redonne ton mot de passe : la suppression demande une connexion de moins de dix minutes.';
  }
  if (hasVerifiedFactor && claims.aal !== 'aal2') return 'Donne aussi le code de ton app d’authentification.';
  return null;
}

/** Le moment de la dernière preuve d'identité : `amr` (mot de passe, code) plutôt que la date du jeton, qui se renouvelle seul. */
function latestAuthentication(claims: Record<string, unknown>): number | null {
  const amr = Array.isArray(claims.amr) ? claims.amr : [];
  const times = amr
    .map((m) => (typeof m === 'object' && m !== null ? (m as { timestamp?: unknown }).timestamp : null))
    .filter((t): t is number => typeof t === 'number');
  return times.length ? Math.max(...times) : null;
}

/** Le contenu d'un jeton JWT (déjà vérifié par Supabase). */
export function jwtClaims(token: string): Record<string, unknown> {
  try {
    const part = token.split('.')[1] ?? '';
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))));
  } catch {
    return {};
  }
}

/** Un dossier de compte n'est jamais autre chose qu'un identifiant (pas de « .. », pas de « / »). */
export const isAccountFolder = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
