/**
 * Atlas — les sorties de l'Apple Watch, reçues du raccourci iPhone
 * (Edge Function Supabase, Deno ; docs/etude-sport.md §3.3, §15).
 *
 * La première fonction d'Atlas qui **reçoit** des données de l'extérieur. Elle
 * n'accepte qu'une chose : des séances de course, envoyées avec un jeton
 * d'import créé dans Sport. Le jeton n'est jamais rangé : seule son empreinte
 * SHA-256 l'est (`sport_import_tokens`), et c'est elle qu'on cherche.
 *
 * Appels (POST, en-tête `Authorization: Bearer <jeton>`) :
 *  · `{ "test": true }` — vérifie le jeton sans rien écrire (bouton
 *    « Essayer » de l'app) ;
 *  · une séance `{ start, distance, duration, avgHr?, maxHr?, elevation?,
 *    name?, id? }` ou plusieurs `{ workouts: [ … ] }`.
 * Sans jeton, `{ "ping": true }` répond la version : la fonction est déployée.
 *
 * Réponse : `{ added, known, rejected, message }` — `message` est la phrase que
 * le raccourci affiche. Une séance déjà reçue (même référence) ou déjà dans
 * Sport par un autre chemin (même départ à dix minutes près, même distance à
 * 10 % près) n'est pas ajoutée : renvoyer les sept derniers jours ne crée
 * aucun doublon.
 *
 * À déployer avec --no-verify-jwt : le jeton du raccourci n'est pas un jeton
 * de session Supabase, la vérification est faite ici.
 *   supabase functions deploy sport-import --no-verify-jwt
 * SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournies automatiquement.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { MAX_BODY_BYTES, readPayload, sameRun, summary, type ShortcutRun } from './payload.ts';

const VERSION = '2026-10-08.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Le compte du jeton, ou null. Le jeton lui-même ne quitte jamais cette fonction. */
async function accountOf(token: string): Promise<{ tokenId: string; userId: string } | null> {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const { data, error } = await admin
    .from('sport_import_tokens')
    .select('id, user_id')
    .eq('token_hash', await sha256Hex(token))
    .maybeSingle();
  if (error || !data) return null;
  return { tokenId: data.id as string, userId: data.user_id as string };
}

/** Les séances qui ne sont pas déjà dans Sport, par leur référence ou par ressemblance. */
async function fresh(userId: string, runs: ShortcutRun[]): Promise<{ add: ShortcutRun[]; known: number }> {
  const times = runs.map((r) => Date.parse(r.started_at));
  const from = new Date(Math.min(...times) - 12 * 3_600_000).toISOString();
  const to = new Date(Math.max(...times) + 12 * 3_600_000).toISOString();
  const { data, error } = await admin
    .from('sport_runs')
    .select('started_at, distance_m, source_ref')
    .eq('user_id', userId)
    .gte('started_at', from)
    .lte('started_at', to);
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

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return json({ error: 'POST attendu', version: VERSION }, 405);

  // Taille bornée avant toute lecture : la seule entrée publique d'Atlas.
  const declared = Number(request.headers.get('Content-Length') ?? '0');
  if (declared > MAX_BODY_BYTES) return json({ error: 'Requête trop grosse.' }, 413);
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return json({ error: 'Requête trop grosse.' }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text || '{}');
  } catch {
    return json({ error: 'Corps JSON attendu.', message: 'Le raccourci n’a pas envoyé de JSON.' }, 400);
  }

  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (!token && (body as Record<string, unknown>)?.ping === true) {
    return json({ ok: true, version: VERSION, configured: Boolean(SUPABASE_URL && SERVICE_KEY) });
  }
  const account = token ? await accountOf(token) : null;
  if (!account) {
    return json({ error: 'Jeton inconnu.', message: 'Jeton inconnu : recrée-le dans Sport → Raccourci iPhone.' }, 401);
  }
  await admin.from('sport_import_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', account.tokenId);

  if ((body as Record<string, unknown>)?.test === true) {
    return json({ ok: true, version: VERSION, message: 'Jeton reconnu : le raccourci peut envoyer tes sorties.' });
  }

  const read = readPayload(body, new Date());
  if ('error' in read) return json({ error: read.error, message: read.error }, 400);
  try {
    const { add, known } = read.runs.length > 0 ? await fresh(account.userId, read.runs) : { add: [], known: 0 };
    if (add.length > 0) {
      const rows = add.map((r) => ({ ...r, user_id: account.userId }));
      // La contrainte unique (compte, référence) reste le dernier rempart : deux
      // envois simultanés de la même séance n'en écrivent qu'une.
      const { error } = await admin.from('sport_runs').upsert(rows, { onConflict: 'user_id,source_ref', ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    }
    const status = read.runs.length === 0 && read.rejected.length > 0 ? 422 : 200;
    return json(
      { added: add.length, known, rejected: read.rejected, message: summary(add, known, read.rejected), version: VERSION },
      status,
    );
  } catch (err) {
    console.error('sport-import', err);
    return json({ error: 'Écriture impossible.', message: 'Sport n’a pas pu ranger la séance : réessaie plus tard.' }, 500);
  }
});
