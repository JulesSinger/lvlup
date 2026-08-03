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
  newId,
  type Backup,
  type Settings,
  type Store,
  type UnlockedAchievement,
} from './store';

const KEY = 'palier.v1';

interface Snapshot {
  goals: Goal[];
  actions: Action[];
  checkins: Checkin[];
  achievements: UnlockedAchievement[];
  settings: Settings;
}

function read(): Snapshot {
  const empty: Snapshot = {
    goals: [],
    actions: [],
    checkins: [],
    achievements: [],
    settings: { ...DEFAULT_SETTINGS },
  };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<Snapshot>;
    return {
      goals: Array.isArray(parsed.goals) ? parsed.goals : [],
      actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      // Sauvegardes antérieures : ni note, ni action, ni PP figés.
      checkins: Array.isArray(parsed.checkins)
        ? parsed.checkins.map((c) => ({
            ...c,
            note: c.note ?? '',
            actionId: c.actionId ?? null,
            pp: typeof c.pp === 'number' ? c.pp : 10,
          }))
        : [],
      achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    };
  } catch {
    return empty;
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
    // Tout objectif naît avec ses deux actions génériques : aucun formulaire à
    // remplir avant la première victoire.
    DEFAULT_ACTIONS.forEach((a, index) => {
      snapshot.actions.push({
        id: newId(),
        goalId,
        title: a.title,
        pp: a.pp,
        position: index,
        archived: false,
        createdAt: now,
      });
    });
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
    // Actions et réalisations suivent leur objectif (ON DELETE CASCADE côté SQL).
    snapshot.actions = snapshot.actions.filter((a) => a.goalId !== id);
    snapshot.checkins = snapshot.checkins.filter((c) => c.goalId !== id);
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

  async listActions(): Promise<Action[]> {
    return read()
      .actions.filter((a) => !a.archived)
      .sort((a, b) => a.position - b.position);
  }

  async createAction(goalId: string, input: ActionInput): Promise<Action> {
    const snapshot = read();
    const siblings = snapshot.actions.filter((a) => a.goalId === goalId);
    const action: Action = {
      id: newId(),
      goalId,
      title: input.title,
      pp: input.pp,
      position: siblings.length,
      archived: false,
      createdAt: new Date().toISOString(),
    };
    snapshot.actions.push(action);
    write(snapshot);
    return action;
  }

  async updateAction(id: string, patch: Partial<ActionInput> & { archived?: boolean }) {
    const snapshot = read();
    const action = snapshot.actions.find((a) => a.id === id);
    if (!action) return;
    Object.assign(action, patch);
    write(snapshot);
  }

  async deleteAction(id: string) {
    const snapshot = read();
    snapshot.actions = snapshot.actions.filter((a) => a.id !== id);
    // Les réalisations passées gardent leurs PP : l'historique ne se réécrit pas.
    snapshot.checkins = snapshot.checkins.map((c) =>
      c.actionId === id ? { ...c, actionId: null } : c,
    );
    write(snapshot);
  }

  async listCheckins(): Promise<Checkin[]> {
    return read().checkins.slice();
  }

  async addCheckin(goalId: string, day: string, actionId: string, pp: number): Promise<Checkin> {
    const snapshot = read();
    const existing = snapshot.checkins.find((c) => c.actionId === actionId && c.day === day);
    if (existing) return existing;
    const checkin: Checkin = {
      id: newId(),
      goalId,
      actionId,
      pp,
      day,
      note: '',
      createdAt: new Date().toISOString(),
    };
    snapshot.checkins.push(checkin);
    write(snapshot);
    return checkin;
  }

  async updateCheckin(id: string, patch: { note?: string }) {
    const snapshot = read();
    const checkin = snapshot.checkins.find((c) => c.id === id);
    if (!checkin) return;
    if (patch.note !== undefined) checkin.note = patch.note;
    write(snapshot);
  }

  async deleteCheckin(id: string) {
    const snapshot = read();
    snapshot.checkins = snapshot.checkins.filter((c) => c.id !== id);
    write(snapshot);
  }

  async listAchievements(): Promise<UnlockedAchievement[]> {
    return read().achievements.slice();
  }

  async unlockAchievements(ids: string[]) {
    if (ids.length === 0) return;
    const snapshot = read();
    const known = new Set(snapshot.achievements.map((a) => a.id));
    const now = new Date().toISOString();
    for (const id of ids) {
      if (!known.has(id)) snapshot.achievements.push({ id, unlockedAt: now });
    }
    write(snapshot);
  }

  async getSettings(): Promise<Settings> {
    return { ...read().settings };
  }

  async updateSettings(patch: Partial<Settings>) {
    const snapshot = read();
    snapshot.settings = { ...snapshot.settings, ...patch };
    write(snapshot);
  }

  async exportAll(): Promise<Backup> {
    const { actions, checkins, achievements, settings } = read();
    return {
      goals: await this.listGoals(),
      actions: actions.slice(),
      checkins: checkins.slice(),
      achievements: achievements.slice(),
      settings: { ...settings },
    };
  }

  async importAll(backup: Backup) {
    write({
      goals: backup.goals,
      actions: backup.actions ?? [],
      checkins: backup.checkins ?? [],
      achievements: backup.achievements ?? [],
      settings: { ...DEFAULT_SETTINGS, ...(backup.settings ?? {}) },
    });
  }
}
