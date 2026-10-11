/**
 * Atlas — le connecteur de Claude (Edge Function Supabase, Deno ; serveur
 * MCP, docs/connecteur-claude.md).
 *
 * Claude (le site, l'app iPhone ou l'app d'ordinateur) s'y connecte comme à un
 * « connecteur personnalisé » : il lit la liste des outils, puis les appelle
 * quand on le lui demande (« ajoute cette recette », « mets le curry au menu
 * de jeudi soir »). Pour commencer, seulement Recettes, en entier
 * (`recettes.ts`) ; les autres modules viendront un à un.
 *
 * **Qui parle ?** L'adresse du connecteur porte un jeton personnel :
 *   https://<projet>.supabase.co/functions/v1/atlas-mcp/<jeton>
 * créé dans Atlas (Réglages → Claude), montré une fois ; seule son empreinte
 * SHA-256 est rangée (`mcp_tokens`), comme le jeton du raccourci iPhone. Le
 * guide de Supabase pour les serveurs MCP ne prévoit pas encore de connexion
 * OAuth : une adresse secrète, révocable, suffit pour un usage personnel.
 *
 * **La clé de service contourne le RLS** : chaque lecture et chaque écriture
 * passe donc par `scoped(userId)`, qui ajoute toujours `user_id = <compte du
 * jeton>`. Une recette d'un autre compte ne se lit, ne se modifie ni ne se
 * rattache jamais (les outils vérifient aussi qu'un `recipe_id` est à soi).
 *
 * À déployer avec --no-verify-jwt (Claude n'a pas de session Supabase) :
 *   supabase functions deploy atlas-mcp --no-verify-jwt
 */

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { handleBody, type ServerInfo } from './mcp.ts';
import { recettesTools, type CookedRow, type PlanRow, type RecettesData, type RecipeRow } from './recettes.ts';

const VERSION = '2026-10-11.1';
/** Le fuseau de Jules : « aujourd'hui » et la semaine en cours se comptent ici. */
const TIME_ZONE = 'Europe/Paris';
/** Une requête plus grosse est refusée avant d'être lue (une recette tient en quelques Ko). */
const MAX_BODY_BYTES = 256 * 1024;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, mcp-protocol-version, mcp-session-id, x-client-info, apikey',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Le compte du jeton, ou null. Le jeton lui-même ne quitte jamais cette fonction. */
async function accountOf(token: string): Promise<{ tokenId: string; userId: string } | null> {
  if (!/^atl_[A-Za-z0-9]{20,100}$/.test(token)) return null;
  const { data, error } = await admin.from('mcp_tokens').select('id, user_id').eq('token_hash', await sha256Hex(token)).maybeSingle();
  if (error || !data) return null;
  return { tokenId: data.id as string, userId: data.user_id as string };
}

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

