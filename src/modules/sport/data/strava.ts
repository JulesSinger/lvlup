import { supabaseConfig } from '../../../core/data';
import { getClient } from '../../../core/data/supabaseClient';

/**
 * Le lien avec l'API de Strava, par la fonction `sport-strava`
 * (docs/etude-sport.md §21). Ce n'est pas un stockage : la fonction parle à
 * Strava et range elle-même les sorties dans `sport_runs`, que l'écran relit
 * ensuite par le contrat. Les jetons de Strava ne passent jamais par ici.
 *
 * Seulement avec un compte : sans serveur, personne ne peut parler à Strava.
 */
export const stravaAvailable = supabaseConfig !== null;

export interface StravaStatus {
  /** Les secrets de l'application Strava sont-ils posés sur le serveur ? */
  configured: boolean;
  connected: boolean;
  athleteName: string;
  lastSyncAt: string | null;
}

export interface StravaSync {
  added: number;
  known: number;
  message: string;
  skipped?: boolean;
}

const NOT_DEPLOYED = 'La fonction sport-strava ne répond pas : est-elle déployée (supabase functions deploy sport-strava --no-verify-jwt) ?';

async function call<T>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
  if (!supabaseConfig) throw new Error('Relier Strava demande d’être connecté avec un compte.');
  const client = getClient(supabaseConfig.url, supabaseConfig.anonKey);
  const { data, error } = await client.functions.invoke('sport-strava', { body: { action, ...extra } });
  if (error) {
    // La fonction répond une phrase toute prête ; on la montre telle quelle.
    const context = (error as { context?: Response }).context;
    const body = context && typeof context.json === 'function' ? await context.json().catch(() => null) : null;
    throw new Error(body?.error ?? NOT_DEPLOYED);
  }
  return data as T;
}

export const stravaStatus = () => call<StravaStatus>('status');
export const syncStrava = (force = false) => call<StravaSync>('sync', { force });
export const disconnectStrava = () => call<{ ok: boolean }>('disconnect');

/** Part chez Strava pour autoriser Atlas ; on revient dans Sport ensuite. */
export async function connectStrava(): Promise<void> {
  const { url } = await call<{ url: string }>('connect', { returnTo: window.location.origin });
  window.location.assign(url);
}

/**
 * Ce que dit l'adresse au retour de Strava (`#/sport/strava-ok`…), posée par la
 * fonction : le sous-chemin appartient au module.
 */
export function stravaReturn(hash: string): string | null {
  const m = /^#\/sport\/strava-([a-z-]+)$/.exec(hash);
  if (!m) return null;
  switch (m[1]) {
    case 'ok':
      return 'Strava est relié : tes nouvelles courses arrivent maintenant toutes seules.';
    case 'refus':
      return 'Strava n’a pas été relié : l’autorisation a été refusée.';
    case 'sans-activites':
      return 'Strava n’a pas été relié : il faut laisser cochée la case qui autorise la lecture des activités.';
    default:
      return 'Strava n’a pas pu être relié : réessaie dans un moment.';
  }
}
