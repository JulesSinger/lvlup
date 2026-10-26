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
import { tachesTools, type ListRow as TachesListRow, type TachesData, type TaskRow } from './taches.ts';
import { hautsfaitsTools, type FeatRow, type HautsFaitsData } from './hautsfaits.ts';
import { projetsTools, type ProjetsData, type ProjetsRows } from './projets.ts';
import ciqualTable from './ciqual.json' with { type: 'json' };
import { nutritionTools, type CiqualRow, type EntryRow as NutritionEntryRow, type FoodRow as NutritionFoodRow, type NutritionData, type TargetRow as NutritionTargetRow } from './nutrition.ts';
import { flashcardsTools, type CardRow as FlashCardRow, type DeckRow as FlashDeckRow, type FlashcardsData } from './flashcards.ts';
import { objectifsTools, type ObjectifsData, type Checkin as GoalCheckin } from './objectifs.ts';
import { calendarTools, type CalendarData, type CalendarEvent, type EventInput as CalendarEventInput, type EventException } from './calendar.ts';
import { budgetTools, type BudgetData, type CategoryRow as BudgetCategoryRow, type EntryRow as BudgetEntryRow, type RuleRow as BudgetRuleRow } from './budget.ts';
import { bilanTools, type BilanData } from './bilan.ts';
import { recettesTools, type CookedRow, type PlanRow, type RecettesData, type RecipeRow } from './recettes.ts';

const VERSION = '2026-10-26.1';
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
  // Toutes les colonnes : la cadence (17/10/2026) n'existe qu'après sa migration, et la nommer ferait échouer toute lecture avant.
  const RUN = '*';
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

/** Les données de Tâches d'un seul compte : chaque requête porte `user_id`. */
function tachesData(userId: string): TachesData {
  const t = (table: string) => admin.from(table);
  return {
    listTasks: () =>
      fetchAll<TaskRow>((first, last) => t('taches_tasks').select('*').eq('user_id', userId).order('created_at').order('id').range(first, last)),
    insertTask: async (row) => check(await t('taches_tasks').insert({ ...row, user_id: userId }).select('*').single()) as TaskRow,
    updateTask: async (id, row) =>
      (check(await t('taches_tasks').update(row).eq('user_id', userId).eq('id', id).select('*').maybeSingle()) as TaskRow | null) ?? null,
    deleteTask: async (id) => (check(await t('taches_tasks').delete().eq('user_id', userId).eq('id', id).select('id')) as unknown[]).length > 0,
    listLists: () =>
      fetchAll<TachesListRow>((first, last) => t('taches_lists').select('*').eq('user_id', userId).order('position').order('id').range(first, last)),
    insertList: async (row) => check(await t('taches_lists').insert({ ...row, user_id: userId }).select('*').single()) as TachesListRow,
    updateList: async (id, row) =>
      (check(await t('taches_lists').update(row).eq('user_id', userId).eq('id', id).select('*').maybeSingle()) as TachesListRow | null) ?? null,
    getSettings: async () => {
      const row = check(await t('taches_settings').select('task_reminders, morning_enabled, morning_time').eq('user_id', userId).maybeSingle()) as
        | { task_reminders: boolean; morning_enabled: boolean; morning_time: string }
        | null;
      // Sans ligne : le défaut du module (`DEFAULT_TACHES_SETTINGS`).
      return row
        ? { taskReminders: row.task_reminders, morningEnabled: row.morning_enabled, morningTime: row.morning_time }
        : { taskReminders: true, morningEnabled: false, morningTime: '08:00' };
    },
    scheduleReminders: (reminders) => replaceReminders(userId, 'taches', reminders),
  };
}

/**
 * Comme `coreStore.scheduleReminders(module, …)` : les rappels du module pas
 * encore partis sont remplacés ; la clé unique empêche de reposer un rappel déjà envoyé.
 */
async function replaceReminders(userId: string, module: string, reminders: { ref: string; fireAt: string; title: string; body: string; url?: string }[]) {
  check(await admin.from('reminders').delete().eq('user_id', userId).eq('module', module).is('sent_at', null));
  if (reminders.length === 0) return;
  check(
    await admin.from('reminders').upsert(
      reminders.map((r) => ({ user_id: userId, module, ref: r.ref, fire_at: r.fireAt, title: r.title, body: r.body, url: r.url ?? '/' })),
      { onConflict: 'user_id,module,ref,fire_at', ignoreDuplicates: true },
    ),
  );
}

