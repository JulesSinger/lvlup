import { describe, expect, it } from 'vitest';
import { localInstant, plannedReminders } from './reminders';
import type { TachesSettings, Task } from './types';

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

// Lundi 28 septembre 2026, 10 h, heure locale de la machine de test.
const now = new Date(2026, 8, 28, 10, 0);
const both: TachesSettings = { taskReminders: true, morningEnabled: true, morningTime: '08:00' };
const tasksOnly: TachesSettings = { ...both, morningEnabled: false };
const at = (day: string, time: string) => localInstant(day, time).toISOString();

describe('plannedReminders — à l’heure d’une tâche', () => {
  it('une tâche avec une heure, à venir dans les 7 jours : un rappel à son heure', () => {
    const t = task({ title: 'Appeler le garage', plannedDay: '2026-09-29', plannedTime: '09:00', dueDay: '2026-09-30' });
    expect(plannedReminders([t], tasksOnly, now)).toEqual([
      { ref: `task:${t.id}:2026-09-29`, fireAt: at('2026-09-29', '09:00'), title: 'Appeler le garage', body: 'Prévue à 9 h · à faire d’ici demain' },
    ]);
  });

  it('rien pour une heure passée, une tâche sans heure, faite, trop lointaine, ou si c’est coupé', () => {
    const tasks = [
      task({ plannedDay: '2026-09-28', plannedTime: '09:30' }),
      task({ plannedDay: '2026-09-29' }),
      task({ plannedDay: '2026-09-29', plannedTime: '09:00', completedAt: 'x' }),
      task({ plannedDay: '2026-10-05', plannedTime: '09:00' }),
    ];
    expect(plannedReminders(tasks, tasksOnly, now)).toEqual([]);
    expect(plannedReminders([task({ plannedDay: '2026-09-29', plannedTime: '09:00' })], { ...tasksOnly, taskReminders: false }, now)).toEqual([]);
  });
});

describe('plannedReminders — le résumé du matin', () => {
  it('seulement les jours où il y a quelque chose, avec les urgentes et trois titres', () => {
    const tasks = [
      task({ title: 'Garage', plannedDay: '2026-09-29' }),
      task({ title: 'Impôts', dueDay: '2026-09-29', priority: 'urgente' }),
      task({ title: 'Banque', plannedDay: '2026-09-27' }), // en retard : compte chaque matin
      task({ title: 'Colis', plannedDay: '2026-09-29' }),
    ];
    const morning = plannedReminders(tasks, { ...both, taskReminders: false }, now);
    // Aujourd'hui 8 h est passé ; demain et les jours suivants, la tâche en retard compte encore.
    expect(morning[0]).toEqual({
      ref: 'morning:2026-09-29',
      fireAt: at('2026-09-29', '08:00'),
      title: '☀️ 4 tâches aujourd’hui, dont 1 urgente',
      body: 'Banque · Impôts · Garage et 1 autre', // dans l'ordre de l'écran : les retards d'abord
    });
    expect(morning.map((r) => r.ref)).not.toContain('morning:2026-09-28');
    expect(morning).toHaveLength(6);
  });

  it('aucune tâche : aucun rappel du matin', () => {
    expect(plannedReminders([], both, now)).toEqual([]);
  });

  it('les rappels sont triés dans le temps', () => {
    const t = task({ plannedDay: '2026-09-29', plannedTime: '07:00' });
    expect(plannedReminders([t], both, now).map((r) => r.ref)).toEqual([`task:${t.id}:2026-09-29`, 'morning:2026-09-29', 'morning:2026-09-30', 'morning:2026-10-01', 'morning:2026-10-02', 'morning:2026-10-03', 'morning:2026-10-04']);
  });
});

describe('plannedReminders — des titres longs', () => {
  it('le résumé du matin raccourcit les titres cités, pour rester sous la limite d’un rappel', () => {
    const long = 'Préparer le dossier '.repeat(50).trim();
    const tasks = [1, 2, 3].map(() => task({ title: long, plannedDay: '2026-09-29' }));
    const [morning] = plannedReminders(tasks, { ...both, taskReminders: false }, now);
    expect(morning.body.length).toBeLessThanOrEqual(1000);
    expect(morning.body.split(' · ').every((t) => t.length <= 80 && t.endsWith('…'))).toBe(true);
  });

  it('le rappel d’une tâche au titre de 1000 caractères le garde entier', () => {
    const t = task({ title: 'x'.repeat(1000), plannedDay: '2026-09-29', plannedTime: '09:00' });
    expect(plannedReminders([t], tasksOnly, now)[0].title).toHaveLength(1000);
  });
});
