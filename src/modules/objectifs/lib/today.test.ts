import { describe, expect, it } from 'vitest';
import { nextStreakMilestone } from './streak';
import { brokeYesterday, dayComplete, lastReading } from './today';
import type { Action, Checkin, Goal } from './types';

const goal = { id: 'g', archived: false, tiers: [] } as unknown as Goal;
const action = (id: string, extra: Partial<Action> = {}): Action =>
  ({ id, goalId: 'g', title: id, pp: 10, position: 0, archived: false, unit: '', defaultValue: null, isMeasure: false, ...extra }) as Action;
const checkin = (actionId: string, day: string, value: number | null = null): Checkin =>
  ({ id: `${actionId}-${day}`, goalId: 'g', actionId, pp: 10, day, note: '', createdAt: `${day}T09:00:00Z`, value }) as Checkin;

describe('dayComplete', () => {
  const actions = [action('a'), action('b')];

  it('vrai seulement quand chaque action est cochée ce jour-là', () => {
    expect(dayComplete(goal, actions, [checkin('a', '2026-10-07')], '2026-10-07')).toBe(false);
    expect(dayComplete(goal, actions, [checkin('a', '2026-10-07'), checkin('b', '2026-10-07')], '2026-10-07')).toBe(true);
    expect(dayComplete(goal, actions, [checkin('a', '2026-10-07'), checkin('b', '2026-10-06')], '2026-10-07')).toBe(false);
  });

  it('un objectif sans action n’est jamais « fait »', () => {
    expect(dayComplete(goal, [], [], '2026-10-07')).toBe(false);
  });

  it('une action archivée ne compte pas', () => {
    const avecArchive = [action('a'), action('b', { archived: true })];
    expect(dayComplete(goal, avecArchive, [checkin('a', '2026-10-07')], '2026-10-07')).toBe(true);
  });
});

describe('lastReading', () => {
  const pesee = action('p', { isMeasure: true, unit: 'kg' });

  it('rend le dernier relevé avant le jour affiché', () => {
    const cks = [checkin('p', '2026-10-01', 81), checkin('p', '2026-10-04', 80.1), checkin('p', '2026-10-07', 79.9)];
    expect(lastReading(pesee, cks, '2026-10-07')).toEqual({ day: '2026-10-04', value: 80.1 });
  });

  it('rien pour une action qui n’est pas une mesure, ou sans relevé', () => {
    expect(lastReading(action('a'), [checkin('a', '2026-10-01', 3)], '2026-10-07')).toBeNull();
    expect(lastReading(pesee, [], '2026-10-07')).toBeNull();
  });
});

describe('nextStreakMilestone', () => {
  it('annonce le prochain cap', () => {
    expect(nextStreakMilestone(0)).toEqual({ target: 7, inDays: 7 });
    expect(nextStreakMilestone(7)).toEqual({ target: 30, inDays: 23 });
    expect(nextStreakMilestone(99)).toEqual({ target: 100, inDays: 1 });
    expect(nextStreakMilestone(365)).toBeNull();
  });
});

describe('brokeYesterday', () => {
  it('seulement quand la série tenait avant-hier et s’arrête hier', () => {
    const today = '2026-10-07';
    expect(brokeYesterday(goal, [checkin('a', '2026-10-05')], today)).toBe(true);
    expect(brokeYesterday(goal, [checkin('a', '2026-10-05'), checkin('a', '2026-10-06')], today)).toBe(false);
    expect(brokeYesterday(goal, [checkin('a', '2026-10-05'), checkin('a', '2026-10-07')], today)).toBe(false);
    // Une pesée par semaine : rien avant-hier, rien à signaler.
    expect(brokeYesterday(goal, [checkin('a', '2026-10-03')], today)).toBe(false);
  });
});