/**
 * Les lignes de la période pour le bilan, module par module, d'un seul compte.
 * Une erreur (table absente) remonte : `bilan.ts` laisse alors le module de côté.
 */
function bilanData(userId: string): BilanData {
  const t = (table: string) => admin.from(table);
  type Page<R> = PromiseLike<{ data: R[] | null; error: { message: string } | null }>;
  const between = <R>(table: string, columns: string, dayColumn: string, from: string, to: string) =>
    fetchAll<R>(
      (first, last) =>
        t(table).select(columns).eq('user_id', userId).gte(dayColumn, from).lte(dayColumn, to).order(dayColumn).order('id').range(first, last) as unknown as Page<R>,
    );
  const all = <R>(table: string, columns: string) =>
    fetchAll<R>((first, last) => t(table).select(columns).eq('user_id', userId).order('id').range(first, last) as unknown as Page<R>);
  return {
    async load(module, from, to, today) {
      switch (module) {
        case 'objectifs':
          return {
            goals: await all('goals', 'id, title, archived'),
            checkins: await between('checkins', 'id, goal_id, day, pp', 'day', from, to),
          } as never;
        case 'sport': {
          const runs = await between('sport_runs', 'id, day, distance_m, duration_s', 'day', from, to);
          const activities = await between<{ day: string; sport: string; duration_s: number }>('sport_activities', 'id, day, sport, duration_s', 'day', from, to).catch(() => []);
          const plans = (await all<{ id: string; status: string; created_at: string }>('sport_plans', 'id, status, created_at')).filter((p) => p.status === 'actif');
          const plan = plans.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
          const sessions = plan
            ? (await all<{ plan_id: string; kind: string; day: string | null; done_at: string | null }>('sport_plan_sessions', 'id, plan_id, kind, day, done_at')).filter(
                (x) => x.plan_id === plan.id && x.day !== null && x.day >= from && x.day <= to,
              )
            : [];
          // Une séance de course est faite par une sortie du même jour ; renfo et vélo par leur coche.
          const runDays = new Set((runs as { day: string }[]).map((r) => r.day));
          return {
            runs,
            activities,
            sessions: sessions.map((x) => ({ kind: x.kind, done: x.done_at !== null || (!['renfo', 'velo', 'escalade', 'foot'].includes(x.kind as string) && runDays.has(x.day as string)) })),
          } as never;
        }
        case 'budget':
          return {
            entries: await between('budget_entries', 'id, day, amount_cents, category_id', 'day', from, to),
            categories: await all('budget_categories', 'id, name, kind, parent_id'),
          } as never;
        case 'taches': {
          const tasks = await all<{ title: string; completed_at: string | null; parent_id: string | null; planned_day: string | null; due_day: string | null }>(
            'taches_tasks',
            'id, title, completed_at, parent_id, planned_day, due_day',
          );
          const openTasks = tasks.filter((x) => !x.completed_at && !x.parent_id);
          return {
            done: tasks.filter((x) => x.completed_at && x.completed_at.slice(0, 10) >= from && x.completed_at.slice(0, 10) <= to),
            open: openTasks.length,
            overdue: openTasks.filter((x) => (x.planned_day && x.planned_day < today) || (x.due_day && x.due_day < today)).length,
          } as never;
        }
        case 'recettes': {
          const cooked = await between<{ day: string; recipe_id: string; rating: number | null }>('recettes_cooked', 'id, day, recipe_id, rating', 'day', from, to);
          const recipes = await all<{ id: string; title: string }>('recettes_recipes', 'id, title');
          return { cooked: cooked.map((c) => ({ day: c.day, rating: c.rating, title: recipes.find((r) => r.id === c.recipe_id)?.title ?? '?' })) } as never;
        }
        case 'courses':
          return { trips: await between('courses_trips', 'id, day, store_name, total_cents', 'day', from, to) } as never;
        case 'nutrition':
          return { entries: await between('nutrition_entries', 'id, day, kcal', 'day', from, to) } as never;
        case 'hautsfaits':
          return { feats: await between('hautsfaits_feats', 'id, title, date_start', 'date_start', from, to) } as never;
      }
    },
  };
}

