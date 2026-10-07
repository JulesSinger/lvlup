import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAll, getClient, requireUserId, unwrap } from '../../../core/data/supabaseClient';
import {
  DEFAULT_SPORT_SETTINGS,
  type ImportToken,
  type Plan,
  type PlanInput,
  type PlanPatch,
  type PlanSession,
  type PlanSessionDraft,
  type PlanSessionPatch,
  type PlanStatus,
  type Run,
  type RunImport,
  type RunInput,
  type RunKind,
  type RunPatch,
  type RunSource,
  type SessionKind,
  type SportSettings,
} from '../lib/types';
import type { SportBackup, SportStore } from './sportStore';

/** Un lot d'écritures : assez petit pour une requête raisonnable. */
const BATCH = 500;

interface RunRow {
  id: string;
  started_at: string;
  day: string;
  distance_m: number;
  duration_s: number;
  elevation_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  kind: RunKind;
  effort: number | null;
  title: string;
  note: string;
  source: RunSource;
  source_ref: string | null;
  session_id: string | null;
  splits_s: number[] | null;
  created_at: string;
}

interface PlanRow {
  id: string;
  title: string;
  race_distance_m: number;
  race_day: string;
  race_day_confirmed: boolean;
  target_s: number | null;
  reference_distance_m: number | null;
  reference_s: number | null;
  sessions_per_week: number;
  start_day: string;
  status: PlanStatus;
  created_at: string;
}

interface SessionRow {
  id: string;
  plan_id: string;
  week: number;
  position: number;
  kind: SessionKind;
  title: string;
  distance_m: number | null;
  duration_s: number | null;
  pace_min_s: number | null;
  pace_max_s: number | null;
  hr_zone: number | null;
  instructions: string;
  day: string | null;
  created_at: string;
}

interface SettingsRow {
  hr_max: number | null;
  hr_rest: number | null;
  objectifs_action_id: string | null;
}

interface TokenRow {
  id: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
}

const toRun = (r: RunRow): Run => ({
  id: r.id,
  startedAt: r.started_at,
  day: r.day,
  distanceM: r.distance_m,
  durationS: r.duration_s,
  elevationM: r.elevation_m,
  avgHr: r.avg_hr,
  maxHr: r.max_hr,
  kind: r.kind,
  effort: r.effort,
  title: r.title,
  note: r.note,
  source: r.source,
  sourceRef: r.source_ref,
  sessionId: r.session_id,
  splitsS: r.splits_s,
  createdAt: r.created_at,
});

const toPlan = (r: PlanRow): Plan => ({
  id: r.id,
  title: r.title,
  raceDistanceM: r.race_distance_m,
  raceDay: r.race_day,
  raceDayConfirmed: r.race_day_confirmed,
  targetS: r.target_s,
  referenceDistanceM: r.reference_distance_m,
  referenceS: r.reference_s,
  sessionsPerWeek: r.sessions_per_week,
  startDay: r.start_day,
  status: r.status,
  createdAt: r.created_at,
});

const toSession = (r: SessionRow): PlanSession => ({
  id: r.id,
  planId: r.plan_id,
  week: r.week,
  position: r.position,
  kind: r.kind,
  title: r.title,
  distanceM: r.distance_m,
  durationS: r.duration_s,
  paceMinS: r.pace_min_s,
  paceMaxS: r.pace_max_s,
  hrZone: r.hr_zone,
  instructions: r.instructions,
  day: r.day,
  createdAt: r.created_at,
});

const toToken = (r: TokenRow): ImportToken => ({ id: r.id, label: r.label, createdAt: r.created_at, lastUsedAt: r.last_used_at });

/** Les colonnes d'une sortie ; seulement les champs présents (pour un patch). */
function runColumns(p: Partial<RunInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (p.startedAt !== undefined) row.started_at = p.startedAt;
  if (p.day !== undefined) row.day = p.day;
  if (p.distanceM !== undefined) row.distance_m = p.distanceM;
  if (p.durationS !== undefined) row.duration_s = p.durationS;
  if (p.elevationM !== undefined) row.elevation_m = p.elevationM;
  if (p.avgHr !== undefined) row.avg_hr = p.avgHr;
  if (p.maxHr !== undefined) row.max_hr = p.maxHr;
  if (p.kind !== undefined) row.kind = p.kind;
  if (p.effort !== undefined) row.effort = p.effort;
  if (p.title !== undefined) row.title = p.title;
  if (p.note !== undefined) row.note = p.note;
  if (p.source !== undefined) row.source = p.source;
  if (p.sourceRef !== undefined) row.source_ref = p.sourceRef;
  if (p.sessionId !== undefined) row.session_id = p.sessionId;
  if (p.splitsS !== undefined) row.splits_s = p.splitsS;
  return row;
}

