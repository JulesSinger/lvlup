import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { RankId } from '../lib/ranks';
import type { AppUser, Goal, GoalInput, Tier, TierInput } from '../lib/types';
import type { Store } from './store';

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
    void this.getUser().then(callback);
    const { data } = this.client.auth.onAuthStateChange((_event, session) => {
      callback(
        session?.user ? { id: session.user.id, email: session.user.email ?? '', isLocal: false } : null,
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

  async exportAll() {
    return this.listGoals();
  }

  async importAll(goals: Goal[]) {
    const userId = await this.requireUserId();
    for (const goal of goals) {
      await this.createGoal(
        { title: goal.title, description: goal.description, emoji: goal.emoji },
        [],
      ).then(async (created) => {
        if (goal.tiers.length === 0) return;
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
      });
    }
  }
}
