/**
 * Atlas — le lien avec l'API de Strava (Edge Function Supabase, Deno ;
 * docs/etude-sport.md §21).
 *
 * Jules est abonné à Strava (09/10/2026) : l'API, écartée faute d'abonnement
 * (§3.1), redevient le chemin automatique des sorties. Cette fonction est la
 * seule à parler à Strava et la seule à toucher aux jetons OAuth
 * (`sport_strava_links`) : le navigateur ne les voit jamais.
 *
 * Deux portes :
 *  · **GET** — le retour de Strava après « Autoriser » (`?code=…&state=…`).
 *    Le `state` signé dit à quel compte Atlas rattacher Strava ; la fonction
 *    échange le code contre les jetons, les range, et renvoie vers Atlas.
 *  · **POST**, avec la session Supabase de l'app, `{ action }` :
 *      `status`     → { configured, connected, athleteName, lastSyncAt } ;
 *      `connect`    → { url } : l'adresse d'autorisation de Strava ;
 *      `sync`       → { added, known, message } : les nouvelles courses ;
 *      `disconnect` → retire l'autorisation chez Strava et les jetons ici
 *                     (les sorties déjà reçues restent dans Sport).
 *
 * Synchroniser, c'est demander à Strava les activités depuis la dernière vue
 * (trois jours de marge), garder les courses, écarter celles déjà dans Sport
 * (même référence `strava:<id>` que l'archive, ou même sortie venue par un
 * autre chemin), et lire le détail des nouvelles pour leurs temps au km.
 *
 * Secrets à poser une fois (application déclarée sur strava.com/settings/api) :
 *   supabase secrets set STRAVA_CLIENT_ID=… STRAVA_CLIENT_SECRET=…
 * À déployer avec --no-verify-jwt : Strava revient ici sans session Supabase ;
 * les appels de l'app, eux, sont vérifiés ici.
 *   supabase functions deploy sport-strava --no-verify-jwt
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { sameRun } from '../sport-import/payload.ts';
import {
  STATE_TTL_MS,
  STRAVA_SCOPE,
  canReadActivities,
  safeReturn,
  signState,
  splitsFrom,
  syncAfter,
  syncMessage,
  toRun,
  verifyState,
  type StravaActivity,
  type StravaRun,
} from './strava.ts';

const VERSION = '2026-10-09.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CLIENT_ID = Deno.env.get('STRAVA_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('STRAVA_CLIENT_SECRET') ?? '';
const CALLBACK = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/sport-strava`;
/** La clé qui signe le `state` : dérivée du secret Strava, jamais envoyée. */
const STATE_SECRET = `atlas-sport-strava:${CLIENT_SECRET}`;
/** Au plus tant de détails lus par synchronisation (Strava : 100 appels par quart d'heure). */
const MAX_DETAILS = 30;
/** Deux synchronisations automatiques rapprochées n'en font qu'une. */
const MIN_SYNC_GAP_MS = 2 * 60_000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

/** Une page minimale, quand on ne sait même pas où renvoyer (lien expiré). */
function page(text: string, status = 400) {
  const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Atlas</title><body style="font-family:system-ui;padding:2em;max-width:30em;margin:auto"><p>${text}</p></body>`;
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
const configured = () => Boolean(CLIENT_ID && CLIENT_SECRET && SUPABASE_URL && SERVICE_KEY);

interface Link {
  user_id: string;
  athlete_id: number;
  athlete_name: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scope: string;
  last_sync_at: string | null;
  last_activity_at: string | null;
}

/** Une erreur dont le message peut être montré tel quel. */
class Shown extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

async function tokenRequest(params: Record<string, string>) {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...params }),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Shown(`Strava a refusé (${res.status}) : reconnecte Strava depuis Sport.`, 502);
  return body;
}

async function getLink(userId: string): Promise<Link | null> {
  const { data, error } = await admin.from('sport_strava_links').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Link | null) ?? null;
}

/** Un jeton d'accès valide, renouvelé s'il expire dans les deux minutes. */
async function accessToken(link: Link): Promise<string> {
  if (Date.parse(link.expires_at) > Date.now() + 120_000) return link.access_token;
  const body = await tokenRequest({ grant_type: 'refresh_token', refresh_token: link.refresh_token });
  const next = {
    access_token: String(body.access_token ?? ''),
    refresh_token: String(body.refresh_token ?? link.refresh_token),
    expires_at: new Date(Number(body.expires_at ?? 0) * 1000).toISOString(),
  };
  if (!next.access_token) throw new Shown('Strava n’a pas renouvelé l’accès : reconnecte Strava depuis Sport.', 502);
  const { error } = await admin.from('sport_strava_links').update(next).eq('user_id', link.user_id);
  if (error) throw new Error(error.message);
  return next.access_token;
}

async function stravaGet(path: string, token: string, userId: string): Promise<unknown> {
  const res = await fetch(`https://www.strava.com/api/v3${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) {
    // Autorisation retirée chez Strava : le lien ne sert plus, on l'oublie.
    await admin.from('sport_strava_links').delete().eq('user_id', userId);
    throw new Shown('Strava a retiré l’accès : reconnecte Strava depuis Sport.', 401);
  }
  if (res.status === 429) throw new Shown('Strava limite le nombre d’appels : réessaie dans un quart d’heure.', 429);
  if (!res.ok) throw new Shown(`Strava ne répond pas (${res.status}) : réessaie plus tard.`, 502);
  return res.json();
}