/** Les données de Budget d'un seul compte : chaque requête porte `user_id`. */
function budgetData(userId: string): BudgetData {
  const t = (table: string) => admin.from(table);
  return {
    listEntries: (from, to) =>
      fetchAll<BudgetEntryRow>((first, last) =>
        t('budget_entries').select('*').eq('user_id', userId).gte('day', from).lte('day', to).order('day').order('id').range(first, last),
      ),
    getEntry: async (id) => (check(await t('budget_entries').select('*').eq('user_id', userId).eq('id', id).maybeSingle()) as BudgetEntryRow | null) ?? null,
    insertEntry: async (row) => check(await t('budget_entries').insert({ ...row, user_id: userId }).select('*').single()) as BudgetEntryRow,
    updateEntry: async (id, row) =>
      (check(await t('budget_entries').update(row).eq('user_id', userId).eq('id', id).select('*').maybeSingle()) as BudgetEntryRow | null) ?? null,
    deleteEntry: async (id) => (check(await t('budget_entries').delete().eq('user_id', userId).eq('id', id).select('id')) as unknown[]).length > 0,
    listCategories: () =>
      fetchAll<BudgetCategoryRow>((first, last) => t('budget_categories').select('*').eq('user_id', userId).order('position').order('id').range(first, last)),
    listRules: () => fetchAll<BudgetRuleRow>((first, last) => t('budget_rules').select('*').eq('user_id', userId).order('priority').order('id').range(first, last)),
    insertRule: async (row) => check(await t('budget_rules').insert({ ...row, user_id: userId }).select('*').single()) as BudgetRuleRow,
    deleteRule: async (id) => (check(await t('budget_rules').delete().eq('user_id', userId).eq('id', id).select('id')) as unknown[]).length > 0,
  };
}

/** Les données de Calendar d'un seul compte (colonnes : `2026-09-27-calendar-tables.sql` et suivantes). */
function calendarData(userId: string): CalendarData {
  const t = (table: string) => admin.from(table);
  // Postgres rend « 14:00:00 », l'app parle en « 14:00 ».
  const hhmm = (v: string | null) => (v === null ? null : v.slice(0, 5));
  const toEvent = (r: Record<string, any>): CalendarEvent => ({
    id: r.id,
    title: r.title,
    allDay: r.all_day,
    startDay: r.start_day,
    endDay: r.end_day,
    startTime: hhmm(r.start_time),
    endTime: hhmm(r.end_time),
    timezone: r.timezone,
    recurrence: r.recurrence,
    color: r.color,
    location: r.location,
    note: r.note,
    reminders: r.reminders ?? null,
    work: r.work ?? false,
    // Absente avant la migration du 26/10/2026.
    variants: r.variants ?? [],
    createdAt: r.created_at,
  });
  const columns = (p: Partial<CalendarEventInput>, insert = false) => {
    const row: Record<string, unknown> = {};
    const map: [keyof CalendarEventInput, string][] = [
      ['title', 'title'], ['allDay', 'all_day'], ['startDay', 'start_day'], ['endDay', 'end_day'], ['startTime', 'start_time'],
      ['endTime', 'end_time'], ['timezone', 'timezone'], ['recurrence', 'recurrence'], ['color', 'color'], ['location', 'location'],
      ['note', 'note'], ['reminders', 'reminders'], ['work', 'work'],
    ];
    for (const [k, c] of map) if (p[k] !== undefined) row[c] = p[k];
    // Sans variante, une création n'écrit pas la colonne : rien ne casse avant la migration.
    if (p.variants !== undefined && (p.variants.length > 0 || !insert)) row.variants = p.variants;
    if (p.allDay === true) {
      row.start_time = null;
      row.end_time = null;
    }
    return row;
  };
  return {
    listEvents: async () =>
      (await fetchAll<Record<string, any>>((first, last) => t('calendar_events').select('*').eq('user_id', userId).order('id').range(first, last))).map(toEvent),
    listExceptions: async () =>
      (await fetchAll<Record<string, any>>((first, last) => t('calendar_exceptions').select('*').eq('user_id', userId).order('id').range(first, last))).map(
        (r): EventException => ({ id: r.id, eventId: r.event_id, occurrenceDay: r.occurrence_day, kind: r.kind, override: r.override, createdAt: r.created_at }),
      ),
    getSettings: async () => {
      const row = check(await t('calendar_settings').select('timed_reminders, all_day_reminders').eq('user_id', userId).maybeSingle()) as
        | { timed_reminders: number[]; all_day_reminders: number[] }
        | null;
      return row ? { timedReminders: row.timed_reminders, allDayReminders: row.all_day_reminders } : { timedReminders: [], allDayReminders: [] };
    },
    createEvent: async (input) => toEvent(check(await t('calendar_events').insert({ ...columns(input, true), user_id: userId }).select('*').single()) as Record<string, any>),
    updateEvent: async (id, patch) => {
      check(await t('calendar_events').update(columns(patch)).eq('user_id', userId).eq('id', id));
    },
    deleteEvent: async (id) => {
      check(await t('calendar_events').delete().eq('user_id', userId).eq('id', id));
    },
    setException: async (eventId, occurrenceDay, kind, override) => {
      check(
        await t('calendar_exceptions').upsert(
          { user_id: userId, event_id: eventId, occurrence_day: occurrenceDay, kind, override: kind === 'override' ? (override ?? {}) : null },
          { onConflict: 'event_id,occurrence_day' },
        ),
      );
    },
    deleteException: async (id) => {
      check(await t('calendar_exceptions').delete().eq('user_id', userId).eq('id', id));
    },
    scheduleReminders: (reminders) => replaceReminders(userId, 'calendrier', reminders),
  };
}

