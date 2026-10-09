/**
 * Les règles du lien avec Strava (docs/etude-sport.md §21) — pures, sans Deno
 * ni base : testées par Vitest (`src/modules/sport/lib/stravaApi.test.ts`),
 * comme `payload.ts` pour `sport-import`.
 */

/** Lire ses activités, privées comprises : rien d'autre (jamais écrire chez Strava). */
export const STRAVA_SCOPE = 'read,activity:read_all';
/** Les sortes d'activité que Sport reprend : la course, sur route, en trail ou sur tapis. */
export const RUN_TYPES = ['Run', 'TrailRun', 'VirtualRun'] as const;
/** Au-delà, une sortie sans autre indication est rangée comme sortie longue (comme le raccourci). */
export const LONG_RUN_M = 18_000;
/** Première synchronisation : les quatre-vingt-dix derniers jours (l'archive couvre le reste). */
export const FIRST_SYNC_DAYS = 90;
/** On repart un peu avant la dernière activité vue : une activité ajoutée en retard n'est pas manquée. */
export const OVERLAP_DAYS = 3;
/** Un lien de connexion vaut un quart d'heure. */
export const STATE_TTL_MS = 15 * 60_000;

/** Une activité telle que `GET /athlete/activities` la rend (les champs utiles). */
export interface StravaActivity {
  id: number;
  name?: string;
  type?: string;
  sport_type?: string;
  start_date?: string;
  start_date_local?: string;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
  total_elevation_gain?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  /** 1 : course (compétition), 2 : sortie longue, 3 : séance. */
  workout_type?: number | null;
}

/** Une sortie prête à ranger (les colonnes de `sport_runs`). */
export interface StravaRun {
  started_at: string;
  day: string;
  distance_m: number;
  duration_s: number;
  elevation_m: number | null;
  avg_hr: number | null;
  max_hr: number | null;
  kind: 'footing' | 'longue' | 'course';
  title: string;
  source: 'strava';
  source_ref: string;
}

export function isRun(a: StravaActivity): boolean {
  const type = a.sport_type ?? a.type ?? '';
  return (RUN_TYPES as readonly string[]).includes(type);
}

const hr = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 30 && v <= 250 ? Math.round(v) : null);

/**
 * Une activité de course en sortie de Sport, ou null si elle ne tient pas dans
 * les règles de la base (on l'écarte plutôt que de la tordre). La référence
 * `strava:<id>` est celle de l'archive : une sortie déjà reprise de l'archive
 * n'est jamais ajoutée deux fois. Le jour est celui de l'heure locale du départ,
 * celui que Jules a vécu.
 */
export function toRun(a: StravaActivity): StravaRun | null {
  if (!isRun(a) || typeof a.id !== 'number' || !a.start_date) return null;
  const started = Date.parse(a.start_date);
  const local = a.start_date_local ?? a.start_date;
  if (!Number.isFinite(started) || !/^\d{4}-\d{2}-\d{2}/.test(local)) return null;
  const distance = Math.round(a.distance ?? 0);
  const duration = Math.round(a.moving_time || a.elapsed_time || 0);
  if (distance < 0 || distance > 500_000 || duration < 1 || duration > 259_200) return null;
  const elevation = typeof a.total_elevation_gain === 'number' ? Math.round(a.total_elevation_gain) : null;
  const kind = a.workout_type === 1 ? 'course' : a.workout_type === 2 || distance >= LONG_RUN_M ? 'longue' : 'footing';
  return {
    started_at: new Date(started).toISOString(),
    day: local.slice(0, 10),
    distance_m: distance,
    duration_s: duration,
    elevation_m: elevation !== null && elevation >= 0 && elevation <= 20_000 ? elevation : null,
    avg_hr: hr(a.average_heartrate),
    max_hr: hr(a.max_heartrate),
    kind,
    title: (a.name ?? '').trim().slice(0, 120),
    source: 'strava',
    source_ref: `strava:${a.id}`,
  };
}

/**
 * Les temps au kilomètre d'une activité détaillée (`splits_metric`), en
 * secondes de mouvement ; le dernier morceau, s'il n'est pas un kilomètre
 * entier, n'en est pas un (comme `summarizeTrack` pour un GPX).
 */
export function splitsFrom(splits: unknown): number[] | null {
  if (!Array.isArray(splits)) return null;
  const out: number[] = [];
  for (const s of splits as { distance?: number; moving_time?: number; elapsed_time?: number }[]) {
    if (typeof s?.distance !== 'number' || s.distance < 950) continue;
    const t = s.moving_time || s.elapsed_time;
    if (typeof t === 'number' && t > 0 && t < 3600) out.push(Math.round(t));
  }
  return out.length ? out : null;
}

/** D'où repartir, en secondes depuis 1970 (le paramètre `after` de Strava). */
export function syncAfter(lastActivityAt: string | null, now: Date): number {
  const last = lastActivityAt ? Date.parse(lastActivityAt) : NaN;
  const from = Number.isFinite(last) ? last - OVERLAP_DAYS * 86_400_000 : now.getTime() - FIRST_SYNC_DAYS * 86_400_000;
  return Math.floor(from / 1000);
}

/** Où revenir après Strava : l'adresse d'Atlas, jamais autre chose qu'une origine http(s). */
export function safeReturn(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) return null;
    if (url.username || url.password) return null;
    return url.origin;
  } catch {
    return null;
  }
}

function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(text: string): Uint8Array {
  const b = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))));
}

export interface StatePayload {
  /** Le compte Atlas qui a demandé la connexion. */
  u: string;
  /** L'origine d'Atlas où revenir. */
  r: string;
  /** Fin de validité, en millisecondes. */
  e: number;
}

/**
 * Le paramètre `state` de la connexion OAuth, signé : Strava le rend tel quel
 * au retour, et c'est lui qui dit à quel compte Atlas rattacher Strava. Signé
 * (HMAC), il ne peut être ni fabriqué ni modifié ; daté, il ne sert qu'un
 * quart d'heure. Aucune table pour le retenir.
 */
export async function signState(payload: StatePayload, secret: string): Promise<string> {
  const body = base64url(new TextEncoder().encode(JSON.stringify(payload)));
  return `${body}.${await hmac(secret, body)}`;
}

export async function verifyState(state: unknown, secret: string, now: number): Promise<StatePayload | null> {
  if (typeof state !== 'string' || state.length > 1000) return null;
  const [body, signature] = state.split('.');
  if (!body || !signature || (await hmac(secret, body)) !== signature) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64url(body))) as StatePayload;
    if (typeof payload.u !== 'string' || typeof payload.r !== 'string' || typeof payload.e !== 'number') return null;
    if (payload.e < now || !safeReturn(payload.r)) return null;
    return payload;
  } catch {
    return null;
  }
}

/** La permission de lire les activités a-t-elle été donnée (la case peut être décochée chez Strava) ? */
export const canReadActivities = (scope: string) => /(^|,)activity:read(_all)?(,|$)/.test(scope);

/** La phrase montrée après une synchronisation. */
export function syncMessage(added: number, known: number): string {
  if (added === 0) return known > 0 ? 'Rien de nouveau sur Strava.' : 'Aucune course récente sur Strava.';
  return `${added} sortie${added > 1 ? 's' : ''} reçue${added > 1 ? 's' : ''} de Strava.`;
}
