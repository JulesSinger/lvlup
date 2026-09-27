/**
 * Le calque de Zénith dans le calendrier (Éclipse, docs/etude-calendrier.md
 * §6) — bibliothèque pure : une marque par objectif et par jour où quelque
 * chose a été fait, « ✓ 🏃 Course 8 km, Étirements ».
 */
import type { CalendarMark } from '../../../core/lib/services';
import type { Action, Checkin, Goal } from './types';

/** « 8 km », « 78,1 kg » : la quantité à la française, avec son unité. */
function quantity(value: number | null, unit: string): string {
  if (value === null) return '';
  const number = String(value).replace('.', ',');
  return unit ? ` ${number} ${unit}` : ` ${number}`;
}

export function checkinMarks(
  goals: readonly Goal[],
  actions: readonly Action[],
  checkins: readonly Checkin[],
  from: string,
  to: string,
): CalendarMark[] {
  const goalById = new Map(goals.map((g) => [g.id, g]));
  const actionById = new Map(actions.map((a) => [a.id, a]));
  const groups = new Map<string, { goal: Goal; day: string; parts: string[] }>();

  const sorted = [...checkins].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const c of sorted) {
    if (c.day < from || c.day > to) continue;
    const goal = goalById.get(c.goalId);
    if (!goal) continue; // objectif supprimé : ses réalisations sont parties avec lui
    const action = c.actionId ? actionById.get(c.actionId) : undefined;
    // Un geste ponctuel porte son titre ; une réalisation, celui de son action
    // (ou celui de l'objectif si l'action a été supprimée depuis).
    const name = c.title ?? action?.title ?? goal.title;
    const key = `${goal.id}|${c.day}`;
    if (!groups.has(key)) groups.set(key, { goal, day: c.day, parts: [] });
    groups.get(key)!.parts.push(`${name}${quantity(c.value, action?.unit ?? '')}`);
  }

  return [...groups.entries()].map(([key, { goal, day, parts }]) => ({
    id: key,
    day,
    title: `✓ ${goal.emoji ? `${goal.emoji} ` : ''}${parts.join(', ')}`,
    detail: goal.title,
  }));
}