/** Les données d'Objectifs d'un seul compte (tables historiques : `goals`, `tiers`, `actions`, `checkins`). */
function objectifsData(userId: string): ObjectifsData {
  const t = (table: string) => admin.from(table);
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  const toCheckin = (r: Record<string, any>): GoalCheckin => ({
    id: r.id,
    goalId: r.goal_id,
    actionId: r.action_id,
    pp: r.pp ?? 0,
    day: r.day,
    note: r.note ?? '',
    createdAt: r.created_at,
    value: num(r.value),
    title: r.title ?? null,
    ref: r.ref ?? null,
  });
  const rows = (table: string, order: string) =>
    fetchAll<Record<string, any>>((first, last) => t(table).select('*').eq('user_id', userId).order(order).order('id').range(first, last));
  return {
    listGoals: async () => {
      const [goals, tiers] = await Promise.all([rows('goals', 'position'), rows('tiers', 'position')]);
      return goals.map((g) => ({
        id: g.id,
        title: g.title,
        emoji: g.emoji ?? '🎯',
        archived: g.archived,
        createdAt: g.created_at,
        tiers: tiers
          .filter((x) => x.goal_id === g.id)
          .map((x) => ({
            id: x.id,
            goalId: x.goal_id,
            title: x.title,
            rank: x.rank,
            position: x.position,
            completedAt: x.completed_at,
            kind: x.kind ?? 'jalon',
            target: num(x.target),
            unit: x.unit ?? '',
            direction: x.direction ?? 'hausse',
            mode: x.mode ?? 'absolu',
            sources: x.sources ?? [],
          })),
      }));
    },
    listActions: async () =>
      (await rows('actions', 'position')).map((a) => ({
        id: a.id,
        goalId: a.goal_id,
        title: a.title,
        pp: a.pp,
        archived: a.archived,
        unit: a.unit ?? '',
        defaultValue: num(a.default_value),
        isMeasure: a.is_measure ?? false,
      })),
    listCheckins: async () => (await rows('checkins', 'day')).map(toCheckin),
    insertCheckin: async (row) => toCheckin(check(await t('checkins').insert({ ...row, user_id: userId }).select('*').single()) as Record<string, any>),
    updateCheckin: async (id, row) => {
      check(await t('checkins').update(row).eq('user_id', userId).eq('id', id));
    },
    deleteCheckin: async (id) => {
      check(await t('checkins').delete().eq('user_id', userId).eq('id', id));
    },
  };
}

/** Les données de Flashcards d'un seul compte. */
function flashcardsData(userId: string): FlashcardsData {
  const t = (table: string) => admin.from(table);
  return {
    listDecks: () =>
      fetchAll<FlashDeckRow>((first, last) => t('flashcards_decks').select('*').eq('user_id', userId).order('position').order('id').range(first, last)),
    insertDeck: async (row) => check(await t('flashcards_decks').insert({ ...row, user_id: userId }).select('*').single()) as FlashDeckRow,
    updateDeck: async (id, row) =>
      (check(await t('flashcards_decks').update(row).eq('user_id', userId).eq('id', id).select('*').maybeSingle()) as FlashDeckRow | null) ?? null,
    listCards: () =>
      fetchAll<FlashCardRow>((first, last) => t('flashcards_cards').select('*').eq('user_id', userId).order('created_at').order('id').range(first, last)),
    insertCards: async (rows) =>
      check(await t('flashcards_cards').insert(rows.map((r) => ({ ...r, user_id: userId }))).select('*')) as FlashCardRow[],
    updateCard: async (id, row) =>
      (check(await t('flashcards_cards').update(row).eq('user_id', userId).eq('id', id).select('*').maybeSingle()) as FlashCardRow | null) ?? null,
    deleteCard: async (id) => (check(await t('flashcards_cards').delete().eq('user_id', userId).eq('id', id).select('id')) as unknown[]).length > 0,
  };
}

