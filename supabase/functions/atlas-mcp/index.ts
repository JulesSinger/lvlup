/**
 * Atlas — le connecteur de Claude (Edge Function Supabase, Deno ; serveur
 * MCP, docs/connecteur-claude.md).
 *
 * Claude (le site, l'app iPhone ou l'app d'ordinateur) s'y connecte comme à un
 * « connecteur personnalisé » : il lit la liste des outils, puis les appelle
 * quand on le lui demande (« ajoute cette recette », « enregistre ce ticket de
 * caisse »). Recettes (`recettes.ts`), Courses (`courses.ts`) et Sport (`sport.ts`) ; les autres
 * modules viendront un à un.
 *
 * **Qui parle ?** Une clé personnelle, envoyée par Claude dans l'en-tête
 *   Authorization: Bearer atl_…   (adresse : https://<projet>.supabase.co/functions/v1/atlas-mcp)
 * — ou, première façon gardée, en fin d'adresse : …/atlas-mcp/atl_…
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
import { handleBody, type ServerInfo, type Tool } from './mcp.ts';
import { coursesTools, type CoursesData, type EntryRow, type ItemRow, type StoreRow, type TripItemRow, type TripRow } from './courses.ts';
import { sportTools, type ActivityRow, type PlanRow as SportPlanRow, type RunRow, type SessionRow, type SettingsRow, type SportData } from './sport.ts';
import { recettesTools, type CookedRow, type PlanRow, type RecettesData, type RecipeRow } from './recettes.ts';

const VERSION = '2026-10-12.3';
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

/**
 * La clé, d'où qu'elle vienne : l'en-tête `Authorization: Bearer atl_…`
 * (depuis le 11/10/2026, la bonne façon : Claude la garde secrète, et elle ne
 * paraît ni dans l'adresse ni dans les journaux), ou `X-Atlas-Key`, ou encore
 * — la première façon, gardée pour une adresse déjà collée dans Claude — le
 * dernier morceau de l'adresse, `…/atlas-mcp/atl_…`.
 */
