import type { CompletionPlan, UndoPlan } from '../lib/repeat';
import type { TachesStore } from './tachesStore';

/**
 * Applique les écritures d'une coche (`lib/repeat.ts`) par le seul contrat.
 * Elles ne forment pas une transaction : la copie terminée est créée
 * **avant** que la tâche avance. Une coupure entre les deux laisse au pire
 * une trace en double, jamais une occurrence disparue.
 */
export async function applyCompletion(store: TachesStore, plan: CompletionPlan): Promise<void> {
  if (plan.create) await store.createTask(plan.create.input, plan.create.id);
  for (const { id, patch } of plan.updates) await store.updateTask(id, patch);
}

/** Défait une coche : la tâche d'abord, la copie ensuite — même prudence. */
export async function applyUndo(store: TachesStore, plan: UndoPlan): Promise<void> {
  for (const { id, patch } of plan.updates) await store.updateTask(id, patch);
  if (plan.deleteId) await store.deleteTask(plan.deleteId);
}