/** Les courses pas encore dans Sport, par leur référence ou par ressemblance. */
async function fresh(userId: string, runs: StravaRun[]): Promise<{ add: StravaRun[]; known: number }> {
  if (runs.length === 0) return { add: [], known: 0 };
  const times = runs.map((r) => Date.parse(r.started_at));
  const { data, error } = await admin
    .from('sport_runs')
    .select('started_at, distance_m, source_ref')
    .eq('user_id', userId)
    .gte('started_at', new Date(Math.min(...times) - 12 * 3_600_000).toISOString())
    .lte('started_at', new Date(Math.max(...times) + 12 * 3_600_000).toISOString());
  if (error) throw new Error(error.message);
  const existing = (data ?? []) as { started_at: string; distance_m: number; source_ref: string | null }[];
  const add = runs.filter(
    (r) =>
      !existing.some(
        (e) =>
          e.source_ref === r.source_ref ||
          sameRun({ startedAt: e.started_at, distanceM: e.distance_m }, { startedAt: r.started_at, distanceM: r.distance_m }),
      ),
  );
  return { add, known: runs.length - add.length };
}

async function sync(userId: string, force: boolean) {
  const link = await getLink(userId);
  if (!link) throw new Shown('Strava n’est pas relié.', 404);
  if (!force && link.last_sync_at && Date.now() - Date.parse(link.last_sync_at) < MIN_SYNC_GAP_MS) {
    return { added: 0, known: 0, skipped: true, message: syncMessage(0, 1) };
  }
  const token = await accessToken(link);
  const after = syncAfter(link.last_activity_at, new Date());
  const activities: StravaActivity[] = [];
  for (let pageNo = 1; pageNo <= 5; pageNo++) {
    const batch = (await stravaGet(`/athlete/activities?after=${after}&per_page=100&page=${pageNo}`, token, userId)) as StravaActivity[];
    if (!Array.isArray(batch) || batch.length === 0) break;
    activities.push(...batch);
    if (batch.length < 100) break;
  }
  const runs = activities.map(toRun).filter((r): r is StravaRun => r !== null);
  const { add, known } = await fresh(userId, runs);

  // Les temps au kilomètre ne sont que dans le détail d'une activité : un appel par nouvelle course.
  const rows = [];
  for (const [i, run] of add.entries()) {
    let splits: number[] | null = null;
    if (i < MAX_DETAILS) {
      const detail = (await stravaGet(`/activities/${run.source_ref.slice(7)}`, token, userId)) as { splits_metric?: unknown };
      splits = splitsFrom(detail?.splits_metric);
    }
    rows.push({ ...run, splits_s: splits, user_id: userId });
  }
  if (rows.length > 0) {
    // La contrainte unique (compte, référence) reste le dernier rempart contre un doublon.
    const { error } = await admin.from('sport_runs').upsert(rows, { onConflict: 'user_id,source_ref', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }
  const latest = activities.map((a) => Date.parse(a.start_date ?? '')).filter(Number.isFinite);
  const lastActivity = latest.length ? new Date(Math.max(...latest)).toISOString() : link.last_activity_at;
  await admin
    .from('sport_strava_links')
    .update({ last_sync_at: new Date().toISOString(), last_activity_at: lastActivity })
    .eq('user_id', userId);
  return { added: rows.length, known, message: syncMessage(rows.length, known) };
}

/** Le retour de Strava : ranger les jetons, puis revenir dans Sport. */
async function callback(url: URL): Promise<Response> {
  const state = await verifyState(url.searchParams.get('state'), STATE_SECRET, Date.now());
  if (!state) return page('Ce lien de connexion a expiré. Reviens dans Atlas → Sport et recommence « Relier Strava ».');
  const back = (outcome: string) => new Response(null, { status: 303, headers: { Location: `${state.r}/#/sport/strava-${outcome}` } });
  const code = url.searchParams.get('code');
  if (url.searchParams.get('error') || !code) return back('refus');
  if (!canReadActivities(url.searchParams.get('scope') ?? '')) return back('sans-activites');
  try {
    const body = await tokenRequest({ grant_type: 'authorization_code', code });
    const athlete = (body.athlete ?? {}) as { id?: number; firstname?: string; lastname?: string };
    const row = {
      user_id: state.u,
      athlete_id: Number(athlete.id ?? 0),
      athlete_name: [athlete.firstname, athlete.lastname].filter(Boolean).join(' ').slice(0, 120),
      access_token: String(body.access_token ?? ''),
      refresh_token: String(body.refresh_token ?? ''),
      expires_at: new Date(Number(body.expires_at ?? 0) * 1000).toISOString(),
      scope: (url.searchParams.get('scope') ?? '').slice(0, 200),
      connected_at: new Date().toISOString(),
    };
    if (!row.access_token || !row.refresh_token) return back('erreur');
    const { error } = await admin.from('sport_strava_links').upsert(row, { onConflict: 'user_id' });
    if (error) throw new Error(error.message);
    return back('ok');
  } catch (err) {
    console.error('sport-strava callback', err);
    return back('erreur');
  }
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  const url = new URL(request.url);
  if (request.method === 'GET') {
    if (!configured()) return page('Le lien avec Strava n’est pas encore configuré sur le serveur.', 503);
    return callback(url);
  }
  if (request.method !== 'POST') return json({ error: 'GET ou POST attendu', version: VERSION }, 405);

  let body: Record<string, unknown> = {};
  try {
    const text = await request.text();
    if (text.length > 4096) return json({ error: 'Requête trop grosse.' }, 413);
    body = JSON.parse(text || '{}');
  } catch {
    return json({ error: 'Corps JSON attendu.' }, 400);
  }
  if (body.ping === true) return json({ ok: true, version: VERSION, configured: configured() });

  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } };
  const userId = auth.user?.id;
  if (!userId) return json({ error: 'Connecte-toi à Atlas pour relier Strava.' }, 401);

  try {
    switch (body.action) {
      case 'status': {
        if (!configured()) return json({ configured: false, connected: false, version: VERSION });
        const link = await getLink(userId);
        return json({
          configured: true,
          connected: Boolean(link),
          athleteName: link?.athlete_name ?? '',
          lastSyncAt: link?.last_sync_at ?? null,
          version: VERSION,
        });
      }
      case 'connect': {
        if (!configured()) throw new Shown('Le lien avec Strava n’est pas encore configuré sur le serveur.', 503);
        const returnTo = safeReturn(body.returnTo);
        if (!returnTo) throw new Shown('Adresse de retour refusée.');
        const state = await signState({ u: userId, r: returnTo, e: Date.now() + STATE_TTL_MS }, STATE_SECRET);
        const authorize = new URL('https://www.strava.com/oauth/authorize');
        authorize.search = new URLSearchParams({
          client_id: CLIENT_ID,
          redirect_uri: CALLBACK,
          response_type: 'code',
          approval_prompt: 'auto',
          scope: STRAVA_SCOPE,
          state,
        }).toString();
        return json({ url: authorize.toString() });
      }
      case 'sync':
        if (!configured()) throw new Shown('Le lien avec Strava n’est pas encore configuré sur le serveur.', 503);
        return json(await sync(userId, body.force === true));
      case 'disconnect': {
        const link = await getLink(userId);
        if (link) {
          // Retirer l'autorisation chez Strava aussi ; si Strava ne répond pas, on oublie quand même les jetons.
          await fetch('https://www.strava.com/oauth/deauthorize', {
            method: 'POST',
            headers: { Authorization: `Bearer ${link.access_token}` },
          }).catch(() => undefined);
          const { error } = await admin.from('sport_strava_links').delete().eq('user_id', userId);
          if (error) throw new Error(error.message);
        }
        return json({ ok: true });
      }
      default:
        return json({ error: 'Action inconnue.' }, 400);
    }
  } catch (err) {
    if (err instanceof Shown) return json({ error: err.message }, err.status);
    console.error('sport-strava', err);
    return json({ error: 'Le lien avec Strava a échoué : réessaie plus tard.' }, 500);
  }
});
