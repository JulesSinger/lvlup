import { describe, expect, it } from 'vitest';
import { lateReason, triageActions, triagePatch } from './triage';
import type { Task } from './types';

const today = '2026-09-28';
const task = (overrides: Partial<Task> = {}): Task => ({
  id: 't',
  listId: null,
  parentId: null,
  title: 'x',
  note: '',
  plannedDay: null,
  plannedTime: null,
  durationMinutes: null,
  reminders: null,
  dueDay: null,
  priority: 'normale',
  recurrence: null,
  repeatFrom: 'schedule',
  position: 0,
  completedAt: null,
  createdAt: '',
  ...overrides,
});

describe('Faire le point', () => {
  it('en retard par le jour prévu, ou par l’échéance, ou pas', () => {
    expect(lateReason({ plannedDay: '2026-09-27', dueDay: null }, today)).toBe('planned');
    expect(lateReason({ plannedDay: '2026-10-01', dueDay: '2026-09-27' }, today)).toBe('due');
    expect(lateReason({ plannedDay: today, dueDay: today }, today)).toBeNull();
  });

  it('jour prévu passé : on la reprévoit, ou on retire le jour (et l’heure)', () => {
    const late = task({ plannedDay: '2026-09-25', plannedTime: '09:00' });
    expect(triagePatch(late, { kind: 'today' }, today)).toEqual({ plannedDay: today });
    expect(triagePatch(late, { kind: 'tomorrow' }, today)).toEqual({ plannedDay: '2026-09-29' });
    expect(triagePatch(late, { kind: 'day', day: '2026-10-05' }, today)).toEqual({ plannedDay: '2026-10-05' });
    expect(triagePatch(late, { kind: 'none' }, today)).toEqual({ plannedDay: null, plannedTime: null });
  });

  it('échéance dépassée : c’est l’échéance qui bouge, jamais le jour prévu', () => {
    const late = task({ plannedDay: '2026-10-01', dueDay: '2026-09-25' });
    expect(triagePatch(late, { kind: 'tomorrow' }, today)).toEqual({ dueDay: '2026-09-29' });
    expect(triagePatch(late, { kind: 'none' }, today)).toEqual({ dueDay: null });
  });

  it('une tâche répétée en retard passe à sa prochaine occurrence, sans changer de jour de la semaine', () => {
    const weekly = task({ plannedDay: '2026-09-14', recurrence: { freq: 'weekly', interval: 1 } }); // un lundi
    expect(triageActions(weekly, today)).toEqual(['skip']);
    // On est lundi : la prochaine, c'est aujourd'hui.
    expect(triagePatch(weekly, { kind: 'skip' }, today)).toEqual({ plannedDay: today, recurrence: { freq: 'weekly', interval: 1 } });
    const tuesdays = task({ plannedDay: '2026-09-22', recurrence: { freq: 'weekly', interval: 1 } });
    expect(triagePatch(tuesdays, { kind: 'skip' }, today)?.plannedDay).toBe('2026-09-29');
    expect(triagePatch(weekly, { kind: 'today' }, today)).toBeNull();
  });

  it('rien à trier pour une tâche à l’heure', () => {
    expect(triageActions(task({ plannedDay: today }), today)).toEqual([]);
    expect(triagePatch(task({ plannedDay: today }), { kind: 'tomorrow' }, today)).toBeNull();
  });
});
