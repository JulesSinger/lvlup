import { needsSecondFactor, type SessionLike } from './mfa';
import type { AppUser } from './types';

/**
 * Le compte de la session gardée sur l'appareil — règle pure (10/11/2026).
 *
 * Sans réseau, Supabase ne peut pas renouveler une session de plus d'une heure :
 * il la **garde** sur l'appareil (l'échec est « réessayable ») mais annonce
 * « personne n'est connecté ». Atlas s'ouvrait alors sur la page d'accueil
 * publique au lieu des modules — ou restait bloqué tant que la tentative de
 * renouvellement traînait (essai de Jules à Auchan). Si la session est encore
 * là, c'est le même compte : on l'ouvre, les modules lisent leurs copies et
 * mettent leurs écritures en file ; le renouvellement se fera au retour du
 * réseau. Une session vraiment morte (refusée par le serveur), Supabase
 * l'efface lui-même : elle n'est plus là pour être lue.
 */
export function storedSessionUser(raw: string | null): AppUser | null {
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as Partial<SessionLike> & { refresh_token?: string; user?: { id?: string; email?: string } };
    if (!session.refresh_token || !session.access_token || !session.user?.id) return null;
    return {
      id: session.user.id,
      email: session.user.email ?? '',
      isLocal: false,
      needsSecondFactor: needsSecondFactor(session as SessionLike),
    };
  } catch {
    return null;
  }
}
