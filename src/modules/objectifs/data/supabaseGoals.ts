import type { SupabaseClient } from '@supabase/supabase-js';
import type { RankId } from '../lib/ranks';
import type {
  Action,
  ActionInput,
  Checkin,
  Goal,
  GoalInput,
  Tier,
  TierInput,
} from '../lib/types';
import { DEFAULT_ACTIONS, JALON } from '../lib/types';

import { getClient, requireUserId, unwrap } from '../../../core/data/supabaseClient';
import type { GoalsBackup, GoalsStore, UnlockedAchievement } from './goalsStore';

interface GoalRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  emoji: string | null;
  position: number;
  archived: boolean;
  created_at: string;
}

interface TierRow {
  id: string;
  goal_id: string;
  user_id: string;
  title: string;
  rank: string;
  position: number;
  completed_at: string | null;
  created_at: string;
  kind: string | null;
  target: number | string | null;
  unit: string | null;
  direction: string | null;
  mode: string | null;
  sources: string[] | null;
}

interface CheckinRow {
  id: string;
  goal_id: string;
  user_id: string;
  action_id: string | null;
  pp: number | null;
  day: string;
  note: string | null;
  created_at: string;
  value: number | string | null;
  title: string | null;
}

/** Postgres renvoie `numeric` en texte pour préserver la précision. */
function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toCheckin(row: CheckinRow): Checkin {
  return {
    id: row.id,
    goalId: row.goal_id,
    actionId: row.action_id ?? null,
    // Les check-ins d'avant les actions valent leurs 10 PP d'origine.
    pp: typeof row.pp === 'number' ? row.pp : 10,
    day: row.day,
    note: row.note ?? '',
    createdAt: row.created_at,
    value: toNumber(row.value),
    title: row.title ?? null,
  };
}

interface ActionRow {
  id: string;
  goal_id: string;
  user_id: string;
  title: string;
  pp: number;
  position: number;
  archived: boolean;
  created_at: string;
  unit: string | null;
  default_value: number | string | null;
  is_measure: boolean | null;
}

function toAction(row: ActionRow): Action {
  return {
    id: row.id,
    goalId: row.goal_id,
    title: row.title,
    pp: row.pp,
    position: row.position,
    archived: row.archived,
    createdAt: row.created_at,
    unit: row.unit ?? '',
    defaultValue: toNumber(row.default_value),
    isMeasure: row.is_measure ?? false,
  };
}

function toTier(row: TierRow): Tier {
  return {
    id: row.id,
    goalId: row.goal_id,
    title: row.title,
    rank: row.rank as RankId,
    position: row.position,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    kind: (row.kind as Tier['kind']) ?? 'jalon',
    target: toNumber(row.target),
    unit: row.unit ?? '',
    direction: (row.direction as Tier['direction']) ?? 'hausse',
    mode: (row.mode as Tier['mode']) ?? 'absolu',
    sources: row.sources ?? [],
  };
}

/**
 * Toutes les colonnes de comptage, systématiquement, valeurs par défaut
 * comprises.
 *
 * Indispensable pour une insertion en lot : PostgREST prend l'union des clés
 * de toutes les lignes envoyées et met **null** dans celles qui manquent
 * — la valeur par défaut de la colonne ne s'applique pas. Un objectif mêlant
 * des paliers comptables et des jalons (« Épargner 500 € » puis « 3 mois de
 * dépenses de côté ») envoyait donc `kind` pour les uns et rien pour l'autre,
 * et Postgres refusait le lot entier :
 *     null value in column "kind" of relation "tiers" violates not-null
 * Un objectif entièrement fait de jalons passait, lui, sans rien dire :
 * aucune ligne ne portait la clé, la colonne gardait son défaut.
 */
export function tierColumnsFull(input: Partial<TierInput>): Record<string, unknown> {
  return {
    kind: input.kind ?? JALON.kind,
    target: input.target ?? JALON.target,
    unit: input.unit ?? JALON.unit,
    direction: input.direction ?? JALON.direction,
    mode: input.mode ?? JALON.mode,
    sources: input.sources ?? JALON.sources,
  };
}

