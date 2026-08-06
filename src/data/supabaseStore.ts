import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { RankId } from '../lib/ranks';
import type {
  Action,
  ActionInput,
  AppUser,
  Checkin,
  Goal,
  GoalInput,
  Tier,
  TierInput,
} from '../lib/types';
import { DEFAULT_ACTIONS } from '../lib/types';
import {
  DEFAULT_SETTINGS,
  type Backup,
  type PushDevice,
  type PushDeviceInput,
  type Settings,
  type Store,
  type UnlockedAchievement,
} from './store';

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
  };
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

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

/**
 * Stockage sur Supabase : Postgres hébergé + authentification par e-mail.
 * Chaque utilisateur ne voit que ses propres lignes, garanti côté serveur par
 * les policies Row Level Security de `supabase/schema.sql`.
 */
export class SupabaseStore implements Store {
  readonly isRemote = true;
  private client: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.client = createClient(url, anonKey);
  }

  private async requireUserId(): Promise<string> {
    const { data } = await this.client.auth.getUser();
    if (!data.user) throw new Error('Session expirée, reconnecte-toi.');
    return data.user.id;
  }

  async getUser(): Promise<AppUser | null> {
    const { data } = await this.client.auth.getUser();
    if (!data.user) return null;
    return { id: data.user.id, email: data.user.email ?? '', isLocal: false };
  }

  onUserChange(callback: (user: AppUser | null) => void) {
    // On s'appuie uniquement sur onAuthStateChange : l'événement INITIAL_SESSION
    // arrive une fois la session restaurée (et le jeton rafraîchi si besoin).
    // L'ancien appel parallèle à getUser() créait une course : sur un appareil
    // au jeton expiré, sa réponse « null » pouvait arriver APRÈS la session
    // restaurée et l'écraser — d'où des écrans vides au réveil de l'app.
    const { data } = this.client.auth.onAuthStateChange((_event, session) => {
      callback(
        session?.user
          ? { id: session.user.id, email: session.user.email ?? '', isLocal: false }
          : null,
      );
    });
    return () => data.subscription.unsubscribe();
  }

  async signUp(email: string, password: string) {
    const { data, error } = await this.client.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    // Sans session renvoyée, Supabase attend une confirmation par e-mail.
    return { needsConfirmation: !data.session };
  }

  async signIn(email: string, password: string) {
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }

  async signOut() {
    await this.client.auth.signOut();
  }

  async resetPassword(email: string) {
    // Supabase renvoie l'utilisateur sur l'app avec un jeton de récupération ;
    // `onPasswordRecovery` prend alors le relais côté interface.
    const { error } = await this.client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/`,
    });
    if (error) throw new Error(error.message);
  }

  async updatePassword(password: string) {
    const { error } = await this.client.auth.updateUser({ password });
    if (error) throw new Error(error.message);
  }

  onPasswordRecovery(callback: () => void) {
    const { data } = this.client.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') callback();
    });
    return () => data.subscription.unsubscribe();
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
        })
        .select()
        .single(),
    ) as TierRow;
    return toTier(row);
  }

  async updateTier(id: string, patch: Partial<TierInput> & { completedAt?: string | null }) {
    const row: Record<string, unknown> = {};
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

  async addCheckin(goalId: string, day: string, actionId: string, pp: number): Promise<Checkin> {
    const userId = await this.requireUserId();
    // upsert sur la contrainte unique : re-cliquer le même jour ne crée pas de doublon.
    const row = unwrap(
      await this.client
        .from('checkins')
        .upsert(
          { goal_id: goalId, user_id: userId, action_id: actionId, pp, day },
          { onConflict: 'user_id,action_id,day' },
        )
        .select()
        .single(),
    ) as CheckinRow;
    return toCheckin(row);
  }

  async updateCheckin(id: string, patch: { note?: string }) {
    const row: Record<string, unknown> = {};
    if (patch.note !== undefined) row.note = patch.note;
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

  async getSettings(): Promise<Settings> {
    const userId = await this.requireUserId();
    const { data, error } = await this.client
      .from('profiles')
      .select('daily_goal, reminder_enabled, reminder_time, tz_offset')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return { ...DEFAULT_SETTINGS };
    return {
      dailyGoal: data.daily_goal ?? DEFAULT_SETTINGS.dailyGoal,
      reminderEnabled: data.reminder_enabled ?? DEFAULT_SETTINGS.reminderEnabled,
      reminderTime: data.reminder_time ?? DEFAULT_SETTINGS.reminderTime,
      tzOffset: data.tz_offset ?? DEFAULT_SETTINGS.tzOffset,
    };
  }

  async updateSettings(patch: Partial<Settings>) {
    const userId = await this.requireUserId();
    const row: Record<string, unknown> = { user_id: userId };
    if (patch.dailyGoal !== undefined) row.daily_goal = patch.dailyGoal;
    if (patch.reminderEnabled !== undefined) row.reminder_enabled = patch.reminderEnabled;
    if (patch.reminderTime !== undefined) row.reminder_time = patch.reminderTime;
    if (patch.tzOffset !== undefined) row.tz_offset = patch.tzOffset;
    const { error } = await this.client
      .from('profiles')
      .upsert(row, { onConflict: 'user_id' });
    if (error) throw new Error(error.message);
  }

  async listPushDevices(): Promise<PushDevice[]> {
    const rows = unwrap(
      await this.client
        .from('push_subscriptions')
        .select('id, endpoint, label, created_at')
        .order('created_at', { ascending: true }),
    ) as { id: string; endpoint: string; label: string; created_at: string }[];
    return rows.map((r) => ({
      id: r.id,
      endpoint: r.endpoint,
      label: r.label || 'Appareil',
      createdAt: r.created_at,
    }));
  }

  async savePushDevice(input: PushDeviceInput) {
    const userId = await this.requireUserId();
    // `endpoint` est unique : ré-abonner le même appareil met à jour ses clés
    // au lieu de créer un doublon qui recevrait la notification deux fois.
    const { error } = await this.client.from('push_subscriptions').upsert(
      {
        user_id: userId,
        endpoint: input.endpoint,
        p256dh: input.p256dh,
        auth: input.auth,
        label: input.label,
        failures: 0,
      },
      { onConflict: 'endpoint' },
    );
    if (error) throw new Error(error.message);
  }

  async removePushDevice(endpoint: string) {
    const { error } = await this.client
      .from('push_subscriptions')
      .delete()
      .eq('endpoint', endpoint);
    if (error) throw new Error(error.message);
  }

  async sendTestPush(): Promise<{ sent: number; devices: number }> {
    const { data, error } = await this.client.functions.invoke('send-reminders', {
      body: { test: true },
    });
    if (error) {
      throw new Error(
        "L'envoi de test a échoué. Vérifie que la fonction « send-reminders » est déployée.",
      );
    }
    return { sent: data?.sent ?? 0, devices: data?.devices ?? 0 };
  }

  async exportAll(): Promise<Backup> {
    return {
      goals: await this.listGoals(),
      actions: await this.listActions(),
      checkins: await this.listCheckins(),
      achievements: await this.listAchievements(),
      settings: await this.getSettings(),
    };
  }

  async importAll(backup: Backup) {
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
          created_at: c.createdAt,
        })),
      );
      if (error) throw new Error(error.message);
    }
    await this.unlockAchievements((backup.achievements ?? []).map((a) => a.id));
    if (backup.settings) await this.updateSettings(backup.settings);
  }
}