/** Les données de Nutrition d'un seul compte ; la table CIQUAL est embarquée (la même que l'app). */
function nutritionData(userId: string): NutritionData {
  const t = (table: string) => admin.from(table);
  return {
    ciqual: () => ciqualTable.foods as CiqualRow[],
    listEntries: (from, to) =>
      fetchAll<NutritionEntryRow>((first, last) =>
        t('nutrition_entries').select('*').eq('user_id', userId).gte('day', from).lte('day', to).order('day').order('created_at').order('id').range(first, last),
      ),
    getEntry: async (id) => (check(await t('nutrition_entries').select('*').eq('user_id', userId).eq('id', id).maybeSingle()) as NutritionEntryRow | null) ?? null,
    insertEntries: async (rows) => check(await t('nutrition_entries').insert(rows.map((r) => ({ ...r, user_id: userId }))).select('*')) as NutritionEntryRow[],
    updateEntry: async (id, row) =>
      (check(await t('nutrition_entries').update(row).eq('user_id', userId).eq('id', id).select('*').maybeSingle()) as NutritionEntryRow | null) ?? null,
    deleteEntry: async (id) => (check(await t('nutrition_entries').delete().eq('user_id', userId).eq('id', id).select('id')) as unknown[]).length > 0,
    listFoods: () => fetchAll<NutritionFoodRow>((first, last) => t('nutrition_foods').select('*').eq('user_id', userId).order('name').order('id').range(first, last)),
    listTargets: () =>
      fetchAll<NutritionTargetRow>((first, last) => t('nutrition_targets').select('*').eq('user_id', userId).order('effective_from').order('id').range(first, last)),
  };
}

/** Les données de Projets d'un seul compte. */
function projetsData(userId: string): ProjetsData {
  const t = (table: string) => admin.from(table);
  const all = <R>(table: string) => fetchAll<R>((first, last) => t(table).select('*').eq('user_id', userId).order('id').range(first, last));
  return {
    load: async () => {
      const [clients, projects, workstreams, tasks, notes, payments, time] = await Promise.all([
        all<ProjetsRows['clients'][number]>('projets_clients'),
        all<ProjetsRows['projects'][number]>('projets_projects'),
        all<ProjetsRows['workstreams'][number]>('projets_workstreams'),
        all<ProjetsRows['tasks'][number]>('projets_tasks'),
        all<ProjetsRows['notes'][number]>('projets_notes'),
        all<ProjetsRows['payments'][number]>('projets_payments'),
        all<ProjetsRows['time'][number]>('projets_time'),
      ]);
      return { clients, projects, workstreams, tasks, notes, payments, time };
    },
    insert: async (table, row) => check(await t(table).insert({ ...row, user_id: userId }).select('*').single()) as never,
    update: async (table, id, row) => (check(await t(table).update(row).eq('user_id', userId).eq('id', id).select('*').maybeSingle()) as never) ?? null,
    remove: async (table, id) => (check(await t(table).delete().eq('user_id', userId).eq('id', id).select('id')) as unknown[]).length > 0,
    // Comme le service `expenses` de Budget pour une entrée (`direction: 'income'`).
    recordIncome: async (entry) => {
      const known = check(await t('budget_entries').select('id').eq('user_id', userId).eq('import_key', entry.ref)) as unknown[];
      if (known.length > 0) return false;
      const categories = check(await t('budget_categories').select('id, name').eq('user_id', userId)) as { id: string; name: string }[];
      const category = categories.find((c) => categoryKey(c.name) === categoryKey(entry.categoryName));
      check(
        await t('budget_entries').insert({
          user_id: userId,
          day: entry.day,
          label: entry.label,
          amount_cents: Math.abs(Math.round(entry.amountCents)),
          category_id: category?.id ?? null,
          source: 'manuelle',
          import_key: entry.ref,
          note: entry.note,
        }),
      );
      return true;
    },
  };
}

