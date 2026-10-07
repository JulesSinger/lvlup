/**
 * Lire l'archive de Strava — `activities.csv` — bibliothèque pure
 * (docs/etude-sport.md §12).
 *
 * Strava fournit gratuitement l'archive de tout le compte : un CSV, une ligne
 * par activité, et un dossier des fichiers d'activité. Ce fichier lit le CSV ;
 * les fichiers (GPX, TCX, FIT) viennent compléter une sortie de son tracé.
 *
 * **À vérifier sur l'archive réelle de Jules (étape 3)** : les colonnes ont été
 * écrites d'après le format connu de l'export, en anglais. Deux pièges connus :
 * certaines colonnes existent deux fois (« Distance » en km, puis en mètres ;
 * « Elapsed Time » deux fois) — on lit donc les lignes brutes plutôt que des
 * objets, qui garderaient la dernière seulement ; et la date est écrite en
 * toutes lettres (« Jan 2, 2024, 7:30:00 AM »), en UTC.
 */
import { dayString, mondayOf } from '../../../core/lib/day';
import { parseCsvRows } from '../../../core/lib/csv';
import type { RunImport } from './types';

/** Une sortie lue dans l'archive, avant de recevoir son identifiant. */
export type ArchiveRun = Omit<RunImport, 'id'> & {
  /** Le fichier d'activité de l'archive (« activities/123.gpx.gz »), s'il y en a un. */
  file: string | null;
};

export interface ArchiveReading {
  runs: ArchiveRun[];
  /** Activités qui ne sont pas des courses (vélo, marche…). */
  otherActivities: number;
  /** Lignes de course illisibles (date ou distance manquante) — dites, jamais devinées. */
  unreadable: number;
}

/** Les sortes d'activité reprises : la course à pied, sur route, sur sentier, sur tapis. */
const RUN_TYPES = ['run', 'trail run', 'virtual run', 'course à pied', 'trail', 'course à pied virtuelle'];

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  janv: 0, févr: 1, fevr: 1, mars: 2, avr: 3, mai: 4, juin: 5, juil: 6, août: 7, aout: 7, sept: 8, déc: 11,
};

/**
 * La date d'une activité, en UTC dans l'archive : « Jan 2, 2024, 7:30:00 AM »,
 * sa variante française « 2 janv. 2024, 07:30:00 », ou une date ISO.
 */
export function parseStravaDate(text: string): Date | null {
  const s = text.trim();
  const en = /^([A-Za-z]{3})[a-z]*\.? (\d{1,2}), (\d{4}),? (\d{1,2}):(\d{2}):(\d{2})\s*([AP]M)?$/i.exec(s);
  if (en) {
    const month = MONTHS[en[1].toLowerCase()];
    if (month === undefined) return null;
    let hour = Number(en[4]);
    const half = en[7]?.toUpperCase();
    if (half === 'PM' && hour < 12) hour += 12;
    if (half === 'AM' && hour === 12) hour = 0;
    return new Date(Date.UTC(Number(en[3]), month, Number(en[2]), hour, Number(en[5]), Number(en[6])));
  }
  const fr = /^(\d{1,2}) ([a-zéû]+)\.? (\d{4}),? (\d{1,2}):(\d{2}):(\d{2})$/i.exec(s);
  if (fr) {
    const month = MONTHS[fr[2].toLowerCase()];
    if (month === undefined) return null;
    return new Date(Date.UTC(Number(fr[3]), month, Number(fr[1]), Number(fr[4]), Number(fr[5]), Number(fr[6])));
  }
  const iso = Date.parse(s);
  return Number.isNaN(iso) ? null : new Date(iso);
}

