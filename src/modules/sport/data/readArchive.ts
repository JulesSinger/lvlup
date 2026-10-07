/**
 * Ouvrir l'archive de Strava dans le navigateur (docs/etude-sport.md §12).
 *
 * L'archive est un zip : `activities.csv`, et un dossier `activities/` de
 * fichiers d'activité, souvent compressés une seconde fois (`.gpx.gz`).
 * `fflate` (MIT, quelques Ko) ouvre le zip et le gzip ; il n'est chargé qu'à
 * la première importation, comme le lecteur de code-barres de Nutrition.
 * Rien ne quitte l'appareil : seules les sorties lues sont ensuite rangées.
 */
import { isFit, readableTrack } from '../lib/archiveImport';
import { readStravaActivities, type ArchiveReading } from '../lib/stravaArchive';
import { parseGpx, parseTcx, summarizeTrack, type TrackSummary } from '../lib/track';

export interface OpenedArchive {
  reading: ArchiveReading;
  /** Les fichiers d'activité, par chemin (« activities/123.gpx.gz »), encore compressés. */
  files: Map<string, Uint8Array>;
}

/** Un zip d'archive, ou `activities.csv` seul. */
export async function openArchive(name: string, bytes: Uint8Array): Promise<OpenedArchive> {
  if (/\.csv$/i.test(name)) {
    return { reading: readStravaActivities(new TextDecoder().decode(bytes)), files: new Map() };
  }
  const { unzipSync, strFromU8 } = await import('fflate');
  // On ne décompresse que ce qui sert : le CSV et les fichiers d'activité.
  const entries = unzipSync(bytes, { filter: (f) => /(^|\/)activities\.csv$/i.test(f.name) || /(^|\/)activities\/[^/]+$/i.test(f.name) });
  const csvName = Object.keys(entries).find((n) => /(^|\/)activities\.csv$/i.test(n));
  if (!csvName) throw new Error('Cette archive ne contient pas de fichier activities.csv : est-ce bien l’archive de Strava ?');
  const files = new Map<string, Uint8Array>();
  for (const [path, data] of Object.entries(entries)) {
    if (path === csvName) continue;
    // Le CSV nomme les fichiers depuis la racine de l'archive (« activities/123.gpx.gz »).
    files.set(path.slice(path.lastIndexOf('activities/')), data);
  }
  return { reading: readStravaActivities(strFromU8(entries[csvName])), files };
}

/** Le résumé d'un fichier d'activité, ou `null` s'il ne se lit pas (format inconnu, fichier abîmé). */
export async function summarizeFile(path: string, data: Uint8Array): Promise<TrackSummary | null> {
  if (!readableTrack(path) || isFit(path)) return null;
  try {
    let bytes = data;
    if (/\.gz$/i.test(path)) {
      const { gunzipSync } = await import('fflate');
      bytes = gunzipSync(data);
    }
    const xml = new TextDecoder().decode(bytes);
    return summarizeTrack(/\.tcx/i.test(path) ? parseTcx(xml) : parseGpx(xml));
  } catch {
    return null;
  }
}
