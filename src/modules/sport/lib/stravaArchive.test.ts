import { describe, expect, it } from 'vitest';
import { markLongRuns, parseStravaDate, readStravaActivities } from './stravaArchive';

/** Un extrait au format de l'export Strava : « Distance » et « Elapsed Time » y sont deux fois. */
const CSV = [
  'Activity ID,Activity Date,Activity Name,Activity Type,Activity Description,Elapsed Time,Distance,Max Heart Rate,Relative Effort,Commute,Filename,Elapsed Time,Moving Time,Distance,Average Heart Rate,Elevation Gain,Workout Type',
  '101,"Oct 4, 2026, 7:30:12 AM",Footing du samedi,Run,,3720,10.21,171,45,false,activities/101.fit.gz,3720,3600,10210.5,148,85,',
  '102,"Oct 5, 2026, 6:05:00 PM",Vélotaf,Ride,,1800,12.3,,,,activities/102.gpx,1800,1750,12300,,30,',
  '103,"Oct 6, 2026, 12:10:00 PM","Semi de Lyon, enfin",Run,,6100,21.17,185,,,,6100,6080,21170,172,40,1',
  '104,,Sans date,Run,,100,1,,,,,100,100,1000,,,',
].join('\n');

describe('l’archive de Strava', () => {
  it('lit les dates en toutes lettres, en UTC', () => {
    expect(parseStravaDate('Oct 4, 2026, 7:30:12 AM')?.toISOString()).toBe('2026-10-04T07:30:12.000Z');
    expect(parseStravaDate('Oct 5, 2026, 12:05:00 PM')?.toISOString()).toBe('2026-10-05T12:05:00.000Z');
    expect(parseStravaDate('Oct 5, 2026, 12:05:00 AM')?.toISOString()).toBe('2026-10-05T00:05:00.000Z');
    expect(parseStravaDate('4 oct. 2026, 19:30:00')?.toISOString()).toBe('2026-10-04T19:30:00.000Z');
    expect(parseStravaDate('2026-10-04T07:30:00Z')?.toISOString()).toBe('2026-10-04T07:30:00.000Z');
    expect(parseStravaDate('n’importe quoi')).toBeNull();
  });

  it('ne garde que les courses, avec la distance en mètres de la seconde colonne', () => {
    const reading = readStravaActivities(CSV);
    expect(reading.otherActivities).toBe(1);
    expect(reading.unreadable).toBe(1);
    expect(reading.runs).toHaveLength(2);
    expect(reading.runs[0]).toMatchObject({
      startedAt: '2026-10-04T07:30:12.000Z',
      distanceM: 10_211,
      // Le temps en mouvement plutôt que le temps écoulé : l'allure de Strava.
      durationS: 3600,
      avgHr: 148,
      maxHr: 171,
      elevationM: 85,
      kind: 'footing',
      title: 'Footing du samedi',
      source: 'strava',
      sourceRef: 'strava:101',
      file: 'activities/101.fit.gz',
    });
  });

  it('une course de Strava (« Workout Type » 1) reste une course, virgule du titre comprise', () => {
    const semi = readStravaActivities(CSV).runs[1];
    expect(semi).toMatchObject({ kind: 'course', title: 'Semi de Lyon, enfin', distanceM: 21_170, file: null });
  });

  it('avec une seule colonne « Distance », lit des kilomètres', () => {
    const csv = 'Activity ID,Activity Date,Activity Type,Elapsed Time,Distance\n7,"Oct 4, 2026, 7:30:00 AM",Run,1500,5.02';
    expect(readStravaActivities(csv).runs[0].distanceM).toBe(5020);
  });

  it('repère les sorties longues : la plus longue de la semaine, 15 km au moins, nettement au-dessus des autres', () => {
    const runs = markLongRuns([
      { day: '2026-10-05', distanceM: 8000, kind: 'footing' },
      { day: '2026-10-07', distanceM: 9000, kind: 'footing' },
      { day: '2026-10-11', distanceM: 18_000, kind: 'footing' },
      { day: '2026-10-13', distanceM: 14_000, kind: 'footing' },
      { day: '2026-10-18', distanceM: 21_100, kind: 'course' },
    ]);
    expect(runs.map((r) => r.kind)).toEqual(['footing', 'footing', 'longue', 'footing', 'course']);
  });
});
