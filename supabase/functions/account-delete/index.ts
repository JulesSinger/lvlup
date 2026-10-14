/**
 * Supprimer son compte — docs/securite.md §8.
 *
 * Appel (POST, en-tête `Authorization: Bearer <jeton de session>`), depuis
 * Réglages → « Supprimer mon compte », juste après que le mot de passe (et le
 * code, si la double authentification est active) a été redonné.
 *
 * Dans cet ordre : **les fichiers d'abord** (photos des hauts faits, images
 * des projets, photos des recettes : ils ne partent pas en cascade), puis le
 * compte, dont toutes les lignes partent en cascade (`on delete cascade` vers
 * `auth.users` sur chaque table, vérifié le 14/10/2026). Une coupure entre
 * les deux laisse un compte sans fichiers, qu'on peut supprimer de nouveau —
 * jamais des fichiers sans compte.
 *
 * À déployer avec --no-verify-jwt, comme les autres : la requête préliminaire
 * du navigateur arrive sans jeton. Le jeton est vérifié ici (`auth.getUser`).
 *   supabase functions deploy account-delete --no-verify-jwt
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { BUCKETS, deletionRefusal, isAccountFolder, jwtClaims } from './rules.ts';

const VERSION = '2026-10-14.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

/** Tous les fichiers sous un dossier, sous-dossiers compris. */
async function filesUnder(bucket: string, prefix: string, depth = 0): Promise<string[]> {
  if (depth > 6) return [];
  const files: string[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 1000, offset });
    if (error) throw new Error(error.message);
    for (const item of data ?? []) {
      const path = `${prefix}/${item.name}`;
      // Un dossier n'a pas d'identifiant : on y descend.
      if (item.id === null) files.push(...(await filesUnder(bucket, path, depth + 1)));
      else files.push(path);
    }
    if (!data || data.length < 1000) break;
  }
  return files;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') return json({ error: 'POST attendu', version: VERSION }, 405);

  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const { data: auth } = token ? await admin.auth.getUser(token) : { data: { user: null } };
  const user = auth.user;
  if (!user || !isAccountFolder(user.id)) return json({ error: 'Connecte-toi pour supprimer ton compte.' }, 401);

  const body = (await request.json().catch(() => ({}))) as { confirm?: unknown };
  if (body.confirm !== true) return json({ error: 'Confirmation absente.' }, 400);

  const hasFactor = (user.factors ?? []).some((f) => f.status === 'verified');
  const refusal = deletionRefusal(jwtClaims(token), hasFactor, Math.floor(Date.now() / 1000));
  if (refusal) return json({ error: refusal }, 403);

  try {
    for (const bucket of BUCKETS) {
      const files = await filesUnder(bucket, user.id);
      for (let i = 0; i < files.length; i += 100) {
        const { error } = await admin.storage.from(bucket).remove(files.slice(i, i + 100));
        if (error) throw new Error(error.message);
      }
    }
  } catch (err) {
    return json({ error: `Les fichiers n’ont pas pu être effacés (${err instanceof Error ? err.message : 'erreur'}) : rien d’autre n’a été touché, réessaie.` }, 500);
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return json({ error: `Les fichiers sont effacés, mais le compte n’a pas pu l’être (${error.message}) : réessaie.` }, 500);
  return json({ ok: true, version: VERSION });
});