/** Les données de Hauts faits d'un seul compte (les photos ne sont que comptées). */
function hautsfaitsData(userId: string): HautsFaitsData {
  const t = (table: string) => admin.from(table);
  return {
    listFeats: () => fetchAll<FeatRow>((first, last) => t('hautsfaits_feats').select('*').eq('user_id', userId).order('date_start').order('id').range(first, last)),
    photoCounts: async () => {
      const rows = await fetchAll<{ id: string; feat_id: string }>((first, last) =>
        t('hautsfaits_photos').select('id, feat_id').eq('user_id', userId).order('id').range(first, last),
      );
      const counts = new Map<string, number>();
      for (const r of rows) counts.set(r.feat_id, (counts.get(r.feat_id) ?? 0) + 1);
      return counts;
    },
    insertFeat: async (row) => check(await t('hautsfaits_feats').insert({ ...row, user_id: userId }).select('*').single()) as FeatRow,
    updateFeat: async (id, row) => (check(await t('hautsfaits_feats').update(row).eq('user_id', userId).eq('id', id).select('*').maybeSingle()) as FeatRow | null) ?? null,
    deleteFeat: async (id) => (check(await t('hautsfaits_feats').delete().eq('user_id', userId).eq('id', id).select('id')) as unknown[]).length > 0,
  };
}

interface AtlasContext {
  today: string;
  recettes: RecettesData;
  courses: CoursesData;
  sport: SportData;
  taches: TachesData;
  bilan: BilanData;
  budget: BudgetData;
  calendar: CalendarData;
  objectifs: ObjectifsData;
  flashcards: FlashcardsData;
  nutrition: NutritionData;
  projets: ProjetsData;
  hautsfaits: HautsFaitsData;
}

/** Les outils de chaque module, chacun avec sa part du contexte. */
const tools: Tool<AtlasContext>[] = [
  ...recettesTools.map((tool) => ({ ...tool, run: (args: Record<string, unknown>, c: AtlasContext) => tool.run(args, { data: c.recettes, today: c.today }) })),
  ...coursesTools.map((tool) => ({
    ...tool,
    run: (args: Record<string, unknown>, c: AtlasContext) => tool.run(args, { data: c.courses, today: c.today, newId: () => crypto.randomUUID() }),
  })),
  ...bilanTools.map((tool) => ({ ...tool, run: (args: Record<string, unknown>, c: AtlasContext) => tool.run(args, { data: c.bilan, today: c.today }) })),
  ...hautsfaitsTools.map((tool) => ({ ...tool, run: (args: Record<string, unknown>, c: AtlasContext) => tool.run(args, { data: c.hautsfaits, today: c.today }) })),
  ...projetsTools.map((tool) => ({ ...tool, run: (args: Record<string, unknown>, c: AtlasContext) => tool.run(args, { data: c.projets, today: c.today }) })),
  ...nutritionTools.map((tool) => ({ ...tool, run: (args: Record<string, unknown>, c: AtlasContext) => tool.run(args, { data: c.nutrition, today: c.today }) })),
  ...flashcardsTools.map((tool) => ({ ...tool, run: (args: Record<string, unknown>, c: AtlasContext) => tool.run(args, { data: c.flashcards, today: c.today }) })),
  ...objectifsTools.map((tool) => ({ ...tool, run: (args: Record<string, unknown>, c: AtlasContext) => tool.run(args, { data: c.objectifs, today: c.today }) })),
  ...calendarTools.map((tool) => ({
    ...tool,
    run: (args: Record<string, unknown>, c: AtlasContext) => tool.run(args, { data: c.calendar, today: c.today, now: new Date(), timezone: TIME_ZONE }),
  })),
  ...budgetTools.map((tool) => ({ ...tool, run: (args: Record<string, unknown>, c: AtlasContext) => tool.run(args, { data: c.budget, today: c.today }) })),
  ...tachesTools.map((tool) => ({
    ...tool,
    run: (args: Record<string, unknown>, c: AtlasContext) =>
      tool.run(args, { data: c.taches, today: c.today, now: new Date().toISOString(), newId: () => crypto.randomUUID(), timezone: TIME_ZONE }),
  })),
  ...sportTools.map((tool) => ({ ...tool, run: (args: Record<string, unknown>, c: AtlasContext) => tool.run(args, { data: c.sport, today: c.today }) })),
];