function planColumns(p: Partial<PlanInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (p.title !== undefined) row.title = p.title;
  if (p.raceDistanceM !== undefined) row.race_distance_m = p.raceDistanceM;
  if (p.raceDay !== undefined) row.race_day = p.raceDay;
  if (p.raceDayConfirmed !== undefined) row.race_day_confirmed = p.raceDayConfirmed;
  if (p.targetS !== undefined) row.target_s = p.targetS;
  if (p.referenceDistanceM !== undefined) row.reference_distance_m = p.referenceDistanceM;
  if (p.referenceS !== undefined) row.reference_s = p.referenceS;
  if (p.sessionsPerWeek !== undefined) row.sessions_per_week = p.sessionsPerWeek;
  if (p.startDay !== undefined) row.start_day = p.startDay;
  if (p.status !== undefined) row.status = p.status;
  return row;
}

function sessionColumns(p: PlanSessionPatch & { planId?: string }): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (p.planId !== undefined) row.plan_id = p.planId;
  if (p.week !== undefined) row.week = p.week;
  if (p.position !== undefined) row.position = p.position;
  if (p.kind !== undefined) row.kind = p.kind;
  if (p.title !== undefined) row.title = p.title;
  if (p.distanceM !== undefined) row.distance_m = p.distanceM;
  if (p.durationS !== undefined) row.duration_s = p.durationS;
  if (p.paceMinS !== undefined) row.pace_min_s = p.paceMinS;
  if (p.paceMaxS !== undefined) row.pace_max_s = p.paceMaxS;
  if (p.hrZone !== undefined) row.hr_zone = p.hrZone;
  if (p.instructions !== undefined) row.instructions = p.instructions;
  if (p.day !== undefined) row.day = p.day;
  return row;
}

function settingsColumns(p: Partial<SportSettings>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (p.hrMax !== undefined) row.hr_max = p.hrMax;
  if (p.hrRest !== undefined) row.hr_rest = p.hrRest;
  if (p.objectifsActionId !== undefined) row.objectifs_action_id = p.objectifsActionId;
  return row;
}

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function* batches<T>(items: T[]): Generator<T[]> {
  for (let i = 0; i < items.length; i += BATCH) yield items.slice(i, i + BATCH);
}

