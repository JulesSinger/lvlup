/**
 * Ce que le raccourci iPhone envoie, lu strictement (docs/etude-sport.md §3.3, §15).
 *
 * Règles pures, sans Deno ni base : testées par Vitest
 * (`src/modules/sport/lib/shortcutPayload.test.ts`), comme `moduleReminders.ts`
 * pour `send-reminders`.
 *
 * Le raccourci n'est pas un programme qu'on maîtrise : il envoie ce que Santé
 * lui donne, sous la forme que l'iPhone choisit (« 10,23 km », « 52:30 »,
 * « 3150 », une date ISO avec son décalage). La lecture accepte ces formes, et
 * refuse tout le reste plutôt que de deviner : une sortie fausse dans le
 * journal est pire qu'une sortie absente, qu'on peut saisir à la main.
 */

/** Une requête plus grosse est refusée avant d'être lue. */
export const MAX_BODY_BYTES = 64 * 1024;
/** Le raccourci peut renvoyer les sept derniers jours : bien moins que ça. */
export const MAX_WORKOUTS = 50;

/** Une sortie lue, prête à ranger (les colonnes de `sport_runs`). */
export interface ShortcutRun {
  started_at: string;
  day: string;
  distance_m: number;
  duration_s: number;
  elevation_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  kind: 'footing' | 'longue';
  title: string;
  source: 'raccourci';
  source_ref: string;
}

export type ReadResult = { runs: ShortcutRun[]; rejected: string[] } | { error: string };

/** Au-delà, une sortie est rangée comme sortie longue (la seule sorte qu'on devine ici). */
export const LONG_RUN_M = 18_000;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** « 10,23 » → 10.23 ; un nombre reste un nombre. */
function number(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  const m = /^\s*(-?\d+(?:[.,]\d+)?)/.exec(v.replace(/[   ](?=\d{3}\b)/g, ''));
  return m ? Number(m[1].replace(',', '.')) : null;
}

/**
 * Une distance en mètres. Avec une unité (« 10,23 km », « 10230 m », « 6,4 mi »)
 * on la suit ; un nombre seul est en kilomètres jusqu'à 200, en mètres au-delà
 * (Santé donne des km sur un iPhone réglé en français).
 */
export function readDistance(v: unknown): number | null {
  const n = number(v);
  if (n === null || n < 0) return null;
  const unit = typeof v === 'string' ? v.toLowerCase().replace(/[\d\s.,  ]/g, '') : '';
  let m: number;
  if (unit.startsWith('km')) m = n * 1000;
  else if (unit.startsWith('mi')) m = n * 1609.344;
  else if (unit === 'm' || unit.startsWith('mètre') || unit.startsWith('metre')) m = n;
  else if (unit === '') m = n <= 200 ? n * 1000 : n;
  else return null;
  return Math.round(m);
}

/**
 * Une durée en secondes : « 52:30 », « 1:05:09 », « 3150 » (secondes),
 * « 52,5 min », « 1 h 05 », « 3150 s ».
 */
export function readDuration(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? Math.round(v) : null;
  if (typeof v !== 'string') return null;
  const s = v.trim().toLowerCase();
  const clock = /^(\d+):(\d{1,2})(?::(\d{1,2}))?$/.exec(s);
  if (clock) {
    const [a, b, c] = [Number(clock[1]), Number(clock[2]), clock[3] === undefined ? null : Number(clock[3])];
    return c === null ? a * 60 + b : a * 3600 + b * 60 + c;
  }
  const hm = /^(\d+)\s*h\s*(\d{1,2})?\s*(?:min)?$/.exec(s);
  if (hm) return Number(hm[1]) * 3600 + Number(hm[2] ?? 0) * 60;
  const n = number(s);
  if (n === null || n <= 0) return null;
  const unit = s.replace(/[\d\s.,]/g, '');
  if (unit === '' || unit === 's' || unit.startsWith('sec')) return Math.round(n);
  if (unit.startsWith('min') || unit === 'mn') return Math.round(n * 60);
  if (unit === 'h' || unit.startsWith('heure') || unit.startsWith('hour')) return Math.round(n * 3600);
  return null;
}

/** Un battement par minute, entre 30 et 250 (les bornes de la base). */
function readHr(v: unknown): number | null {
  const n = number(v);
  if (n === null) return null;
  const r = Math.round(n);
  return r >= 30 && r <= 250 ? r : null;
}

/**
 * Le départ, avec le jour **tel que l'iPhone l'a vécu** : une date ISO avec son
 * décalage (« 2026-10-07T18:32:00+02:00 ») dit le jour local dans ses dix
 * premiers caractères. Sans décalage, on ne sait pas quel jour c'était à
 * minuit près : refusée.
 */
export function readStart(v: unknown): { startedAt: string; day: string } | null {
  if (typeof v !== 'string') return null;
  // « +0200 » devient « +02:00 », que tous les moteurs lisent.
  const s = v.trim().replace(' ', 'T').replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:[.,]\d+)?)?(Z|[+-]\d{2}:\d{2})$/.exec(s);
  if (!m) return null;
  const date = new Date(s.replace(',', '.'));
  if (Number.isNaN(date.getTime())) return null;
  return { startedAt: date.toISOString(), day: m[1] };
}

