import { describe, expect, it } from 'vitest';
import { completionPlan, nextOccurrence } from './repeat';
import type { Recurrence, Task } from './types';

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 't',
    listId: null,
    parentId: null,
    title: 'Sortir les poubelles',
    note: '',
    plannedDay: '2026-09-28', // un lundi
    plannedTime: null,
    dueDay: null,
    priority: 'normale',
    recurrence: { freq: 'weekly', interval: 1 },
    repeatFrom: 'schedule',
    position: 0,
    completedAt: null,
    createdAt: '',
    ...overrides,
  };
}

const next = (rule: Recurrence, plannedDay: string, doneDay: string, repeatFrom: Task['repeatFrom'] = 'schedule') =>
  nextOccurrence({ plannedDay, recurrence: rule, repeatFrom }, doneDay)?.plannedDay ?? null;

describe('nextOccurrence — à date fixe', () => {
  it('faite le jour prévu : la suivante de la règle', () => {
    expect(next({ freq: 'weekly', interval: 1 }, '2026-09-28', '2026-09-28')).toBe('2026-10-05');
    expect(next({ freq: 'daily', interval: 2 }, '2026-09-28', '2026-09-28')).toBe('2026-09-30');
  });

  it('faite en avance : la suivante après le jour prévu, pas après aujourd’hui', () => {
    expect(next({ freq: 'weekly', interval: 1 }, '2026-09-28', '2026-09-26')).toBe('2026-10-05');
  });

  it('oubliée trois semaines : elle repart au prochain lundi, sans laisser de retards derrière', () => {
    expect(next({ freq: 'weekly', interval: 1 }, '2026-09-07', '2026-09-30')).toBe('2026-10-05');
  });

  it('plusieurs jours de la semaine, une semaine sur deux', () => {
    const rule: Recurrence = { freq: 'weekly', interval: 2, byWeekday: [1, 4] };
    expect(next(rule, '2026-09-28', '2026-09-28')).toBe('2026-10-01');
    expect(next(rule, '2026-10-01', '2026-10-01')).toBe('2026-10-12');
  });

  it('le 31 de chaque mois saute les mois sans 31', () => {
    expect(next({ freq: 'monthly', interval: 1 }, '2026-08-31', '2026-08-31')).toBe('2026-10-31');
  });

  it('s’arrête à `until`', () => {
    expect(next({ freq: 'weekly', interval: 1, until: '2026-10-04' }, '2026-09-28', '2026-09-28')).toBeNull();
  });

  it('`count` compte l’occurrence en cours et celles oubliées', () => {
    const rule: Recurrence = { freq: 'weekly', interval: 1, count: 3 };
    expect(nextOccurrence({ plannedDay: '2026-09-28', recurrence: rule, repeatFrom: 'schedule' }, '2026-09-28')?.recurrence.count).toBe(2);
    // Oubliée deux semaines : les trois occurrences sont passées.
    expect(next(rule, '2026-09-28', '2026-10-13')).toBeNull();
    expect(next({ freq: 'weekly', interval: 1, count: 1 }, '2026-09-28', '2026-09-28')).toBeNull();
  });
});

describe('nextOccurrence — après l’avoir faite', () => {
  it('N jours, semaines, mois ou ans après le jour où elle a été faite', () => {
    expect(next({ freq: 'daily', interval: 10 }, '2026-09-28', '2026-10-02', 'completion')).toBe('2026-10-12');
    expect(next({ freq: 'weekly', interval: 2 }, '2026-09-28', '2026-09-30', 'completion')).toBe('2026-10-14');
    expect(next({ freq: 'monthly', interval: 1 }, '2026-09-28', '2026-01-31', 'completion')).toBe('2026-02-28');
    expect(next({ freq: 'yearly', interval: 1 }, '2028-02-29', '2028-02-29', 'completion')).toBe('2029-02-28');
  });

  it('respecte `until` et `count`', () => {
    expect(next({ freq: 'daily', interval: 10, until: '2026-10-05' }, '2026-09-28', '2026-09-28', 'completion')).toBeNull();
    expect(nextOccurrence({ plannedDay: '2026-09-28', recurrence: { freq: 'daily', interval: 3, count: 2 }, repeatFrom: 'completion' }, '2026-09-28')?.recurrence.count).toBe(1);
    expect(next({ freq: 'daily', interval: 3, count: 1 }, '2026-09-28', '2026-09-28', 'completion')).toBeNull();
  });
});

describe('completionPlan — cocher', () => {
  const now = '2026-09-28T18:00:00.000Z';

  it('une tâche simple est notée faite, rien d’autre', () => {
    expect(completionPlan(task({ recurrence: null }), [], now, '2026-09-28', 'copy')).toEqual({
      updates: [{ id: 't', patch: { completedAt: now } }],
    });
  });

  it('une tâche répétée : une copie terminée, la tâche avance avec son échéance, ses sous-tâches se décochent', () => {
    const t = task({ dueDay: '2026-09-30', priority: 'importante', listId: 'maison' });
    const done = task({ id: 's1', parentId: 't', completedAt: now, recurrence: null });
    const open = task({ id: 's2', parentId: 't', recurrence: null });
    const plan = completionPlan(t, [done, open], now, '2026-09-28', 'copy');
    expect(plan.create).toEqual({
      id: 'copy',
      input: expect.objectContaining({ title: 'Sortir les poubelles', plannedDay: '2026-09-28', dueDay: '2026-09-30', listId: 'maison', priority: 'importante', recurrence: null }),
    });
    expect(plan.updates).toEqual([
      { id: 'copy', patch: { completedAt: now } },
      { id: 't', patch: { plannedDay: '2026-10-05', dueDay: '2026-10-07', recurrence: { freq: 'weekly', interval: 1 } } },
      { id: 's1', patch: { completedAt: null } },
    ]);
  });

  it('la dernière d’une série est simplement notée faite', () => {
    const plan = completionPlan(task({ recurrence: { freq: 'weekly', interval: 1, count: 1 } }), [], now, '2026-09-28', 'copy');
    expect(plan).toEqual({ updates: [{ id: 't', patch: { completedAt: now } }] });
  });
});
