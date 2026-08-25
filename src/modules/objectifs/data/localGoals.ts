import { newId } from '../../../core/data/coreStore';
import { readRaw, writeRaw } from '../../../core/data/localSnapshot';
import type { Action, ActionInput, Checkin, Goal, GoalInput, Tier, TierInput } from '../lib/types';
import { DEFAULT_ACTIONS, JALON } from '../lib/types';
import type { GoalsBackup, GoalsStore, UnlockedAchievement } from './goalsStore';

interface Snapshot extends GoalsBackup {}

/**
 * Lecture des seules sections du module, avec la remise à niveau des
 * sauvegardes antérieures : ni note, ni action, ni PP figés à l'époque.
 */
function read(): Snapshot {
  const raw = readRaw();
  const checkins = Array.isArray(raw.checkins) ? (raw.checkins as Checkin[]) : [];
  return {
    goals: Array.isArray(raw.goals) ? (raw.goals as Goal[]) : [],
    actions: Array.isArray(raw.actions) ? (raw.actions as Action[]) : [],
    checkins: checkins.map((c) => ({
      ...c,
      note: c.note ?? '',
      actionId: c.actionId ?? null,
      pp: typeof c.pp === 'number' ? c.pp : 10,
      value: typeof c.value === 'number' ? c.value : null,
      title: typeof c.title === 'string' ? c.title : null,
    })),
    achievements: Array.isArray(raw.achievements) ? (raw.achievements as UnlockedAchievement[]) : [],
  };
}

/** Écriture par fusion : les sections des autres modules sont préservées. */
function write(snapshot: Snapshot) {
  writeRaw({ ...readRaw(), ...snapshot });
}

/** Champs de comptage effectivement fournis, pour ne pas écraser les défauts. */
function countingFields(input: Partial<TierInput>) {
  const out: Record<string, unknown> = {};
  if (input.kind !== undefined) out.kind = input.kind;
  if (input.target !== undefined) out.target = input.target;
  if (input.unit !== undefined) out.unit = input.unit;
  if (input.direction !== undefined) out.direction = input.direction;
  if (input.mode !== undefined) out.mode = input.mode;
  if (input.sources !== undefined) out.sources = input.sources;
  return out;
}

/** Objectifs stockés dans le navigateur, sans compte ni serveur. */
export class LocalGoals implements GoalsStore {

  async listGoals(): Promise<Goal[]> {
    const { goals } = read();
    return goals
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((g) => ({ ...g, tiers: g.tiers.slice().sort((a, b) => a.position - b.position) }));
  }


  async createGoal(
    input: GoalInput,
    tiers: TierInput[],
    actions: ActionInput[] = DEFAULT_ACTIONS,
  ): Promise<Goal> {
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
        ...JALON,
        ...countingFields(t),
      })),
    };
    snapshot.goals.push(goal);
    // Tout objectif naît avec ses deux actions génériques : aucun formulaire à
    // remplir avant la première victoire.
    actions.forEach((a, index) => {
      snapshot.actions.push({
        id: newId(),
        goalId,
        title: a.title,
        pp: a.pp,
        position: index,
        archived: false,
        createdAt: now,
        unit: a.unit ?? '',
        defaultValue: a.defaultValue ?? null,
        isMeasure: a.isMeasure ?? false,
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
      ...JALON,
      ...countingFields(input),
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
      unit: input.unit ?? '',
      defaultValue: input.defaultValue ?? null,
      isMeasure: input.isMeasure ?? false,
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


  async addCheckin(
    goalId: string,
    day: string,
    actionId: string,
    pp: number,
    value: number | null = null,
  ): Promise<Checkin> {
    const snapshot = read();
    const existing = snapshot.checkins.find((c) => c.actionId === actionId && c.day === day);
    if (existing) {
      if (value !== null && existing.value !== value) {
        existing.value = value;
        write(snapshot);
      }
      return existing;
    }
    const checkin: Checkin = {
      id: newId(),
      goalId,
      actionId,
      pp,
      day,
      note: '',
      createdAt: new Date().toISOString(),
      value,
      title: null,
    };
    snapshot.checkins.push(checkin);
    write(snapshot);
    return checkin;
  }


  async addOneOff(goalId: string, day: string, title: string, pp: number): Promise<Checkin> {
    const snapshot = read();
    const checkin: Checkin = {
      id: newId(),
      goalId,
      // Pas d'action : c'est précisément ce qui l'empêche de revenir demain
      // sous forme de case à cocher.
      actionId: null,
      pp,
      day,
      note: '',
      createdAt: new Date().toISOString(),
      value: null,
      title: title.trim(),
    };
    snapshot.checkins.push(checkin);
    write(snapshot);
    return checkin;
  }


  async updateCheckin(id: string, patch: { note?: string; value?: number | null }) {
    const snapshot = read();
    const checkin = snapshot.checkins.find((c) => c.id === id);
    if (!checkin) return;
    if (patch.note !== undefined) checkin.note = patch.note;
    if (patch.value !== undefined) checkin.value = patch.value;
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

  async exportData(): Promise<GoalsBackup> {
    const { actions, checkins, achievements } = read();
    return {
      goals: await this.listGoals(),
      actions: actions.slice(),
      checkins: checkins.slice(),
      achievements: achievements.slice(),
    };
  }

  async importData(data: GoalsBackup) {
    write({
      goals: data.goals,
      actions: data.actions ?? [],
      checkins: data.checkins ?? [],
      achievements: data.achievements ?? [],
    });
  }
}