/** Ce que la base acceptera (`sport_runs`), dit en clair quand ce n'est pas le cas. */
function check(run: ShortcutRun, now: Date): string | null {
  if (run.distance_m < 100) return 'distance de moins de 100 m';
  if (run.distance_m > 500_000) return 'distance de plus de 500 km';
  if (run.duration_s < 60) return 'durée de moins d’une minute';
  if (run.duration_s > 259_200) return 'durée de plus de 72 heures';
  const pace = run.duration_s / (run.distance_m / 1000);
  if (pace < 120) return 'allure plus rapide que 2:00 /km';
  if (new Date(run.started_at).getTime() > now.getTime() + 10 * 60_000) return 'départ dans le futur';
  if (run.day < '2000-01-01') return 'départ avant l’an 2000';
  return null;
}

/** Une séance, ou la raison de son refus. */
export function readWorkout(w: unknown, now: Date): ShortcutRun | string {
  if (!isObject(w)) return 'séance illisible';
  const start = readStart(w.start ?? w.startDate);
  if (!start) return 'départ manquant ou sans fuseau (format ISO 8601 attendu)';
  const distance = readDistance(w.distance);
  if (distance === null) return 'distance manquante ou illisible';
  let duration = readDuration(w.duration);
  if (duration === null) {
    const end = readStart(w.end ?? w.endDate);
    if (end) duration = Math.round((Date.parse(end.startedAt) - Date.parse(start.startedAt)) / 1000);
  }
  if (duration === null || duration <= 0) return 'durée manquante ou illisible';
  const elevation = number(w.elevation);
  const id = typeof w.id === 'string' && w.id.trim() ? w.id.trim().slice(0, 150) : null;
  const run: ShortcutRun = {
    started_at: start.startedAt,
    day: start.day,
    distance_m: distance,
    duration_s: duration,
    elevation_m: elevation !== null && elevation >= 0 && elevation <= 20_000 ? Math.round(elevation) : null,
    avg_hr: readHr(w.avgHr ?? w.heartRate),
    max_hr: readHr(w.maxHr),
    kind: distance >= LONG_RUN_M ? 'longue' : 'footing',
    title: typeof w.name === 'string' ? w.name.trim().slice(0, 120) : '',
    source: 'raccourci',
    // L'identifiant de Santé s'il est envoyé ; sinon le départ à la minute,
    // qui suffit à reconnaître une séance renvoyée le lendemain.
    source_ref: id ? `sante:${id}` : `sante:${start.startedAt.slice(0, 16)}`,
  };
  if (run.avg_hr !== null && run.max_hr !== null && run.max_hr < run.avg_hr) run.max_hr = null;
  return check(run, now) ?? run;
}

/**
 * Le corps entier : une séance (`{ start, distance, duration, … }`) ou
 * plusieurs (`{ workouts: [ … ] }`, les sept derniers jours).
 */
export function readPayload(body: unknown, now: Date): ReadResult {
  if (!isObject(body)) return { error: 'Corps JSON attendu.' };
  const list = Array.isArray(body.workouts) ? body.workouts : [body];
  if (list.length === 0) return { runs: [], rejected: [] };
  if (list.length > MAX_WORKOUTS) return { error: `Trop de séances d’un coup (${MAX_WORKOUTS} au plus).` };
  const runs: ShortcutRun[] = [];
  const rejected: string[] = [];
  for (const [i, w] of list.entries()) {
    const r = readWorkout(w, now);
    if (typeof r === 'string') rejected.push(list.length > 1 ? `séance ${i + 1} : ${r}` : r);
    else if (!runs.some((x) => x.source_ref === r.source_ref)) runs.push(r);
  }
  return { runs, rejected };
}

/**
 * La même sortie venue par un autre chemin (saisie à la main, archive Strava) :
 * départ à dix minutes près, distance à 10 % près. Le même critère vit dans
 * l'app (`src/modules/sport/lib/sameRun.ts`) ; un test compare les deux.
 */
export function sameRun(a: { startedAt: string; distanceM: number }, b: { startedAt: string; distanceM: number }): boolean {
  const gap = Math.abs(Date.parse(a.startedAt) - Date.parse(b.startedAt));
  const longer = Math.max(a.distanceM, b.distanceM);
  return gap <= 10 * 60_000 && (longer === 0 || Math.abs(a.distanceM - b.distanceM) / longer <= 0.1);
}

const km = (m: number) => `${(m / 1000).toFixed(m < 10_000 ? 2 : 1).replace('.', ',')} km`;
function clock(s: number): string {
  const h = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h} h ${String(mm).padStart(2, '0')}` : `${mm} min`;
}

/** La phrase que le raccourci affiche en notification. */
export function summary(added: ShortcutRun[], known: number, rejected: string[]): string {
  const parts: string[] = [];
  if (added.length === 1) parts.push(`Sortie ajoutée à Sport : ${km(added[0].distance_m)} en ${clock(added[0].duration_s)}.`);
  else if (added.length > 1) parts.push(`${added.length} sorties ajoutées à Sport.`);
  if (known > 0) parts.push(known === 1 ? 'Déjà dans Sport.' : `${known} déjà dans Sport.`);
  if (rejected.length > 0) parts.push(`Refusée${rejected.length > 1 ? 's' : ''} : ${rejected.join(' ; ')}.`);
  return parts.join(' ') || 'Aucune séance reçue.';
}
