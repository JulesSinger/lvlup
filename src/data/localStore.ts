import type { AppUser, Goal, GoalInput, Tier, TierInput } from '../lib/types';
import { newId, type Store } from './store';

const KEY = 'palier.v1';

interface Snapshot {
  goals: Goal[];
}

function read(): Snapshot {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { goals: [] };
    const parsed = JSON.parse(raw) as Snapshot;
    return { goals: Array.isArray(parsed.goals) ? parsed.goals : [] };
  } catch {
    return { goals: [] };
  }
}

function write(snapshot: Snapshot) {
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch (error) {
    console.error('Sauvegarde locale impossible', error);
  }
}

const LOCAL_USER: AppUser = { id: 'local', email: 'Mode local', isLocal: true };

/**
 * Stockage dans le navigateur. Aucun compte, aucun serveur : les données
 * restent sur cet appareil. Sert de mode « démarrage immédiat » et de repli
 * quand Supabase n'est pas configuré.
 */
export class LocalStore implements Store {
  readonly isRemote = false;

  async getUser() {
    return LOCAL_USER;
  }

  onUserChange(callback: (user: AppUser | null) => void) {
    callback(LOCAL_USER);
    return () => {};
  }

  async signUp() {
    return { needsConfirmation: false };
  }
  async signIn() {}
  async signOut() {}

  async listGoals(): Promise<Goal[]> {
    const { goals } = read();
    return goals
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((g) => ({ ...g, tiers: g.tiers.slice().sort((a, b) => a.position - b.position) }));
  }

  async createGoal(input: GoalInput, tiers: TierInput[]): Promise<Goal> {
    const snapshot = read();
    const now = new Date().toISOString();
    const goalId = newId();
    const goal: Goal = {
      id: goalId,
      title: input.title,
      description: input.description,
      emoji: input.emoji,
      position: snapshot.goals.length,
      archived: false,
      createdAt: now,
      tiers: tiers.map((t, index) => ({
        id: newId(),
        goalId,
        title: t.title,
        rank: t.rank,
        position: index,
        completedAt: null,
        createdAt: now,
      })),
    };
    snapshot.goals.push(goal);
    write(snapshot);
    return goal;
  }

  async updateGoal(id: string, patch: Partial<GoalInput> & { archived?: boolean }) {
    const snapshot = read();
    const goal = snapshot.goals.find((g) => g.id === id);
    if (!goal) return;
    Object.assign(goal, patch);
    write(snapshot);
  }

  async deleteGoal(id: string) {
    const snapshot = read();
    snapshot.goals = snapshot.goals.filter((g) => g.id !== id);
    snapshot.goals.forEach((g, index) => (g.position = index));
    write(snapshot);
  }

  async createTier(goalId: string, input: TierInput): Promise<Tier> {
    const snapshot = read();
    const goal = snapshot.goals.find((g) => g.id === goalId);
    if (!goal) throw new Error('Objectif introuvable');
    const tier: Tier = {
      id: newId(),
      goalId,
      title: input.title,
      rank: input.rank,
      position: goal.tiers.length,
      completedAt: null,
      createdAt: new Date().toISOString(),
    };
    goal.tiers.push(tier);
    write(snapshot);
    return tier;
  }

  async updateTier(id: string, patch: Partial<TierInput> & { completedAt?: string | null }) {
    const snapshot = read();
    for (const goal of snapshot.goals) {
      const tier = goal.tiers.find((t) => t.id === id);
      if (tier) {
        Object.assign(tier, patch);
        write(snapshot);
        return;
      }
    }
  }

  async deleteTier(id: string) {
    const snapshot = read();
    for (const goal of snapshot.goals) {
      const index = goal.tiers.findIndex((t) => t.id === id);
      if (index !== -1) {
        goal.tiers.splice(index, 1);
        goal.tiers.forEach((t, i) => (t.position = i));
        write(snapshot);
        return;
      }
    }
  }

  async reorderTiers(goalId: string, orderedIds: string[]) {
    const snapshot = read();
    const goal = snapshot.goals.find((g) => g.id === goalId);
    if (!goal) return;
    goal.tiers.forEach((t) => {
      const index = orderedIds.indexOf(t.id);
      if (index !== -1) t.position = index;
    });
    goal.tiers.sort((a, b) => a.position - b.position);
    write(snapshot);
  }

  async exportAll() {
    return this.listGoals();
  }

  async importAll(goals: Goal[]) {
    write({ goals });
  }
}
