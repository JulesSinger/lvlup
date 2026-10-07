import { describe, expect, it } from 'vitest';
import { haversine, parseGpx, parseTcx, summarizeTrack, type TrackPoint } from './track';

/** Les degrés d'un kilomètre le long de l'équateur, pour le rayon terrestre de `haversine`. */
const DEG_PER_KM = 360 / (2 * Math.PI * 6371);

/** Un tracé d'exemple : plein est le long de l'équateur, un point tous les 500 m. */
function line(points: number, secondsPer500: number, extra: (i: number) => Partial<TrackPoint> = () => ({})): TrackPoint[] {
  return Array.from({ length: points }, (_, i) => ({
    t: Date.UTC(2026, 9, 6, 7, 0, 0) + i * secondsPer500 * 1000,
    lat: 0,
    lon: i * 0.5 * DEG_PER_KM,
    ...extra(i),
  }));
}

describe('lire un tracé', () => {
  it('la distance par haversine', () => {
    expect(Math.round(haversine({ lat: 0, lon: 0 }, { lat: 0, lon: DEG_PER_KM }))).toBe(1000);
  });

  it('résume une sortie : distance, durée, temps au kilomètre', () => {
    // 5 km : 11 points, 150 s par demi-kilomètre, donc 5:00 au kilomètre.
    const s = summarizeTrack(line(11, 150))!;
    expect(s.distanceM).toBe(5000);
    expect(s.durationS).toBe(1500);
    expect(s.splitsS).toEqual([300, 300, 300, 300, 300]);
    expect(s.startedAt).toBe('2026-10-06T07:00:00.000Z');
    expect(s.avgHr).toBeNull();
  });

  it('interpole l’instant où un kilomètre est franchi entre deux points', () => {
    // Un point tous les 750 m : le premier km tombe aux deux tiers du second écart.
    const points = [0, 0.75, 1.5].map((km, i) => ({ t: i * 270_000, lat: 0, lon: km * DEG_PER_KM }));
    expect(summarizeTrack(points)!.splitsS).toEqual([360]);
  });

  it('compte le dénivelé au-delà du bruit de l’altimètre, et la fréquence cardiaque', () => {
    const ele = [100, 101, 100, 104, 110, 108, 115, 115, 112, 113, 120];
    const hr = [130, 140, 150, 160, 150, 140, 0, 145, 150, 155, 160];
    const s = summarizeTrack(line(11, 150, (i) => ({ ele: ele[i], hr: hr[i] })))!;
    // 100 → 104 (+4), 104 → 110 (+6), 108 → 115 (+7), 112 → 120 (+8) ; le +1 de 112 → 113 est du bruit.
    expect(s.elevationM).toBe(25);
    expect(s.maxHr).toBe(160);
    // Le 0 (capteur décroché) n'entre pas dans la moyenne.
    expect(s.avgHr).toBe(148);
  });

  it('rien à dire d’un tracé de moins de deux points', () => {
    expect(summarizeTrack([{ t: 0 }])).toBeNull();
  });

  it('lit un GPX, FC des extensions Garmin comprise', () => {
    const gpx = `<?xml version="1.0"?><gpx><trk><trkseg>
      <trkpt lat="45.9" lon="6.12"><ele>450.2</ele><time>2026-10-06T07:00:00Z</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>132</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>
      <trkpt lat="45.901" lon="6.121"><ele>451</ele><time>2026-10-06T07:00:30Z</time></trkpt>
      <trkpt lat="45.9" lon="6.12"></trkpt>
    </trkseg></trk></gpx>`;
    const points = parseGpx(gpx);
    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({ lat: 45.9, lon: 6.12, ele: 450.2, hr: 132 });
    expect(points[1].hr).toBeUndefined();
  });

  it('lit un TCX, avec sa distance cumulée', () => {
    const tcx = `<TrainingCenterDatabase><Activities><Activity Sport="Running"><Lap><Track>
      <Trackpoint><Time>2026-10-06T07:00:00Z</Time><DistanceMeters>0</DistanceMeters><HeartRateBpm><Value>120</Value></HeartRateBpm></Trackpoint>
      <Trackpoint><Time>2026-10-06T07:05:00Z</Time><DistanceMeters>1000</DistanceMeters><HeartRateBpm><Value>150</Value></HeartRateBpm></Trackpoint>
    </Track></Lap></Activity></Activities></TrainingCenterDatabase>`;
    const s = summarizeTrack(parseTcx(tcx))!;
    expect(s).toMatchObject({ distanceM: 1000, durationS: 300, avgHr: 135, maxHr: 150, splitsS: [300] });
  });
});
