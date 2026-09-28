import { describe, expect, it } from 'vitest';
import type { Task } from './types';
import { validateTask } from './validation';

const parent = { id: 'p', parentId: null } as Task;
const child = { id: 'c', parentId: 'p' } as Task;

describe('validateTask', () => {
  it('accepte une tâche simple, datée, répétée', () => {
    expect(validateTask({ title: 'Garage' })).toBeNull();
    expect(validateTask({ title: 'Garage', plannedDay: '2026-09-29', plannedTime: '09:00', dueDay: '2026-09-30' })).toBeNull();
    expect(validateTask({ title: 'Draps', plannedDay: '2026-09-29', recurrence: { freq: 'daily', interval: 10 } })).toBeNull();
  });

  it('refuse un titre vide ou trop long', () => {
    expect(validateTask({ title: '  ' })).toMatch(/titre/);
    expect(validateTask({ title: 'x'.repeat(1000) })).toBeNull();
    expect(validateTask({ title: 'x'.repeat(1001) })).toMatch(/trop long \(1000/);
  });

  it('une heure ou une répétition a besoin d’un jour', () => {
    expect(validateTask({ title: 'x', plannedTime: '09:00' })).toMatch(/besoin d’un jour/);
    expect(validateTask({ title: 'x', recurrence: { freq: 'daily', interval: 1 } })).toMatch(/jour prévu/);
    expect(validateTask({ title: 'x', plannedDay: '2026-09-29', recurrence: { freq: 'daily', interval: 0 } })).toMatch(/intervalle/);
  });

  it('les sous-tâches restent sur un seul niveau, et ne se répètent pas', () => {
    expect(validateTask({ title: 'x', parentId: 'p' }, [parent])).toBeNull();
    expect(validateTask({ title: 'x', parentId: 'c' }, [parent, child])).toMatch(/un seul niveau/);
    expect(validateTask({ title: 'x', parentId: 'p' }, [parent, { id: 'q', parentId: 'self' } as Task], 'self')).toMatch(/a des sous-tâches/);
    expect(validateTask({ title: 'x', parentId: 'self' }, [], 'self')).toMatch(/propre sous-tâche/);
    expect(validateTask({ title: 'x', parentId: 'disparue' }, [])).toMatch(/n’existe plus/);
    expect(validateTask({ title: 'x', parentId: 'p', plannedDay: '2026-09-29', recurrence: { freq: 'daily', interval: 1 } }, [parent])).toMatch(/ne se répète pas/);
  });
});

describe('validateTask — la durée', () => {
  it('seulement avec une heure, de 5 minutes à 24 heures', () => {
    expect(validateTask({ title: 'x', plannedDay: '2026-09-29', plannedTime: '15:00', durationMinutes: 90 })).toBeNull();
    expect(validateTask({ title: 'x', plannedDay: '2026-09-29', durationMinutes: 90 })).toMatch(/besoin d’une heure/);
    expect(validateTask({ title: 'x', plannedDay: '2026-09-29', plannedTime: '15:00', durationMinutes: 2 })).toMatch(/5 minutes à 24 heures/);
  });
});