/** Lire une table entière par paquets : Supabase ne rend jamais plus de 1 000 lignes d'un coup (CLAUDE.md §6). */
async function fetchAll<T>(page: (first: number, last: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let first = 0; ; first += 1000) {
    const rows = check(await page(first, first + 999)) ?? [];
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}

/** Les données de Recettes d'un seul compte : chaque requête porte `user_id`. */
function recettesData(userId: string): RecettesData {
  const t = (table: string) => admin.from(table);
  const one = async <R>(table: string, id: string) =>
    (check(await t(table).select('*').eq('user_id', userId).eq('id', id).maybeSingle()) as R | null) ?? null;
  const insert = async <R>(table: string, row: Record<string, unknown>) =>
    check(await t(table).insert({ ...row, user_id: userId }).select('*').single()) as R;
  const update = async <R>(table: string, id: string, row: Record<string, unknown>) =>
    (check(await t(table).update(row).eq('user_id', userId).eq('id', id).select('*').maybeSingle()) as R | null) ?? null;
  const remove = async (table: string, id: string) =>
    (check(await t(table).delete().eq('user_id', userId).eq('id', id).select('id')) as unknown[]).length > 0;

  return {
    listRecipes: () =>
      fetchAll<RecipeRow>((first, last) => t('recettes_recipes').select('*').eq('user_id', userId).order('title').order('id').range(first, last)),
    getRecipe: (id) => one<RecipeRow>('recettes_recipes', id),
    insertRecipe: (row) => insert<RecipeRow>('recettes_recipes', row),
    updateRecipe: (id, row) => update<RecipeRow>('recettes_recipes', id, row),
    async deleteRecipe(id) {
      const photos = check(await t('recettes_photos').select('path, thumb_path').eq('user_id', userId).eq('recipe_id', id)) as {
        path: string;
        thumb_path: string;
      }[];
      // La ligne d'abord (photo, historique et menu partent avec elle), les fichiers ensuite — comme l'app.
      const gone = await remove('recettes_recipes', id);
      const paths = photos.flatMap((p) => [p.path, p.thumb_path]);
      if (gone && paths.length) await admin.storage.from('recettes').remove(paths).catch(() => undefined);
      return gone;
    },
    async photoRecipeIds() {
      const rows = await fetchAll<{ recipe_id: string; id: string }>((first, last) =>
        t('recettes_photos').select('id, recipe_id').eq('user_id', userId).order('id').range(first, last),
      );
      return new Set(rows.map((r) => r.recipe_id));
    },
    listCooked: (recipeId) =>
      fetchAll<CookedRow>((first, last) =>
        t('recettes_cooked').select('id, recipe_id, day, servings, rating, comment').eq('user_id', userId).eq('recipe_id', recipeId).order('day').order('id').range(first, last),
      ),
    getCooked: (id) => one<CookedRow>('recettes_cooked', id),
    insertCooked: (row) => insert<CookedRow>('recettes_cooked', row),
    updateCooked: (id, row) => update<CookedRow>('recettes_cooked', id, row),
    deleteCooked: (id) => remove('recettes_cooked', id),
    listPlan: (from, to) =>
      fetchAll<PlanRow>((first, last) =>
        t('recettes_plan').select('*').eq('user_id', userId).gte('day', from).lte('day', to).order('day').order('position').order('id').range(first, last),
      ),
    getPlan: (id) => one<PlanRow>('recettes_plan', id),
    insertPlan: (row) => insert<PlanRow>('recettes_plan', row),
    updatePlan: (id, row) => update<PlanRow>('recettes_plan', id, row),
    deletePlan: (id) => remove('recettes_plan', id),
    async getPantry() {
      const row = check(await t('recettes_settings').select('pantry').eq('user_id', userId).maybeSingle()) as { pantry: string[] } | null;
      return row ? (row.pantry ?? []) : null;
    },
    async setPantry(items) {
      check(await t('recettes_settings').upsert({ user_id: userId, pantry: items, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }));
    },
  };
}

function serverInfo(day: string): ServerInfo {
  return {
    name: 'atlas',
    title: 'Atlas',
    version: VERSION,
    instructions: [
      'Atlas est l’application personnelle de Jules. Ce connecteur donne accès à son module Recettes : le carnet de recettes, le menu de la semaine (midi et soir), les recettes faites et les ingrédients « toujours là ».',
      `Aujourd’hui : ${day} (heure de Paris). Les jours s’écrivent AAAA-MM-JJ.`,
      'Avant de modifier, supprimer ou mettre au menu une recette, retrouve son identifiant avec recettes_lister. Une recette importée d’un site : écris les ingrédients un par ligne, quantité en tête, comme sur la page, et les étapes dans l’ordre.',
      'Demande confirmation avant toute suppression.',
    ].join('\n'),
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  // Le jeton est le dernier morceau de l'adresse : …/atlas-mcp/<jeton>.
  const parts = new URL(request.url).pathname.split('/').filter(Boolean);
  const token = parts[parts.length - 1] ?? '';
  const account = token.startsWith('atl_') ? await accountOf(token) : null;
  if (!account) return json({ error: 'Adresse de connecteur inconnue ou révoquée : recrée-la dans Atlas → Réglages → Claude.' }, 401);

  // Pas de flux d'événements ni de session : seul POST sert (Streamable HTTP, sans état).
  if (request.method !== 'POST') return json({ error: 'Ce connecteur ne répond qu’en POST.' }, 405);

  const declared = Number(request.headers.get('Content-Length') ?? '0');
  if (declared > MAX_BODY_BYTES) return json({ error: 'Requête trop grosse.' }, 413);
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return json({ error: 'Requête trop grosse.' }, 413);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'JSON illisible.' } }, 400);
  }

  await admin.from('mcp_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', account.tokenId);
  const day = today();
  try {
    const answer = await handleBody(body, recettesTools, serverInfo(day), { data: recettesData(account.userId), today: day });
    if (answer === null) return new Response(null, { status: 202, headers: CORS });
    return json(answer);
  } catch (err) {
    console.error('atlas-mcp', err);
    return json({ jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Erreur interne.' } }, 500);
  }
});