/** Sport stocké sur Supabase, protégé par le Row Level Security. */
export class SupabaseSport implements SportStore {
  private client: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.client = getClient(url, anonKey);
  }

  private requireUserId(): Promise<string> {
    return requireUserId(this.client);
  }

  /** Création rejouable : `on conflict do nothing` sur l'id, puis relecture de la ligne. */
  private async upsertThenRead<R>(table: string, id: string, row: Record<string, unknown>): Promise<R> {
    const { error } = await this.client.from(table).upsert({ id, ...row }, { onConflict: 'id', ignoreDuplicates: true });
    check(error);
    return unwrap(await this.client.from(table).select('*').eq('id', id).single()) as R;
  }

  private async insert<R>(table: string, row: Record<string, unknown>, id?: string): Promise<R> {
    if (id) return this.upsertThenRead<R>(table, id, row);
    return unwrap(await this.client.from(table).insert(row).select().single()) as R;
  }

  // Les sorties grossissent chaque semaine, et l'archive Strava en apporte des
  // centaines d'un coup : lues par paquets (le plafond de 1 000 lignes de
  // Supabase tronque en silence).
  async listRuns(): Promise<Run[]> {
    const rows = await fetchAll<RunRow>((from, to) =>
      this.client.from('sport_runs').select('*').order('started_at').order('id').range(from, to),
    );
    return rows.map(toRun);
  }

  async createRun(input: RunInput, id?: string): Promise<Run> {
    const userId = await this.requireUserId();
    return toRun(await this.insert<RunRow>('sport_runs', { user_id: userId, ...runColumns(input) }, id));
  }

  async updateRun(id: string, patch: RunPatch) {
    check((await this.client.from('sport_runs').update(runColumns(patch)).eq('id', id)).error);
  }

  async deleteRun(id: string) {
    check((await this.client.from('sport_runs').delete().eq('id', id)).error);
  }

  async importRuns(runs: RunImport[]): Promise<number> {
    if (runs.length === 0) return 0;
    const userId = await this.requireUserId();
    const known = await fetchAll<{ source_ref: string | null }>((from, to) =>
      this.client.from('sport_runs').select('source_ref, id').not('source_ref', 'is', null).order('id').range(from, to),
    );
    const refs = new Set(known.map((r) => r.source_ref));
    const fresh = runs.filter((r, i) => !refs.has(r.sourceRef) && runs.findIndex((x) => x.sourceRef === r.sourceRef) === i);
    for (const batch of batches(fresh)) {
      const rows = batch.map((r) => ({ id: r.id, user_id: userId, ...runColumns(r) }));
      // La contrainte unique (compte, référence) reste le dernier rempart :
      // un import lancé deux fois en même temps n'écrit rien de plus.
      check((await this.client.from('sport_runs').upsert(rows, { onConflict: 'user_id,source_ref', ignoreDuplicates: true })).error);
    }
    return fresh.length;
  }

  async listPlans(): Promise<Plan[]> {
    return (unwrap(await this.client.from('sport_plans').select('*').order('race_day')) as PlanRow[]).map(toPlan);
  }

  async createPlan(input: PlanInput, id?: string): Promise<Plan> {
    const userId = await this.requireUserId();
    return toPlan(await this.insert<PlanRow>('sport_plans', { user_id: userId, ...planColumns(input) }, id));
  }

  async updatePlan(id: string, patch: PlanPatch) {
    check((await this.client.from('sport_plans').update(planColumns(patch)).eq('id', id)).error);
  }

  async deletePlan(id: string) {
    check((await this.client.from('sport_plans').delete().eq('id', id)).error);
  }

  async listSessions(): Promise<PlanSession[]> {
    const rows = await fetchAll<SessionRow>((from, to) =>
      this.client
        .from('sport_plan_sessions')
        .select('*')
        .order('plan_id')
        .order('week')
        .order('position')
        .order('id')
        .range(from, to),
    );
    return rows.map(toSession);
  }

  async addSessions(sessions: PlanSessionDraft[]) {
    if (sessions.length === 0) return;
    const userId = await this.requireUserId();
    for (const batch of batches(sessions)) {
      const rows = batch.map((s) => ({ id: s.id, user_id: userId, ...sessionColumns(s) }));
      check((await this.client.from('sport_plan_sessions').upsert(rows, { onConflict: 'id', ignoreDuplicates: true })).error);
    }
  }

  async updateSession(id: string, patch: PlanSessionPatch) {
    check((await this.client.from('sport_plan_sessions').update(sessionColumns(patch)).eq('id', id)).error);
  }

  async deleteSession(id: string) {
    check((await this.client.from('sport_plan_sessions').delete().eq('id', id)).error);
  }

  async deleteSessions(ids: string[]) {
    for (const batch of batches(ids)) {
      check((await this.client.from('sport_plan_sessions').delete().in('id', batch)).error);
    }
  }

  async getSettings(): Promise<SportSettings> {
    const row = unwrap(await this.client.from('sport_settings').select('*').maybeSingle()) as SettingsRow | null;
    if (!row) return { ...DEFAULT_SPORT_SETTINGS };
    return { hrMax: row.hr_max, hrRest: row.hr_rest, objectifsActionId: row.objectifs_action_id };
  }

  async updateSettings(patch: Partial<SportSettings>) {
    const userId = await this.requireUserId();
    const row = { user_id: userId, ...settingsColumns(patch), updated_at: new Date().toISOString() };
    check((await this.client.from('sport_settings').upsert(row, { onConflict: 'user_id' })).error);
  }

  async listTokens(): Promise<ImportToken[]> {
    const rows = unwrap(
      await this.client.from('sport_import_tokens').select('id, label, created_at, last_used_at').order('created_at'),
    ) as TokenRow[];
    return rows.map(toToken);
  }

  async createToken(tokenHash: string, label: string, id?: string): Promise<ImportToken> {
    if (!/^[0-9a-f]{64}$/.test(tokenHash)) throw new Error('Empreinte de jeton invalide.');
    const userId = await this.requireUserId();
    const row = await this.insert<TokenRow>('sport_import_tokens', { user_id: userId, token_hash: tokenHash, label }, id);
    return toToken(row);
  }

  async deleteToken(id: string) {
    check((await this.client.from('sport_import_tokens').delete().eq('id', id)).error);
  }

  async exportData(): Promise<SportBackup> {
    const [runs, plans, sessions, settings] = await Promise.all([
      this.listRuns(),
      this.listPlans(),
      this.listSessions(),
      this.getSettings(),
    ]);
    return { runs, plans, sessions, settings };
  }

  async importData(data: SportBackup) {
    const userId = await this.requireUserId();
    check((await this.client.from('sport_runs').delete().eq('user_id', userId)).error);
    // Les séances partent avec leur plan (`on delete cascade`).
    check((await this.client.from('sport_plans').delete().eq('user_id', userId)).error);

    const plans = data.plans ?? [];
    for (const batch of batches(plans)) {
      const rows = batch.map((p) => ({ id: p.id, user_id: userId, created_at: p.createdAt, ...planColumns(p) }));
      check((await this.client.from('sport_plans').insert(rows)).error);
    }
    // Les séances avant les sorties, qui pointent vers elles.
    const sessions = data.sessions ?? [];
    for (const batch of batches(sessions)) {
      const rows = batch.map((s) => ({ id: s.id, user_id: userId, created_at: s.createdAt, ...sessionColumns(s) }));
      check((await this.client.from('sport_plan_sessions').insert(rows)).error);
    }
    const runs = data.runs ?? [];
    for (const batch of batches(runs)) {
      const rows = batch.map((r) => ({ id: r.id, user_id: userId, created_at: r.createdAt, ...runColumns(r) }));
      check((await this.client.from('sport_runs').insert(rows)).error);
    }
    if (data.settings) await this.updateSettings(data.settings);
  }
}
