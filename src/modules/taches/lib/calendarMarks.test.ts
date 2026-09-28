import { describe, expect, it } from 'vitest';
import { taskIdOf, taskMarks } from './calendarMarks';
import type { Task, TaskList } from './types';

let n = 0;
const task = (overrides: Partial<Task> = {}): Task => {
  n += 1;
  return {
    id: `t${n}`,
    listId: null,
    parentId: null,
    title: `Tâche ${n}`,
    note: '',
    plannedDay: null,
    plannedTime: null,
    dueDay: null,
    priority: 'normale',
    recurrence: null,
    repeatFrom: 'schedule',
    position: 0,
    completedAt: null,
    createdAt: '',
    ...overrides,
  };
};
const lists = [{ id: 'm', name: 'Maison' }] as TaskList[];

describe('taskMarks — le calque de Polaris', () => {
  it('une tâche datée : son jour, son heure, cochable, faite ou non', () => {
    const t = task({ id: 'a', title: 'Appeler le garage', plannedDay: '2026-09-29', plannedTime: '09:00', listId: 'm', priority: 'urgente' });
    expect(taskMarks([t], lists, '2026-09-28', '2026-10-04')).toEqual([
      { id: 'task:a', day: '2026-09-29', title: 'Appeler le garage', detail: 'Maison · urgente', time: '09:00', checkable: true, done: false, link: 'task:a' },
    ]);
  });

  it('sans jour prévu, à son échéance, marquée comme telle ; faite, cochée', () => {
    const t = task({ id: 'b', title: 'Impôts', dueDay: '2026-09-30', completedAt: '2026-09-28T10:00:00Z' });
    expect(taskMarks([t], [], '2026-09-28', '2026-10-04')).toEqual([
      { id: 'task:b', day: '2026-09-30', title: '⚑ Impôts', detail: 'Boîte de réception · à faire aujourd’hui', checkable: true, done: true, link: 'task:b' },
    ]);
  });

  it('ni les tâches sans date, ni les sous-tâches, ni hors de la période ; triées par jour puis heure', () => {
    const marks = taskMarks(
      [task({ title: 'Sans date' }), task({ title: 'Sous', plannedDay: '2026-09-29', parentId: 'x' }), task({ title: 'Loin', plannedDay: '2026-11-01' }), task({ title: 'B', plannedDay: '2026-09-29', plannedTime: '14:00' }), task({ title: 'A', plannedDay: '2026-09-29' })],
      [],
      '2026-09-28',
      '2026-10-04',
    );
    expect(marks.map((m) => m.title)).toEqual(['A', 'B']);
  });

  it('taskIdOf retrouve la tâche d’une marque', () => {
    expect(taskIdOf('task:abc')).toBe('abc');
    expect(taskIdOf('autre')).toBeNull();
  });
});
