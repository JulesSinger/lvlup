import { gzipSync, strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { openArchive, summarizeFile } from './readArchive';

const CSV = [
  'Activity ID,Activity Date,Activity Name,Activity Type,Elapsed Time,Distance,Filename,Elapsed Time,Moving Time,Distance',
  '1,"Oct 5, 2026, 7:00:00 AM",Footing,Run,1500,5.0,activities/1.gpx.gz,1500,1500,5000',
  '2,"Oct 6, 2026, 7:00:00 AM",Vélo,Ride,1500,12.0,,1500,1500,12000',
].join('\n');

const GPX = `<gpx><trk><trkseg>
  <trkpt lat="0" lon="0"><time>2026-10-05T07:00:00Z</time></trkpt>
  <trkpt lat="0" lon="0.008993216"><time>2026-10-05T07:05:00Z</time></trkpt>
</trkseg></trk></gpx>`;

describe('ouvrir l’archive de Strava', () => {
  it('lit le CSV d’un zip et garde ses fichiers d’activité', async () => {
    const zip = zipSync({
      'export_123/activities.csv': strToU8(CSV),
      'export_123/activities/1.gpx.gz': gzipSync(strToU8(GPX)),
      'export_123/profile.csv': strToU8('ignoré'),
    });
    const opened = await openArchive('export_123.zip', zip);
    expect(opened.reading.runs).toHaveLength(1);
    expect(opened.reading.otherActivities).toBe(1);
    expect([...opened.files.keys()]).toEqual(['activities/1.gpx.gz']);
    const summary = await summarizeFile('activities/1.gpx.gz', opened.files.get('activities/1.gpx.gz')!);
    expect(summary).toMatchObject({ distanceM: 1000, durationS: 300, splitsS: [300] });
  });

  it('accepte activities.csv seul', async () => {
    const opened = await openArchive('activities.csv', strToU8(CSV));
    expect(opened.reading.runs[0].sourceRef).toBe('strava:1');
    expect(opened.files.size).toBe(0);
  });

  it('dit clairement quand ce n’est pas l’archive de Strava', async () => {
    await expect(openArchive('autre.zip', zipSync({ 'photo.txt': strToU8('x') }))).rejects.toThrow(/activities\.csv/);
  });

  it('un fichier abîmé (GPX ou FIT) ne se lit pas, sans rien casser', async () => {
    expect(await summarizeFile('activities/9.gpx.gz', strToU8('pas du gzip'))).toBeNull();
    expect(await summarizeFile('activities/9.fit.gz', new Uint8Array([1, 2]))).toBeNull();
  });
});
