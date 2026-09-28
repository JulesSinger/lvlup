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
    durationMinutes: null,
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
    expect(taskMarks([t], lists, '2026-09-28', '2026-10-04', '2026-09-28')).toEqual([
      { id: 'task:a', day: '2026-09-29', title: 'Appeler le garage', detail: 'Maison · urgente', time: '09:00', checkable: true, done: false, movable: true, link: 'task:a' },
    ]);
  });

  it('sans jour prévu, à son échéance, marquée comme telle ; faite, cochée', () => {
    const t = task({ id: 'b', title: 'Impôts', dueDay: '2026-09-30', completedAt: '2026-09-28T10:00:00Z' });
    expect(taskMarks([t], [], '2026-09-28', '2026-10-04', '2026-09-28')).toEqual([
      { id: 'task:b', day: '2026-09-30', title: '⚑ Impôts', detail: 'Boîte de réception · à faire aujourd’hui', checkable: true, done: true, movable: false, link: 'task:b' },
    ]);
  });

  it('ni les tâches sans date, ni les sous-tâches, ni hors de la période ; triées par jour puis heure', () => {
    const marks = taskMarks(
      [task({ title: 'Sans date' }), task({ title: 'Sous', plannedDay: '2026-09-29', parentId: 'x' }), task({ title: 'Loin', plannedDay: '2026-11-01' }), task({ title: 'B', plannedDay: '2026-09-29', plannedTime: '14:00' }), task({ title: 'A', plannedDay: '2026-09-29' })],
      [],
      '2026-09-28',
      '2026-10-04',
      '2026-09-28',
    );
    expect(marks.map((m) => m.title)).toEqual(['A', 'B']);
  });

  it('une tâche répétée : l’occurrence en cours, cochable, puis les suivantes en aperçu', () => {
    const t = task({ id: 'w', title: 'Courses', plannedDay: '2026-09-30', plannedTime: '18:00', recurrence: { freq: 'weekly', interval: 1, byWeekday: [3] } });
    const marks = taskMarks([t], [], '2026-09-28', '2026-10-18', '2026-09-28');
    expect(marks.map((m) => [m.id, m.day, m.checkable ?? false, m.tentative ?? false])).toEqual([
      ['task:w', '2026-09-30', true, false],
      ['forecast:w:2026-10-07', '2026-10-07', false, true],
      ['forecast:w:2026-10-14', '2026-10-14', false, true],
    ]);
    expect(marks[1]).toMatchObject({ time: '18:00', link: 'task:w', detail: 'Prochaine fois · Boîte de réception · répétée' });
  });

  it('la semaine suivante : les prochaines fois, même si l’occurrence en cours n’y est pas', () => {
    const t = task({ id: 'w', title: 'Courses', plannedDay: '2026-09-28', recurrence: { freq: 'weekly', interval: 1 } });
    expect(taskMarks([t], [], '2026-10-05', '2026-10-11', '2026-09-28').map((m) => m.id)).toEqual(['forecast:w:2026-10-05']);
  });

  it('taskIdOf retrouve la tâche d’une marque', () => {
    expect(taskIdOf('task:abc')).toBe('abc');
    expect(taskIdOf('autre')).toBeNull();
  });
});
