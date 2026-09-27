import { describe, expect, it } from 'vitest';
import { checkinMarks } from './calendarMarks';
import type { Action, Checkin, Goal } from './types';

const goal = { id: 'g', title: 'Courir un marathon', emoji: '🏃' } as Goal;
const actions = [
  { id: 'run', goalId: 'g', title: 'Course', unit: 'km' },
  { id: 'stretch', goalId: 'g', title: 'Étirements', unit: '' },
] as Action[];

let n = 0;
const checkin = (day: string, actionId: string | null, value: number | null = null, title: string | null = null): Checkin => ({
  id: `c${++n}`,
  goalId: 'g',
  actionId,
  pp: 10,
  day,
  note: '',
  createdAt: `2026-09-2${n}T10:00:00Z`,
  value,
  title,
});

describe('checkinMarks — le calque de Zénith', () => {
  it('une marque par objectif et par jour, avec les quantités', () => {
    const marks = checkinMarks([goal], actions, [checkin('2026-09-21', 'run', 8.5), checkin('2026-09-21', 'stretch')], '2026-09-21', '2026-09-27');
    expect(marks).toEqual([{ id: 'g|2026-09-21', day: '2026-09-21', title: '✓ 🏃 Course 8,5 km, Étirements', detail: 'Courir un marathon' }]);
  });

  it('un geste ponctuel porte son propre titre', () => {
    const [mark] = checkinMarks([goal], actions, [checkin('2026-09-22', null, null, 'Tuto sur l’allure')], '2026-09-21', '2026-09-27');
    expect(mark.title).toBe('✓ 🏃 Tuto sur l’allure');
  });

  it('ne garde que la période, et oublie un objectif disparu', () => {
    const orphan = { ...checkin('2026-09-23', 'run'), goalId: 'disparu' };
    expect(checkinMarks([goal], actions, [checkin('2026-09-20', 'run'), orphan], '2026-09-21', '2026-09-27')).toEqual([]);
  });
});