function serverInfo(day: string): ServerInfo {
  return {
    name: 'atlas',
    title: 'Atlas',
    version: VERSION,
    instructions: [
      'Atlas est l’application personnelle de Jules : un module par domaine de sa vie. Ce connecteur en ouvre plusieurs, un préfixe d’outils chacun :',
      '- Recettes (recettes_*) : le carnet, le menu de la semaine midi et soir, les recettes faites, les ingrédients « toujours là ». Retrouve l’identifiant d’une recette avec recettes_lister avant de la modifier ; une recette d’un site : les ingrédients un par ligne, quantité en tête, et les étapes dans l’ordre. Minuter une recette (plusieurs choses en parallèle : l’eau qui chauffe pendant qu’on émince) = recettes_minuter, étape par étape : poste, durée, « ça cuit tout seul » ou non, ce qui la déclenche ; recettes_lire rend les temps déjà réglés (steps_timing).',
      '- Courses (courses_*) : la liste, le catalogue, l’historique. Une photo de ticket de caisse : lis-la, puis courses_catalogue, puis courses_enregistrer_ticket.',
      '- Sport (sport_*) : la course à pied, le plan marathon, le renforcement et le vélo. Commence par sport_resume ; pour les séances d’une semaine, sport_semaine_programmer (elles remplacent celles de la semaine).',
      '- Tâches (taches_*) : la to-do list. Lis toi-même les dates (« demain 9 h » → planned_day et planned_time).',
      '- Calendar (calendrier_*) : les rendez-vous et événements. Une série répétée se modifie ou se supprime pour cet événement, les suivants ou tous : demande si ce n’est pas clair. Une série peut avoir des variantes (« Travail » au bureau ou en télétravail) : la variante d’un jour se choisit avec calendrier_variante, sans toucher au reste.',
      '- Objectifs (objectifs_*) : les habitudes et leurs paliers (rangs Fer → Challenger). « J’ai lu 30 pages » : objectifs_cocher avec la quantité. Un palier atteint est validé par l’app à son ouverture.',
      '- Flashcards (flashcards_*) : des paquets de cartes à réviser. « Fais-moi des cartes sur ce cours » : une idée par carte, recto court, verso précis, puis flashcards_cartes_ajouter.',
      '- Nutrition (nutrition_*) : le journal des repas, calories et macros. Cherche chaque aliment (nutrition_chercher) avant de l’ajouter ; une estimation seulement à défaut, dite comme telle.',
      '- Projets (projets_*) : les projets clients du freelance (sites pour commerçants). Après un rendez-vous : une note au journal, les tâches, le temps passé, ce qu’on attend du client. Un paiement reçu va aussi à Budget.',
      '- Hauts faits (hautsfaits_*) : les grands moments d’une vie, sur une frise. Un souvenir raconté devient un haut fait, daté à la précision connue ; les photos s’ajoutent dans l’app.',
      '- Budget (budget_*) : les opérations et leurs catégories. Pour les « à classer » : budget_ecritures (a_classer), budget_classer, puis une règle pour les suivantes.',
      '- atlas_bilan : le bilan d’une semaine ou d’un mois, tous modules d’un coup.',
      'Entre modules : une recette vers les courses = recettes_lire, sans les ingrédients « toujours là » (recettes_toujours_la), quantités ajustées aux personnes, montrées à Jules avant courses_liste_ajouter — jamais sans sa relecture. Un ticket de caisse et un paiement de projet vont seuls dans Budget ; une sortie de Sport coche seule Objectifs.',
      `Aujourd’hui : ${day} (heure de Paris). Les jours s’écrivent AAAA-MM-JJ, les heures HH:MM.`,
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
    const context: AtlasContext = { today: day, recettes: recettesData(account.userId), courses: coursesData(account.userId), sport: sportData(account.userId), taches: tachesData(account.userId), bilan: bilanData(account.userId), budget: budgetData(account.userId), calendar: calendarData(account.userId), objectifs: objectifsData(account.userId), flashcards: flashcardsData(account.userId), nutrition: nutritionData(account.userId), projets: projetsData(account.userId), hautsfaits: hautsfaitsData(account.userId) };
    const answer = await handleBody(body, tools, serverInfo(day), context);
    if (answer === null) return new Response(null, { status: 202, headers: CORS });
    return json(answer);
  } catch (err) {
    console.error('atlas-mcp', err);
    return json({ jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Erreur interne.' } }, 500);
  }
});
