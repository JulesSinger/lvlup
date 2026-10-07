import type { ArchiveReading } from './stravaArchive';

/** Une archive lue, pour les tests : quatre courses, dont une déjà rangée. */
export const archiveRunsFixture: ArchiveReading = {
  otherActivities: 3,
  unreadable: 1,
  runs: [
    { startedAt: '2026-10-01T07:00:00.000Z', day: '2026-10-01', distanceM: 8000, durationS: 2700, elevationM: null, avgHr: null, maxHr: null, kind: 'footing', title: 'Déjà là', source: 'strava', sourceRef: 'strava:1', file: null },
    { startedAt: '2026-10-05T07:00:00.000Z', day: '2026-10-05', distanceM: 9000, durationS: 3000, elevationM: null, avgHr: 140, maxHr: null, kind: 'footing', title: 'Avec tracé', source: 'strava', sourceRef: 'strava:2', file: 'activities/2.gpx.gz' },
    { startedAt: '2026-10-07T07:00:00.000Z', day: '2026-10-07', distanceM: 8000, durationS: 2700, elevationM: null, avgHr: null, maxHr: null, kind: 'footing', title: 'Avec FIT', source: 'strava', sourceRef: 'strava:3', file: 'activities/3.fit.gz' },
    { startedAt: '2026-10-11T07:00:00.000Z', day: '2026-10-11', distanceM: 18_000, durationS: 6300, elevationM: null, avgHr: null, maxHr: null, kind: 'footing', title: 'Longue', source: 'strava', sourceRef: 'strava:4', file: null },
  ],
};