/**
 * Colonnes réellement modifiées, pour une mise à jour.
 * Ici l'omission est le sens voulu : ne pas toucher à ce qu'on n'a pas édité.
 */
function tierColumns(input: Partial<TierInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (input.kind !== undefined) row.kind = input.kind;
  if (input.target !== undefined) row.target = input.target;
  if (input.unit !== undefined) row.unit = input.unit;
  if (input.direction !== undefined) row.direction = input.direction;
  if (input.mode !== undefined) row.mode = input.mode;
  if (input.sources !== undefined) row.sources = input.sources;
  return row;
}

function toGoal(row: GoalRow, tiers: TierRow[]): Goal {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    emoji: row.emoji ?? '🎯',
    position: row.position,
    archived: row.archived,
    createdAt: row.created_at,
    tiers: tiers
      .filter((t) => t.goal_id === row.id)
      .sort((a, b) => a.position - b.position)
      .map(toTier),
  };
}

/** Objectifs stockés sur Supabase, protégés par le Row Level Security. */
export class SupabaseGoals implements GoalsStore {
  private client: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.client = getClient(url, anonKey);
  }

  private requireUserId(): Promise<string> {
    return requireUserId(this.client);
  }


  async listGoals(): Promise<Goal[]> {
    const goals = unwrap(
      await this.client.from('goals').select('*').order('position', { ascending: true }),
    ) as GoalRow[];
    const tiers = unwrap(
      await this.client.from('tiers').select('*').order('position', { ascending: true }),
    ) as TierRow[];
    return goals.map((g) => toGoal(g, tiers));
  }


  async createGoal(input: GoalInput, tiers: TierInput[]): Promise<Goal> {
    const userId = await this.requireUserId();
    const { count } = await this.client
      .from('goals')
      .select('id', { count: 'exact', head: true });

    const goalRow = unwrap(
      await this.client
        .from('goals')
        .insert({
          user_id: userId,
          title: input.title,
          description: input.description,
          emoji: input.emoji,
          position: count ?? 0,
        })
        .select()
        .single(),
    ) as GoalRow;

    let tierRows: TierRow[] = [];
    if (tiers.length > 0) {
      tierRows = unwrap(
        await this.client
          .from('tiers')
          .insert(
            tiers.map((t, index) => ({
              goal_id: goalRow.id,
              user_id: userId,
              title: t.title,
              rank: t.rank,
              position: index,
              ...tierColumnsFull(t),
            })),
          )
          .select(),
      ) as TierRow[];
    }

    // Tout objectif naît avec ses deux actions génériques : aucun formulaire à
    // remplir avant la première victoire.
    const { error: actionsError } = await this.client.from('actions').insert(
      DEFAULT_ACTIONS.map((a, index) => ({
        goal_id: goalRow.id,
        user_id: userId,
        title: a.title,
        pp: a.pp,
        position: index,
      })),
    );
    if (actionsError) throw new Error(actionsError.message);

    return toGoal(goalRow, tierRows);
  }


  async updateGoal(id: string, patch: Partial<GoalInput> & { archived?: boolean }) {
    const row: Record<string, unknown> = {};
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.description !== undefined) row.description = patch.description;
    if (patch.emoji !== undefined) row.emoji = patch.emoji;
    if (patch.archived !== undefined) row.archived = patch.archived;
    const { error } = await this.client.from('goals').update(row).eq('id', id);
    if (error) throw new Error(error.message);
  }


  async deleteGoal(id: string) {
    // Les paliers partent avec l'objectif grâce au ON DELETE CASCADE du schéma.
    const { error } = await this.client.from('goals').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }


  async createTier(goalId: string, input: TierInput): Promise<Tier> {
    const userId = await this.requireUserId();
    const { count } = await this.client
      .from('tiers')
      .select('id', { count: 'exact', head: true })
      .eq('goal_id', goalId);

    const row = unwrap(
      await this.client
        .from('tiers')
        .insert({
          goal_id: goalId,
          user_id: userId,
          title: input.title,
          rank: input.rank,
          position: count ?? 0,
          ...tierColumnsFull(input),
        })
        .select()
        .single(),
    ) as TierRow;
    return toTier(row);
  }


  async updateTier(id: string, patch: Partial<TierInput> & { completedAt?: string | null }) {
    const row: Record<string, unknown> = { ...tierColumns(patch) };
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.rank !== undefined) row.rank = patch.rank;
    if (patch.completedAt !== undefined) row.completed_at = patch.completedAt;
    const { error } = await this.client.from('tiers').update(row).eq('id', id);
    if (error) throw new Error(error.message);
  }


  async deleteTier(id: string) {
    const { error } = await this.client.from('tiers').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }


  async reorderTiers(_goalId: string, orderedIds: string[]) {
    for (let i = 0; i < orderedIds.length; i++) {
      const { error } = await this.client.from('tiers').update({ position: i }).eq('id', orderedIds[i]);
      if (error) throw new Error(error.message);
    }
  }


  async listActions(): Promise<Action[]> {
    const rows = unwrap(
      await this.client
        .from('actions')
        .select('*')
        .eq('archived', false)
        .order('position', { ascending: true }),
    ) as ActionRow[];
    return rows.map(toAction);
  }


  async createAction(goalId: string, input: ActionInput): Promise<Action> {
    const userId = await this.requireUserId();
    const { count } = await this.client
      .from('actions')
      .select('id', { count: 'exact', head: true })
      .eq('goal_id', goalId);
    const row = unwrap(
      await this.client
        .from('actions')
        .insert({
          goal_id: goalId,
          user_id: userId,
          title: input.title,
          pp: input.pp,
          position: count ?? 0,
          unit: input.unit ?? '',
          default_value: input.defaultValue ?? null,
          is_measure: input.isMeasure ?? false,
        })
        .select()
        .single(),
    ) as ActionRow;
    return toAction(row);
  }


  async updateAction(id: string, patch: Partial<ActionInput> & { archived?: boolean }) {
    const row: Record<string, unknown> = {};
    if (patch.title !== undefined) row.title = patch.title;
    if (patch.pp !== undefined) row.pp = patch.pp;
    if (patch.archived !== undefined) row.archived = patch.archived;
    if (patch.unit !== undefined) row.unit = patch.unit;
    if (patch.defaultValue !== undefined) row.default_value = patch.defaultValue;
    if (patch.isMeasure !== undefined) row.is_measure = patch.isMeasure;
    const { error } = await this.client.from('actions').update(row).eq('id', id);
    if (error) throw new Error(error.message);
  }


  async deleteAction(id: string) {
    // Les réalisations passées gardent leurs PP (ON DELETE SET NULL côté SQL) :
    // supprimer une action ne réécrit pas l'historique.
    const { error } = await this.client.from('actions').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }


  async listCheckins(): Promise<Checkin[]> {
    const rows = unwrap(
      await this.client.from('checkins').select('*').order('day', { ascending: true }),
    ) as CheckinRow[];
    return rows.map(toCheckin);
  }


  async addCheckin(
    goalId: string,
    day: string,
    actionId: string,
    pp: number,
    value: number | null = null,
  ): Promise<Checkin> {
    const userId = await this.requireUserId();
    // upsert sur la contrainte unique : re-cliquer le même jour ne crée pas de doublon.
    const row = unwrap(
      await this.client
        .from('checkins')
        .upsert(
          { goal_id: goalId, user_id: userId, action_id: actionId, pp, day, value },
          { onConflict: 'user_id,action_id,day' },
        )
        .select()
        .single(),
    ) as CheckinRow;
    return toCheckin(row);
  }


  async addOneOff(goalId: string, day: string, title: string, pp: number): Promise<Checkin> {
    const userId = await this.requireUserId();
    // Insertion simple et non upsert : la contrainte d'unicité porte sur
    // (user, action, jour), et une action nulle est distincte de toute autre.
    // Deux gestes ponctuels le même jour sont donc parfaitement légitimes.
    const row = unwrap(
      await this.client
        .from('checkins')
        .insert({
          goal_id: goalId,
          user_id: userId,
          action_id: null,
          pp,
          day,
          title: title.trim(),
        })
        .select()
        .single(),
    ) as CheckinRow;
    return toCheckin(row);
  }


  async updateCheckin(id: string, patch: { note?: string; value?: number | null }) {
    const row: Record<string, unknown> = {};
    if (patch.note !== undefined) row.note = patch.note;
    if (patch.value !== undefined) row.value = patch.value;
    const { error } = await this.client.from('checkins').update(row).eq('id', id);
    if (error) throw new Error(error.message);
  }


  async deleteCheckin(id: string) {
    const { error } = await this.client.from('checkins').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }


  async listAchievements(): Promise<UnlockedAchievement[]> {
    const rows = unwrap(
      await this.client.from('achievements').select('achievement_id, unlocked_at'),
    ) as { achievement_id: string; unlocked_at: string }[];
    return rows.map((r) => ({ id: r.achievement_id, unlockedAt: r.unlocked_at }));
  }


  async unlockAchievements(ids: string[]) {
    if (ids.length === 0) return;
    const userId = await this.requireUserId();
    const { error } = await this.client.from('achievements').upsert(
      ids.map((id) => ({ user_id: userId, achievement_id: id })),
      { onConflict: 'user_id,achievement_id', ignoreDuplicates: true },
    );
    if (error) throw new Error(error.message);
  }

  async exportData(): Promise<GoalsBackup> {
    return {
      goals: await this.listGoals(),
      actions: await this.listActions(),
      checkins: await this.listCheckins(),
      achievements: await this.listAchievements(),
    };
  }


  async importData(backup: GoalsBackup) {
    const userId = await this.requireUserId();
    // Les objectifs reçoivent de nouveaux ids côté serveur : on garde la
    // correspondance ancien → nouveau pour rebrancher les check-ins.
    const idMap = new Map<string, string>();
    for (const goal of backup.goals) {
      const created = await this.createGoal(
        { title: goal.title, description: goal.description, emoji: goal.emoji },
        [],
      );
      idMap.set(goal.id, created.id);
      if (goal.tiers.length > 0) {
        const rows = goal.tiers.map((t, index) => ({
          goal_id: created.id,
          user_id: userId,
          title: t.title,
          rank: t.rank,
          position: index,
          completed_at: t.completedAt,
          kind: t.kind ?? 'jalon',
          target: t.target ?? null,
          unit: t.unit ?? '',
          direction: t.direction ?? 'hausse',
          mode: t.mode ?? 'absolu',
          sources: [],
        }));
        const { error } = await this.client.from('tiers').insert(rows);
        if (error) throw new Error(error.message);
      }
    }
    // Les actions de la sauvegarde remplacent les deux génériques créées par
    // createGoal, et reçoivent elles aussi de nouveaux ids.
    const actionMap = new Map<string, string>();
    const backupActions = (backup.actions ?? []).filter((a) => idMap.has(a.goalId));
    if (backupActions.length > 0) {
      const goalsWithActions = new Set(backupActions.map((a) => idMap.get(a.goalId) as string));
      const { error: cleanError } = await this.client
        .from('actions')
        .delete()
        .in('goal_id', [...goalsWithActions]);
      if (cleanError) throw new Error(cleanError.message);

      const created = unwrap(
        await this.client
          .from('actions')
          .insert(
            backupActions.map((a) => ({
              goal_id: idMap.get(a.goalId),
              user_id: userId,
              title: a.title,
              pp: a.pp,
              position: a.position,
              archived: a.archived,
              unit: a.unit ?? '',
              default_value: a.defaultValue ?? null,
              is_measure: a.isMeasure ?? false,
            })),
          )
          .select(),
      ) as ActionRow[];
      backupActions.forEach((a, i) => actionMap.set(a.id, created[i].id));
    }

    const checkins = (backup.checkins ?? []).filter((c) => idMap.has(c.goalId));
    if (checkins.length > 0) {
      const { error } = await this.client.from('checkins').insert(
        checkins.map((c) => ({
          goal_id: idMap.get(c.goalId),
          user_id: userId,
          action_id: c.actionId ? (actionMap.get(c.actionId) ?? null) : null,
          pp: c.pp ?? 10,
          day: c.day,
          note: c.note ?? '',
          value: c.value ?? null,
          title: c.title ?? null,
          created_at: c.createdAt,
        })),
      );
      if (error) throw new Error(error.message);
    }
    await this.unlockAchievements((backup.achievements ?? []).map((a) => a.id));
  }
}
