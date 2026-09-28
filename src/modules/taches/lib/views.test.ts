import { describe, expect, it } from 'vitest';
import { compareTasks, doneView, dueStatus, inboxView, listView, subtasksOf, todayView, upcomingView } from './views';
import type { Task } from './types';

const today = '2026-09-28';
let n = 0;
function task(overrides: Partial<Task> = {}): Task {
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
    createdAt: `2026-09-01T00:00:0${n % 10}Z`,
    ...overrides,
  };
}
const titles = (tasks: Task[]) => tasks.map((t) => t.title);

describe('dueStatus', () => {
  it('dépassée, aujourd’hui, proche (2 jours), ou rien', () => {
    expect(dueStatus({ dueDay: '2026-09-27' }, today)).toBe('overdue');
    expect(dueStatus({ dueDay: today }, today)).toBe('today');
    expect(dueStatus({ dueDay: '2026-09-30' }, today)).toBe('soon');
    expect(dueStatus({ dueDay: '2026-10-01' }, today)).toBeNull();
    expect(dueStatus({ dueDay: null }, today)).toBeNull();
  });
});

describe('todayView', () => {
  it('les retards à part, puis le jour : prévu aujourd’hui ou échéance proche', () => {
    const tasks = [
      task({ title: 'Prévue hier', plannedDay: '2026-09-27' }),
      task({ title: 'Échéance dépassée', dueDay: '2026-09-26' }),
      task({ title: 'Prévue aujourd’hui', plannedDay: today }),
      task({ title: 'Échéance après-demain', dueDay: '2026-09-30' }),
      task({ title: 'Prévue demain', plannedDay: '2026-09-29' }),
      task({ title: 'Sans date' }),
      task({ title: 'Faite', plannedDay: today, completedAt: '2026-09-28T08:00:00Z' }),
      task({ title: 'Sous-tâche', plannedDay: today, parentId: 'x' }),
    ];
    const view = todayView(tasks, today);
    expect(titles(view.overdue).sort()).toEqual(['Prévue hier', 'Échéance dépassée'].sort());
    expect(titles(view.today).sort()).toEqual(['Prévue aujourd’hui', 'Échéance après-demain'].sort());
  });

  it('une tâche prévue plus tard mais dont l’échéance est dépassée est en retard, une seule fois', () => {
    const view = todayView([task({ title: 'Impôts', plannedDay: '2026-10-02', dueDay: '2026-09-27' })], today);
    expect([titles(view.overdue), titles(view.today)]).toEqual([['Impôts'], []]);
  });
});

describe('compareTasks — l’ordre d’une journée', () => {
  it('les heures d’abord, puis la priorité, puis l’échéance, puis l’ordre manuel', () => {
    const list = [
      task({ title: 'Normale', position: 1 }),
      task({ title: 'Normale avant', position: 0 }),
      task({ title: 'Échéance proche', dueDay: '2026-09-30' }),
      task({ title: 'Urgente', priority: 'urgente' }),
      task({ title: '14 h', plannedTime: '14:00' }),
      task({ title: '9 h', plannedTime: '09:00' }),
      task({ title: 'Importante', priority: 'importante' }),
    ];
    expect(titles(list.sort(compareTasks))).toEqual(['9 h', '14 h', 'Urgente', 'Importante', 'Échéance proche', 'Normale avant', 'Normale']);
  });
});

describe('upcomingView', () => {
  it('14 jours après aujourd’hui, jours vides compris ; une échéance sans jour prévu tombe à son échéance', () => {
    const view = upcomingView(
      [task({ title: 'Demain', plannedDay: '2026-09-29' }), task({ title: 'Échéance', dueDay: '2026-10-01' }), task({ title: 'Trop loin', plannedDay: '2026-10-20' }), task({ title: 'Aujourd’hui', plannedDay: today })],
      today,
    );
    expect(view).toHaveLength(14);
    expect(view[0]).toEqual({ day: '2026-09-29', tasks: [expect.objectContaining({ title: 'Demain' })] });
    expect(titles(view[2].tasks)).toEqual(['Échéance']);
    expect(view.flatMap((d) => titles(d.tasks))).not.toContain('Trop loin');
    expect(view.flatMap((d) => titles(d.tasks))).not.toContain('Aujourd’hui');
  });
});

describe('boîte de réception, listes, sous-tâches, terminées', () => {
  it('la boîte de réception : ce qui n’a pas de liste, daté ou non', () => {
    expect(titles(inboxView([task({ title: 'A' }), task({ title: 'B', plannedDay: today }), task({ title: 'C', listId: 'l' })])).sort()).toEqual(['A', 'B']);
  });

  it('une liste, dans l’ordre choisi', () => {
    expect(titles(listView([task({ title: '2', listId: 'l', position: 2 }), task({ title: '1', listId: 'l', position: 1 }), task({ title: 'x', listId: 'm' })], 'l'))).toEqual(['1', '2']);
  });

  it('les sous-tâches d’une tâche, faites comprises', () => {
    const tasks = [task({ title: 'b', parentId: 'p', position: 1 }), task({ title: 'a', parentId: 'p', position: 0, completedAt: 'x' }), task({ title: 'c', parentId: 'q' })];
    expect(titles(subtasksOf(tasks, 'p'))).toEqual(['a', 'b']);
  });

  it('les terminées, les plus récentes d’abord, par jour', () => {
    const view = doneView(
      [task({ title: 'Lundi', completedAt: '2026-09-28T08:00:00Z' }), task({ title: 'Dimanche', completedAt: '2026-09-27T20:00:00Z' }), task({ title: 'Lundi soir', completedAt: '2026-09-28T19:00:00Z' }), task({ title: 'Pas faite' })],
      (iso) => iso.slice(0, 10),
    );
    expect(view.map((g) => [g.day, titles(g.tasks)])).toEqual([
      ['2026-09-28', ['Lundi soir', 'Lundi']],
      ['2026-09-27', ['Dimanche']],
    ]);
  });
});