/** Un nombre de l'archive : « 10.21 », « 10,21 », vide. */
function number(text: string | undefined): number | null {
  if (text === undefined || text.trim() === '') return null;
  const n = Number.parseFloat(text.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Lit `activities.csv`. */
export function readStravaActivities(csv: string): ArchiveReading {
  const rows = parseCsvRows(csv, ',');
  if (rows.length === 0) return { runs: [], otherActivities: 0, unreadable: 0 };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  /** Toutes les colonnes d'un nom (certaines existent deux fois). */
  const cols = (...names: string[]) => header.flatMap((h, i) => (names.includes(h) ? [i] : []));
  const first = (...names: string[]) => cols(...names)[0];

  const id = first('activity id', 'id de l’activité', "id de l'activité");
  const date = first('activity date', 'date de l’activité', "date de l'activité");
  const name = first('activity name', 'nom de l’activité', "nom de l'activité");
  const type = first('activity type', 'type d’activité', "type d'activité");
  const distances = cols('distance');
  const elapsed = cols('elapsed time', 'temps écoulé');
  const moving = first('moving time', 'temps de déplacement');
  const avgHr = first('average heart rate', 'fréquence cardiaque moyenne');
  const maxHr = first('max heart rate', 'fréquence cardiaque max', 'fréquence cardiaque maximale');
  const elevation = first('elevation gain', 'dénivelé positif');
  const workout = first('workout type', 'type d’entraînement', "type d'entraînement");
  const file = first('filename', 'nom du fichier');

  const out: ArchiveReading = { runs: [], otherActivities: 0, unreadable: 0 };
  for (const row of rows.slice(1)) {
    const kindText = (row[type] ?? '').trim().toLowerCase();
    if (!RUN_TYPES.includes(kindText)) {
      out.otherActivities += 1;
      continue;
    }
    const started = parseStravaDate(row[date] ?? '');
    // La distance : la seconde colonne est en mètres ; s'il n'y en a qu'une, c'est
    // des kilomètres (« 10.21 ») — sauf si la valeur est déjà manifestement en mètres.
    let meters: number | null = null;
    if (distances.length >= 2) meters = number(row[distances[distances.length - 1]]);
    if (meters === null) {
      const km = number(row[distances[0]]);
      meters = km === null ? null : km < 500 ? km * 1000 : km;
    }
    const seconds = number(row[moving]) ?? number(row[elapsed[0]]);
    if (!started || meters === null || meters <= 0 || !seconds || seconds <= 0) {
      out.unreadable += 1;
      continue;
    }
    const hrAvg = number(row[avgHr]);
    const hrMax = number(row[maxHr]);
    const gain = number(row[elevation]);
    out.runs.push({
      startedAt: started.toISOString(),
      day: dayString(started),
      distanceM: Math.round(meters),
      durationS: Math.round(seconds),
      elevationM: gain === null ? null : Math.round(gain),
      avgHr: hrAvg === null ? null : Math.round(hrAvg),
      maxHr: hrMax === null ? null : Math.round(hrMax),
      // « Workout Type » 1 = une course (compétition) sur Strava.
      kind: number(row[workout]) === 1 ? 'course' : 'footing',
      title: (row[name] ?? '').trim().slice(0, 120),
      source: 'strava',
      sourceRef: `strava:${(row[id] ?? '').trim() || started.toISOString()}`,
      file: (row[file] ?? '').trim() || null,
    });
  }
  return out;
}

/**
 * Les sorties longues d'un historique : Strava ne les distingue pas. Une
 * sortie est dite longue si elle fait au moins 15 km, qu'elle est la plus
 * longue de sa semaine, et au moins 1,3 fois la moyenne des autres. Une
 * proposition, corrigeable d'un toucher ; une course reste une course.
 */
export function markLongRuns<T extends { day: string; distanceM: number; kind?: string }>(runs: T[]): T[] {
  const byWeek = new Map<string, T[]>();
  for (const r of runs) byWeek.set(mondayOf(r.day), [...(byWeek.get(mondayOf(r.day)) ?? []), r]);
  const long = new Set<T>();
  for (const week of byWeek.values()) {
    const sorted = week.slice().sort((a, b) => b.distanceM - a.distanceM);
    const [top, ...others] = sorted;
    if (!top || (top.kind ?? 'footing') !== 'footing' || top.distanceM < 15_000) continue;
    const mean = others.length > 0 ? others.reduce((s, r) => s + r.distanceM, 0) / others.length : 0;
    if (others.length === 0 || top.distanceM >= mean * 1.3) long.add(top);
  }
  return runs.map((r) => (long.has(r) ? ({ ...r, kind: 'longue' } as T) : r));
}
