/**
 * Préparer l'import de l'archive Strava — bibliothèque pure (docs/etude-sport.md §12).
 *
 * L'archive donne les sorties (`activities.csv`, lu par `stravaArchive.ts`)
 * et, pour certaines, leur fichier : un tracé qui apporte les temps au
 * kilomètre, et la fréquence cardiaque ou le dénivelé quand le CSV ne les a
 * pas. Les chiffres du CSV (distance, durée) restent ceux de Strava : ce sont
 * ceux que Jules connaît.
 */
import { markLongRuns, type ArchiveReading } from './stravaArchive';
import type { TrackSummary } from './track';
import { sameRun } from './sameRun';
import type { RunImport } from './types';

export interface ArchivePlan {
  /** Les sorties à ranger, avec leur identifiant. */
  runs: RunImport[];
  /**
   * Déjà rangées : même référence (un second import n'ajoute rien), ou la même
   * sortie venue par un autre chemin (le raccourci, une saisie à la main).
   */
  alreadyKnown: number;
  /** Complétées par leur fichier (temps au kilomètre). */
  withTrack: number;
  /** Fichiers FIT, pas encore lus (docs/etude-sport.md §13). */
  fitSkipped: number;
  otherActivities: number;
  unreadable: number;
}

/** Les fichiers qu'on sait lire : GPX et TCX, compressés ou non. */
export function readableTrack(path: string): boolean {
  return /\.(gpx|tcx)(\.gz)?$/i.test(path);
}

export function isFit(path: string): boolean {
  return /\.fit(\.gz)?$/i.test(path);
}

/**
 * L'import à faire : les sorties nouvelles, complétées de leur tracé quand on
 * l'a lu (`tracks`, par chemin de fichier), sorties longues repérées sur
 * l'ensemble (`markLongRuns`).
 */
export function planArchiveImport(
  reading: ArchiveReading,
  knownRefs: ReadonlySet<string>,
  tracks: ReadonlyMap<string, TrackSummary | null>,
  newId: () => string,
  existing: readonly { startedAt: string; distanceM: number }[] = [],
): ArchivePlan {
  let withTrack = 0;
  let fitSkipped = 0;
  const fresh = reading.runs.filter((r) => !knownRefs.has(r.sourceRef) && !existing.some((e) => sameRun(e, r)));
  const runs = fresh.map(({ file, ...run }) => {
    const track = file ? tracks.get(file) : undefined;
    if (file && isFit(file)) fitSkipped += 1;
    if (!track) return run;
    withTrack += 1;
    return {
      ...run,
      splitsS: track.splitsS.length > 0 ? track.splitsS : null,
      avgHr: run.avgHr ?? track.avgHr,
      maxHr: run.maxHr ?? track.maxHr,
      elevationM: run.elevationM ?? track.elevationM,
    };
  });
  return {
    runs: markLongRuns(runs).map((r) => ({ ...r, id: newId() })),
    alreadyKnown: reading.runs.length - fresh.length,
    withTrack,
    fitSkipped,
    otherActivities: reading.otherActivities,
    unreadable: reading.unreadable,
  };
}
