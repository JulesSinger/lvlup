import { describe, expect, it } from 'vitest';
import {
  MAX_WORKOUTS,
  readDistance,
  readDuration,
  readPayload,
  readStart,
  sameRun as serverSameRun,
  summary,
  type ShortcutRun,
} from '../../../../supabase/functions/sport-import/payload.ts';
import { hashToken, newImportToken } from './importToken';
import { sameRun } from './sameRun';

const now = new Date('2026-10-08T12:00:00Z');
const workout = { start: '2026-10-07T18:32:00+02:00', distance: '10,23 km', duration: '52:30', avgHr: '152 bpm', maxHr: 171 };

describe('ce que le raccourci envoie', () => {
  it('lit les distances de Santé, avec ou sans unité', () => {
    expect(readDistance('10,23 km')).toBe(10_230);
    expect(readDistance('10230 m')).toBe(10_230);
    expect(readDistance('10 230 m')).toBe(10_230);
    expect(readDistance(10.23)).toBe(10_230);
    expect(readDistance(10230)).toBe(10_230);
    expect(readDistance('6,2 mi')).toBe(9978);
    expect(readDistance('10 pas')).toBeNull();
    expect(readDistance('')).toBeNull();
  });

  it('lit les durées sous toutes leurs formes', () => {
    expect(readDuration('52:30')).toBe(3150);
    expect(readDuration('1:05:09')).toBe(3909);
    expect(readDuration(3150)).toBe(3150);
    expect(readDuration('3150')).toBe(3150);
    expect(readDuration('52,5 min')).toBe(3150);
    expect(readDuration('1 h 05')).toBe(3900);
    expect(readDuration('1h')).toBe(3600);
    expect(readDuration('vite')).toBeNull();
  });

  it('garde le jour vécu par l’iPhone, et refuse une date sans fuseau', () => {
    expect(readStart('2026-10-07T23:40:00+02:00')).toEqual({ startedAt: '2026-10-07T21:40:00.000Z', day: '2026-10-07' });
    expect(readStart('2026-10-07T23:40:00+0200')?.day).toBe('2026-10-07');
    expect(readStart('2026-10-07 06:10:00Z')?.startedAt).toBe('2026-10-07T06:10:00.000Z');
    expect(readStart('2026-10-07T23:40:00')).toBeNull();
    expect(readStart('7 oct. 2026 à 18:32')).toBeNull();
  });

  it('une séance devient une sortie du raccourci, rejouable sans doublon', () => {
    const r = readPayload(workout, now);
    expect(r).toEqual({
      runs: [
        {
          started_at: '2026-10-07T16:32:00.000Z',
          day: '2026-10-07',
          distance_m: 10_230,
          duration_s: 3150,
          elevation_m: null,
          avg_hr: 152,
          max_hr: 171,
          kind: 'footing',
          title: '',
          source: 'raccourci',
          source_ref: 'sante:2026-10-07T16:32',
        },
      ],
      rejected: [],
    });
    const withId = readPayload({ ...workout, id: 'ABC-123', name: 'Course en extérieur' }, now);
    expect('runs' in withId && withId.runs[0].source_ref).toBe('sante:ABC-123');
    expect('runs' in withId && withId.runs[0].title).toBe('Course en extérieur');
  });

  it('déduit la durée de la fin, et devine seulement la sortie longue', () => {
    const r = readPayload({ start: '2026-10-05T09:00:00+02:00', end: '2026-10-05T11:05:00+02:00', distance: '21,1 km' }, now);
    expect('runs' in r && r.runs[0]).toMatchObject({ duration_s: 7500, kind: 'longue' });
  });

  it('plusieurs séances : les bonnes passent, les autres disent pourquoi', () => {
    const r = readPayload(
      {
        workouts: [
          workout,
          workout,
          { ...workout, start: '2026-10-07T18:32:00' },
          { ...workout, distance: '50 m' },
          { ...workout, start: '2026-10-09T08:00:00+02:00' },
          { ...workout, distance: '10 km', duration: '10:00' },
        ],
      },
      now,
    );
    expect('runs' in r && r.runs).toHaveLength(1);
    expect('runs' in r && r.rejected).toEqual([
      'séance 3 : départ manquant ou sans fuseau (format ISO 8601 attendu)',
      'séance 4 : distance de moins de 100 m',
      'séance 5 : départ dans le futur',
      'séance 6 : allure plus rapide que 2:00 /km',
    ]);
  });

  it('refuse ce qui n’est pas une liste raisonnable de séances', () => {
    expect(readPayload('bonjour', now)).toEqual({ error: 'Corps JSON attendu.' });
    expect(readPayload({ workouts: Array(MAX_WORKOUTS + 1).fill(workout) }, now)).toHaveProperty('error');
    expect(readPayload({ workouts: [] }, now)).toEqual({ runs: [], rejected: [] });
  });

  it('une FC max sous la moyenne est écartée, pas la sortie', () => {
    const r = readPayload({ ...workout, avgHr: 160, maxHr: 120 }, now);
    expect('runs' in r && r.runs[0]).toMatchObject({ avg_hr: 160, max_hr: null });
  });

  it('dit en une phrase ce qui s’est passé', () => {
    const r = readPayload(workout, now) as { runs: ShortcutRun[] };
    expect(summary(r.runs, 0, [])).toBe('Sortie ajoutée à Sport : 10,2 km en 52 min.');
    expect(summary([], 1, [])).toBe('Déjà dans Sport.');
    expect(summary([], 0, ['distance de moins de 100 m'])).toBe('Refusée : distance de moins de 100 m.');
    expect(summary([], 0, [])).toBe('Aucune séance reçue.');
  });
});

describe('la même sortie par deux chemins', () => {
  const base = { startedAt: '2026-10-07T16:32:00Z', distanceM: 10_230 };
  const cases: [string, { startedAt: string; distanceM: number }, boolean][] = [
    ['identique', base, true],
    ['huit minutes et 4 % d’écart', { startedAt: '2026-10-07T16:40:00Z', distanceM: 9_850 }, true],
    ['onze minutes d’écart', { startedAt: '2026-10-07T16:43:00Z', distanceM: 10_230 }, false],
    ['distance très différente', { startedAt: '2026-10-07T16:32:00Z', distanceM: 5_000 }, false],
  ];
  for (const [name, other, expected] of cases) {
    it(`${name} : la fonction et l’app sont d’accord`, () => {
      expect(sameRun(base, other)).toBe(expected);
      expect(serverSameRun(base, other)).toBe(expected);
    });
  }
});

describe('le jeton', () => {
  it('a la forme que la fonction accepte, et ne se répète pas', () => {
    const a = newImportToken();
    expect(a).toMatch(/^spt_[A-Za-z0-9]{40}$/);
    expect(a).toMatch(/^[A-Za-z0-9_-]{20,100}$/);
    expect(newImportToken()).not.toBe(a);
  });

  it('se tire sans biais même quand le hasard donne des octets à écarter', () => {
    let calls = 0;
    const t = newImportToken((n) => (calls++ === 0 ? new Uint8Array(n).fill(255) : new Uint8Array(n).fill(1)));
    expect(t).toBe(`spt_${'B'.repeat(40)}`);
  });

  it('son empreinte est le SHA-256 hexadécimal que calcule la fonction', async () => {
    expect(await hashToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
});