function tokenOf(request: Request): string | null {
  const bearer = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  if (bearer.startsWith('atl_')) return bearer;
  const header = (request.headers.get('X-Atlas-Key') ?? '').trim();
  if (header.startsWith('atl_')) return header;
  const last = new URL(request.url).pathname.split('/').filter(Boolean).pop() ?? '';
  return last.startsWith('atl_') ? last : null;
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

/** Le nom d'une catégorie, comparé sans casse ni accents (comme `expenseService` de Budget). */
const categoryKey = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

/** Les données de Courses d'un seul compte : chaque requête porte `user_id`. */
function coursesData(userId: string): CoursesData {
  const t = (table: string) => admin.from(table);
  const insert = async <R>(table: string, row: Record<string, unknown>) =>
    check(await t(table).insert({ ...row, user_id: userId }).select('*').single()) as R;
  const update = async <R>(table: string, id: string, row: Record<string, unknown>) =>
    (check(await t(table).update(row).eq('user_id', userId).eq('id', id).select('*').maybeSingle()) as R | null) ?? null;
  const remove = async (table: string, id: string) =>
    (check(await t(table).delete().eq('user_id', userId).eq('id', id).select('id')) as unknown[]).length > 0;
  type Page<R> = PromiseLike<{ data: R[] | null; error: { message: string } | null }>;
  // Des colonnes choisies : le client ne sait pas typer une liste écrite en texte, on le lui dit.
  const all = <R>(table: string, columns = '*') =>
    fetchAll<R>((first, last) => t(table).select(columns).eq('user_id', userId).order('id').range(first, last) as unknown as Page<R>);
  const budgetWith = async (refs: string[]) =>
    refs.length === 0
      ? []
      : (check(await t('budget_entries').select('id, import_key').eq('user_id', userId).in('import_key', refs)) as { id: string; import_key: string }[]);

  return {
    listItems: () => all<ItemRow>('courses_items', 'id, name, aisle, recurrence, default_quantity, last_trip_number'),
    listStores: () => all<StoreRow>('courses_stores', 'id, name'),
    listEntries: () => all<EntryRow>('courses_list', 'id, item_id, quantity, note, checked, price_cents'),
    listTrips: () => all<TripRow>('courses_trips', 'id, number, day, store_id, store_name, total_cents, note'),
    async listTripItems(tripIds) {
      if (tripIds.length === 0) return [];
      return fetchAll<TripItemRow>(
        (first, last) =>
          t('courses_trip_items')
            .select('id, trip_id, item_id, name, aisle, quantity, price_cents')
            .eq('user_id', userId)
            .in('trip_id', tripIds)
            .order('id')
            .range(first, last) as unknown as Page<TripItemRow>,
      );
    },
    insertItem: (row) => insert<ItemRow>('courses_items', row),
    updateItem: (id, row) => update<ItemRow>('courses_items', id, row),
    insertEntry: (row) => insert<EntryRow>('courses_list', row),
    updateEntry: (id, row) => update<EntryRow>('courses_list', id, row),
    deleteEntry: (id) => remove('courses_list', id),
    async closeTrip(plan) {
      // Le compte est passé en paramètre : la fonction SQL n'est appelable qu'avec la clé de service.
      const trip = check(await admin.rpc('courses_close_trip_for', { p_user: userId, plan })) as TripRow;
      return trip;
    },
    deleteTrip: (id) => remove('courses_trips', id),
    async recordExpense(request) {
      if ((await budgetWith([request.ref])).length > 0) return; // déjà là : rejouer ne double rien
      const categories = check(await t('budget_categories').select('id, name').eq('user_id', userId)) as { id: string; name: string }[];
      const category = categories.find((c) => categoryKey(c.name) === categoryKey(request.categoryName));
      check(
        await t('budget_entries').insert({
          user_id: userId,
          day: request.day,
          label: request.label,
          amount_cents: -Math.abs(Math.round(request.amountCents)),
          category_id: category?.id ?? null,
          source: 'manuelle',
          import_key: request.ref,
          note: request.note,
        }),
      );
    },
    async removeExpense(ref) {
      check(await t('budget_entries').delete().eq('user_id', userId).eq('import_key', ref));
    },
    async expenseRefs(refs) {
      return new Set((await budgetWith(refs)).map((e) => e.import_key));
    },
  };
}

/** Les données de Sport d'un seul compte : chaque requête porte `user_id`. */
function sportData(userId: string): SportData {
  const t = (table: string) => admin.from(table);
  const SESSION = 'id, plan_id, week, position, kind, title, distance_m, duration_s, pace_min_s, pace_max_s, hr_zone, instructions, day, done_at';
  const RUN = 'id, started_at, day, distance_m, duration_s, elevation_m, avg_hr, max_hr, kind, effort, title, note, source, session_id, splits_s';
  type Page<R> = PromiseLike<{ data: R[] | null; error: { message: string } | null }>;
  return {
    listPlans: () =>
      fetchAll<SportPlanRow>((first, last) => t('sport_plans').select('*').eq('user_id', userId).order('created_at').order('id').range(first, last)),
    insertPlan: async (row) => check(await t('sport_plans').insert({ ...row, user_id: userId }).select('*').single()) as SportPlanRow,
    updatePlan: async (id, row) =>
      (check(await t('sport_plans').update(row).eq('user_id', userId).eq('id', id).select('*').maybeSingle()) as SportPlanRow | null) ?? null,
    listSessions: (planId) =>
      fetchAll<SessionRow>(
        (first, last) =>
          t('sport_plan_sessions').select(SESSION).eq('user_id', userId).eq('plan_id', planId).order('week').order('position').order('id').range(first, last) as unknown as Page<SessionRow>,
      ),
    async insertSessions(rows) {
      if (rows.length === 0) return [];
      return check(await t('sport_plan_sessions').insert(rows.map((r) => ({ ...r, user_id: userId }))).select(SESSION)) as unknown as SessionRow[];
    },
    updateSession: async (id, row) =>
      (check(await t('sport_plan_sessions').update(row).eq('user_id', userId).eq('id', id).select(SESSION).maybeSingle()) as unknown as SessionRow | null) ?? null,
    async deleteSessions(ids) {
      if (ids.length === 0) return 0;
      return (check(await t('sport_plan_sessions').delete().eq('user_id', userId).in('id', ids).select('id')) as unknown[]).length;
    },
    listRuns: (from, to) =>
      fetchAll<RunRow>(
        (first, last) =>
          t('sport_runs').select(RUN).eq('user_id', userId).gte('day', from).lte('day', to).order('started_at').order('id').range(first, last) as unknown as Page<RunRow>,
      ),
    async listActivities(from, to) {
      const { data, error } = await t('sport_activities')
        .select('id, started_at, day, sport, duration_s, distance_m, avg_hr, max_hr, title, session_id')
        .eq('user_id', userId)
        .gte('day', from)
        .lte('day', to)
        .order('started_at');
      // Table absente (migration du 12/10/2026 pas appliquée) : rien à montrer, le reste marche.
      return error ? [] : ((data ?? []) as unknown as ActivityRow[]);
    },
    async unlinkActivities(sessionId) {
      const { error } = await t('sport_activities').update({ session_id: null }).eq('user_id', userId).eq('session_id', sessionId);
      // Table absente : rien à détacher.
      if (error && !/sport_activities/.test(error.message)) throw new Error(error.message);
    },
    getRun: async (id) => (check(await t('sport_runs').select(RUN).eq('user_id', userId).eq('id', id).maybeSingle()) as unknown as RunRow | null) ?? null,
    insertRun: async (row) => check(await t('sport_runs').insert({ ...row, user_id: userId }).select(RUN).single()) as unknown as RunRow,
    updateRun: async (id, row) =>
      (check(await t('sport_runs').update(row).eq('user_id', userId).eq('id', id).select(RUN).maybeSingle()) as unknown as RunRow | null) ?? null,
    deleteRun: async (id) => (check(await t('sport_runs').delete().eq('user_id', userId).eq('id', id).select('id')) as unknown[]).length > 0,
    getSettings: async () => (check(await t('sport_settings').select('hr_max, hr_rest').eq('user_id', userId).maybeSingle()) as SettingsRow | null) ?? null,
    async saveSettings(row) {
      check(await t('sport_settings').upsert({ ...row, user_id: userId, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }));
    },
  };
}

interface AtlasContext {
  today: string;
  recettes: RecettesData;
  courses: CoursesData;
  sport: SportData;
}

/** Les outils de chaque module, chacun avec sa part du contexte. */
const tools: Tool<AtlasContext>[] = [
  ...recettesTools.map((tool) => ({ ...tool, run: (args: Record<string, unknown>, c: AtlasContext) => tool.run(args, { data: c.recettes, today: c.today }) })),
  ...coursesTools.map((tool) => ({
    ...tool,
    run: (args: Record<string, unknown>, c: AtlasContext) => tool.run(args, { data: c.courses, today: c.today, newId: () => crypto.randomUUID() }),
  })),
  ...sportTools.map((tool) => ({ ...tool, run: (args: Record<string, unknown>, c: AtlasContext) => tool.run(args, { data: c.sport, today: c.today }) })),
];

function serverInfo(day: string): ServerInfo {
  return {
    name: 'atlas',
    title: 'Atlas',
    version: VERSION,
    instructions: [
      'Atlas est l’application personnelle de Jules. Ce connecteur donne accès à trois de ses modules : Recettes (le carnet, le menu de la semaine midi et soir, les recettes faites, les ingrédients « toujours là »), Courses (la liste, le catalogue des articles, l’historique des courses, et l’enregistrement d’un ticket de caisse) et Sport (les sorties, le plan marathon et ses séances, la FC).',
      'Une photo de ticket de caisse : lis-la, puis courses_catalogue, puis courses_enregistrer_ticket.',
      'Sport : la course à pied de Jules et son plan marathon, avec les séances de renforcement et de vélo. Commence par sport_resume. Pour donner les séances d’une semaine, sport_semaine_programmer (elles remplacent celles de la semaine).',
      `Aujourd’hui : ${day} (heure de Paris). Les jours s’écrivent AAAA-MM-JJ.`,
      'Avant de modifier, supprimer ou mettre au menu une recette, retrouve son identifiant avec recettes_lister. Une recette importée d’un site : écris les ingrédients un par ligne, quantité en tête, comme sur la page, et les étapes dans l’ordre.',
      'Demande confirmation avant toute suppression.',
    ].join('\n'),
  };
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const token = tokenOf(request);
  const account = token ? await accountOf(token) : null;
  if (!account) return json({ error: 'Clé du connecteur absente, inconnue ou révoquée : recrée-la dans Atlas → Réglages → Claude.' }, 401);

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
    const context: AtlasContext = { today: day, recettes: recettesData(account.userId), courses: coursesData(account.userId), sport: sportData(account.userId) };
    const answer = await handleBody(body, tools, serverInfo(day), context);
    if (answer === null) return new Response(null, { status: 202, headers: CORS });
    return json(answer);
  } catch (err) {
    console.error('atlas-mcp', err);
    return json({ jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Erreur interne.' } }, 500);
  }
});
