import { describe, expect, it } from 'vitest';
import {
  canReadActivities,
  crossSport,
  pickSession,
  toCrossActivity,
  weekOfPlan as serverWeekOfPlan,
  safeReturn,
  signState,
  splitsFrom,
  syncAfter,
  syncMessage,
  toRun,
  verifyState,
  type StravaActivity,
} from '../../../../supabase/functions/sport-strava/strava.ts';
import { weekOfPlan } from './plan';

const run: StravaActivity = {
  id: 16_012_345_678,
  name: 'Course à pied le matin',
  sport_type: 'Run',
  start_date: '2026-10-04T05:12:00Z',
  start_date_local: '2026-10-04T07:12:00Z',
  distance: 10_619.4,
  moving_time: 3_979,
  elapsed_time: 4_100,
  total_elevation_gain: 54.2,
  average_heartrate: 151.6,
  max_heartrate: 172,
  workout_type: 0,
};

describe('lien avec Strava', () => {
  it('une course devient une sortie, avec la référence de l’archive', () => {
    expect(toRun(run)).toEqual({
      started_at: '2026-10-04T05:12:00.000Z',
      day: '2026-10-04',
      distance_m: 10_619,
      duration_s: 3_979,
      elevation_m: 54,
      avg_hr: 152,
      max_hr: 172,
      kind: 'footing',
      title: 'Course à pied le matin',
      source: 'strava',
      source_ref: 'strava:16012345678',
    });
  });

  it('le jour est celui de l’heure locale, pas d’UTC', () => {
    expect(toRun({ ...run, start_date: '2026-10-04T22:30:00Z', start_date_local: '2026-10-05T00:30:00Z' })?.day).toBe('2026-10-05');
  });

  it('écarte ce qui n’est pas une course ou ne tient pas dans la base', () => {
    expect(toRun({ ...run, sport_type: 'Ride' })).toBeNull();
    expect(toRun({ ...run, sport_type: 'TrailRun' })).not.toBeNull();
    expect(toRun({ ...run, moving_time: 0, elapsed_time: 0 })).toBeNull();
    expect(toRun({ ...run, average_heartrate: undefined, max_heartrate: 400 })).toMatchObject({ avg_hr: null, max_hr: null });
  });

  it('la sorte vient de Strava quand il la dit, sinon de la distance', () => {
    expect(toRun({ ...run, workout_type: 1 })?.kind).toBe('course');
    expect(toRun({ ...run, workout_type: 2 })?.kind).toBe('longue');
    expect(toRun({ ...run, distance: 21_100 })?.kind).toBe('longue');
  });

  it('les temps au kilomètre sans le dernier morceau', () => {
    expect(splitsFrom([{ distance: 1000, moving_time: 362 }, { distance: 1001.3, moving_time: 355 }, { distance: 619, moving_time: 220 }])).toEqual([362, 355]);
    expect(splitsFrom(undefined)).toBeNull();
  });

  it('repart de la dernière activité, trois jours avant ; 90 jours la première fois', () => {
    const now = new Date('2026-10-09T12:00:00Z');
    expect(syncAfter('2026-10-04T05:12:00Z', now)).toBe(Date.parse('2026-10-01T05:12:00Z') / 1000);
    expect(syncAfter(null, now)).toBe(Date.parse('2026-07-11T12:00:00Z') / 1000);
  });

  it('ne revient que vers une origine http(s)', () => {
    expect(safeReturn('https://atlas.pages.dev/#/sport')).toBe('https://atlas.pages.dev');
    expect(safeReturn('http://localhost:5173')).toBe('http://localhost:5173');
    expect(safeReturn('http://exemple.fr')).toBeNull();
    expect(safeReturn('javascript:alert(1)')).toBeNull();
    expect(safeReturn('https://a:b@exemple.fr')).toBeNull();
  });

  it('le state signé ne se fabrique pas, ne se modifie pas, et expire', async () => {
    const now = Date.parse('2026-10-09T12:00:00Z');
    const payload = { u: 'compte-1', r: 'https://atlas.pages.dev', e: now + 60_000 };
    const state = await signState(payload, 'secret');
    expect(await verifyState(state, 'secret', now)).toEqual(payload);
    expect(await verifyState(state, 'autre', now)).toBeNull();
    expect(await verifyState(state, 'secret', now + 120_000)).toBeNull();
    const forged = await signState({ ...payload, u: 'compte-2' }, 'secret');
    expect(await verifyState(`${forged.split('.')[0]}.${state.split('.')[1]}`, 'secret', now)).toBeNull();
    expect(await verifyState('n’importe quoi', 'secret', now)).toBeNull();
  });

  it('la permission de lire les activités, et la phrase de fin', () => {
    expect(canReadActivities('read,activity:read_all')).toBe(true);
    expect(canReadActivities('read')).toBe(false);
    expect(syncMessage(2, 1)).toBe('2 sorties reçues de Strava.');
    expect(syncMessage(0, 3)).toBe('Rien de nouveau sur Strava.');
  });

  it('reprend le renforcement et le vélo, sans en faire des sorties', () => {
    const renfo = { ...run, id: 77, sport_type: 'WeightTraining', name: 'Renfo du soir', distance: 0, moving_time: 2_400, average_heartrate: 118.4 };
    expect(crossSport(renfo)).toBe('renfo');
    expect(crossSport({ ...run, sport_type: 'VirtualRide' })).toBe('velo');
    expect(crossSport(run)).toBeNull();
    expect(toRun(renfo)).toBeNull();
    expect(toCrossActivity(renfo)).toMatchObject({ sport: 'renfo', day: '2026-10-04', duration_s: 2_400, distance_m: null, avg_hr: 118, title: 'Renfo du soir', source_ref: 'strava:77' });
    expect(toCrossActivity({ ...run, id: 78, sport_type: 'Ride', distance: 25_310.4 })).toMatchObject({ sport: 'velo', distance_m: 25_310 });
    expect(toCrossActivity(run)).toBeNull();
  });

  it('coche la séance du jour, sinon la première sans jour de la semaine', () => {
    const start = '2026-10-12';
    expect(serverWeekOfPlan(start, '2026-10-14')).toBe(weekOfPlan(start, '2026-10-14'));
    expect(serverWeekOfPlan('2026-10-09', '2026-10-25')).toBe(weekOfPlan('2026-10-09', '2026-10-25'));
    const sessions = [
      { id: 'r-mer', kind: 'renfo', week: 1, position: 1, day: '2026-10-14', done_at: null },
      { id: 'r-libre', kind: 'renfo', week: 1, position: 3, day: null, done_at: null },
      { id: 'v-sam', kind: 'velo', week: 1, position: 4, day: '2026-10-17', done_at: null },
      { id: 'r-faite', kind: 'renfo', week: 1, position: 0, day: '2026-10-13', done_at: '2026-10-13T18:00:00Z' },
      { id: 'r-sem2', kind: 'renfo', week: 2, position: 0, day: null, done_at: null },
    ];
    expect(pickSession({ day: '2026-10-14', sport: 'renfo' }, start, sessions, new Set())).toBe('r-mer');
    expect(pickSession({ day: '2026-10-16', sport: 'renfo' }, start, sessions, new Set())).toBe('r-libre');
    expect(pickSession({ day: '2026-10-14', sport: 'renfo' }, start, sessions, new Set(['r-mer']))).toBe('r-libre');
    expect(pickSession({ day: '2026-10-13', sport: 'renfo' }, start, sessions, new Set(['r-mer', 'r-libre']))).toBeNull();
    expect(pickSession({ day: '2026-10-15', sport: 'velo' }, start, sessions, new Set())).toBeNull();
    expect(pickSession({ day: '2026-10-21', sport: 'renfo' }, start, sessions, new Set())).toBe('r-sem2');
  });

  it('dit ce qui est arrivé, sorties et séances d’à côté', () => {
    expect(syncMessage(1, 0, 1)).toBe('1 sortie et 1 séance de renfo ou de vélo reçues de Strava.');
    expect(syncMessage(0, 2, 2)).toBe('2 séances de renfo ou de vélo reçues de Strava.');
    expect(syncMessage(0, 0, 1)).toBe('1 séance de renfo ou de vélo reçue de Strava.');
  });
});
