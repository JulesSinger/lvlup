/**
 * Lire un tracé — GPX ou TCX — et en tirer la sortie : distance, durée,
 * dénivelé, fréquence cardiaque, temps au kilomètre. Bibliothèque pure, sans
 * `DOMParser` (absent des tests, et inutile pour deux formats aussi réguliers).
 */

export interface TrackPoint {
  /** Instant, en millisecondes depuis 1970. */
  t: number;
  lat?: number;
  lon?: number;
  ele?: number;
  hr?: number;
  /** Distance cumulée donnée par le fichier (TCX), en mètres. */
  dist?: number;
}

const num = (s: string | undefined) => (s === undefined ? undefined : Number.parseFloat(s));
const tag = (block: string, name: string) =>
  new RegExp(`<(?:\\w+:)?${name}>\\s*([^<]*?)\\s*</(?:\\w+:)?${name}>`).exec(block)?.[1];

/** Les points d'un GPX (`<trkpt lat lon>`, `<ele>`, `<time>`, la FC dans les extensions Garmin). */
export function parseGpx(xml: string): TrackPoint[] {
  const points: TrackPoint[] = [];
  for (const m of xml.matchAll(/<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>/g)) {
    const time = tag(m[2], 'time');
    if (!time) continue;
    const t = Date.parse(time);
    if (Number.isNaN(t)) continue;
    points.push({
      t,
      lat: num(/lat="([^"]+)"/.exec(m[1])?.[1]),
      lon: num(/lon="([^"]+)"/.exec(m[1])?.[1]),
      ele: num(tag(m[2], 'ele')),
      hr: num(tag(m[2], 'hr')),
    });
  }
  return points;
}

/** Les points d'un TCX (`<Trackpoint>` : `Time`, position, altitude, distance cumulée, FC). */
export function parseTcx(xml: string): TrackPoint[] {
  const points: TrackPoint[] = [];
  for (const m of xml.matchAll(/<(?:\w+:)?Trackpoint>([\s\S]*?)<\/(?:\w+:)?Trackpoint>/g)) {
    const time = tag(m[1], 'Time');
    if (!time) continue;
    const t = Date.parse(time);
    if (Number.isNaN(t)) continue;
    const hrBlock = /<(?:\w+:)?HeartRateBpm[^>]*>([\s\S]*?)<\/(?:\w+:)?HeartRateBpm>/.exec(m[1])?.[1];
    points.push({
      t,
      lat: num(tag(m[1], 'LatitudeDegrees')),
      lon: num(tag(m[1], 'LongitudeDegrees')),
      ele: num(tag(m[1], 'AltitudeMeters')),
      dist: num(tag(m[1], 'DistanceMeters')),
      hr: hrBlock ? num(tag(hrBlock, 'Value')) : undefined,
    });
  }
  return points;
}

/** Distance à vol d'oiseau entre deux points (formule de haversine), en mètres. */
export function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6_371_000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export interface TrackSummary {
  startedAt: string;
  distanceM: number;
  durationS: number;
  elevationM: number | null;
  avgHr: number | null;
  maxHr: number | null;
  splitsS: number[];
}

/** Un dénivelé n'est compté qu'au-delà de 3 m de montée : en dessous, c'est le bruit de l'altimètre. */
const CLIMB_THRESHOLD = 3;

/** Le résumé d'un tracé ; `null` s'il n'a pas deux points datés. */
export function summarizeTrack(input: TrackPoint[]): TrackSummary | null {
  const points = input.slice().sort((a, b) => a.t - b.t);
  if (points.length < 2) return null;

  // La distance cumulée : celle du fichier si elle y est, sinon point à point.
  const cumul: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    const p = points[i];
    const q = points[i - 1];
    let step = 0;
    if (p.dist !== undefined && q.dist !== undefined) step = Math.max(0, p.dist - q.dist);
    else if (p.lat !== undefined && p.lon !== undefined && q.lat !== undefined && q.lon !== undefined) {
      step = haversine({ lat: q.lat, lon: q.lon }, { lat: p.lat, lon: p.lon });
    }
    cumul.push(cumul[i - 1] + step);
  }
  const distanceM = Math.round(cumul[cumul.length - 1]);

  // Les temps au kilomètre : l'instant où chaque kilomètre est franchi, interpolé.
  // Un demi-mètre de tolérance : une somme de flottants qui rend 4 999,9997 m
  // a bien couru 5 km.
  const splitsS: number[] = [];
  let previous = points[0].t;
  let km = 1;
  for (let i = 1; i < points.length && km * 1000 <= cumul[cumul.length - 1] + 0.5; i++) {
    while (km * 1000 <= cumul[i] + 0.5) {
      const span = cumul[i] - cumul[i - 1];
      const share = span > 0 ? Math.min(1, Math.max(0, (km * 1000 - cumul[i - 1]) / span)) : 1;
      const at = points[i - 1].t + share * (points[i].t - points[i - 1].t);
      splitsS.push(Math.round((at - previous) / 1000));
      previous = at;
      km += 1;
    }
  }

  let elevation: number | null = null;
  let ref: number | undefined;
  for (const p of points) {
    if (p.ele === undefined) continue;
    if (ref === undefined) {
      ref = p.ele;
      elevation = 0;
    } else if (p.ele < ref) ref = p.ele;
    else if (p.ele - ref >= CLIMB_THRESHOLD) {
      elevation = (elevation ?? 0) + (p.ele - ref);
      ref = p.ele;
    }
  }

  const hrs = points.map((p) => p.hr).filter((v): v is number => typeof v === 'number' && v > 0);
  return {
    startedAt: new Date(points[0].t).toISOString(),
    distanceM,
    durationS: Math.round((points[points.length - 1].t - points[0].t) / 1000),
    elevationM: elevation === null ? null : Math.round(elevation),
    avgHr: hrs.length > 0 ? Math.round(hrs.reduce((s, v) => s + v, 0) / hrs.length) : null,
    maxHr: hrs.length > 0 ? Math.max(...hrs) : null,
    splitsS,
  };
}
