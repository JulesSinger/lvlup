/**
 * La saisie d'une sortie à la main — bibliothèque pure. Ce qu'on tape
 * (« 10,2 » km, « 1:05:09 ») devient des mètres et des secondes entiers.
 */
import { dayString } from '../../../core/lib/day';
import type { Run, RunInput, RunKind } from './types';

export interface RunForm {
  day: string;
  /** Heure de départ, `HH:MM`. */
  time: string;
  km: string;
  duration: string;
  avgHr: string;
  maxHr: string;
  elevation: string;
  kind: RunKind;
  effort: string;
  title: string;
  note: string;
}

/** « 10,2 », « 10.2 », « 10 » → mètres ; `null` si ce n'est pas un nombre positif. */
export function parseKm(text: string): number | null {
  const n = Number.parseFloat(text.trim().replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 1000) : null;
}

/**
 * « 1:05:09 », « 47:12 », « 45 » (minutes), « 1h05 », « 1 h 05 » → secondes ;
 * `null` si rien ne se comprend.
 */
export function parseDuration(text: string): number | null {
  const s = text.trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return null;
  const hm = /^(\d+)h(\d{1,2})?(?:min)?$/.exec(s);
  if (hm) return Number(hm[1]) * 3600 + Number(hm[2] ?? 0) * 60;
  if (/^\d+(min)?$/.test(s)) return Number.parseInt(s, 10) * 60;
  const parts = s.split(':');
  if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const [a, b, c] = parts.map(Number);
  if (parts.length === 2) return b < 60 ? a * 60 + b : null;
  return b < 60 && c < 60 ? a * 3600 + b * 60 + c : null;
}

const intOrNull = (text: string) => {
  const t = text.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isInteger(n) ? n : Number.NaN;
};

/** Un formulaire vide : aujourd'hui, à l'heure qu'il est. */
export function emptyRunForm(now = new Date()): RunForm {
  return {
    day: dayString(now),
    time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
    km: '',
    duration: '',
    avgHr: '',
    maxHr: '',
    elevation: '',
    kind: 'footing',
    effort: '',
    title: '',
    note: '',
  };
}

const two = (n: number) => String(n).padStart(2, '0');

/** Une sortie existante, dans le formulaire. */
export function runToForm(run: Run): RunForm {
  const start = new Date(run.startedAt);
  const h = Math.floor(run.durationS / 3600);
  const m = Math.floor((run.durationS % 3600) / 60);
  const sec = run.durationS % 60;
  return {
    day: run.day,
    time: `${two(start.getHours())}:${two(start.getMinutes())}`,
    km: String(run.distanceM / 1000).replace('.', ','),
    duration: h > 0 ? `${h}:${two(m)}:${two(sec)}` : `${m}:${two(sec)}`,
    avgHr: run.avgHr === null ? '' : String(run.avgHr),
    maxHr: run.maxHr === null ? '' : String(run.maxHr),
    elevation: run.elevationM === null ? '' : String(run.elevationM),
    kind: run.kind,
    effort: run.effort === null ? '' : String(run.effort),
    title: run.title,
    note: run.note,
  };
}

/** Le formulaire en sortie à enregistrer, ou le premier problème, dit en français. */
export function formToRun(form: RunForm): { input: RunInput } | { error: string } {
  const distanceM = parseKm(form.km);
  if (distanceM === null) return { error: 'Donne la distance, en kilomètres (« 10,2 »).' };
  const durationS = parseDuration(form.duration);
  if (durationS === null || durationS <= 0) return { error: 'Donne la durée (« 52:30 » ou « 1:05:09 »).' };
  const [y, mo, d] = form.day.split('-').map(Number);
  const [hh, mm] = (form.time || '00:00').split(':').map(Number);
  const start = new Date(y, mo - 1, d, hh || 0, mm || 0);
  if (Number.isNaN(start.getTime())) return { error: 'Jour ou heure invalide.' };
  const avgHr = intOrNull(form.avgHr);
  const maxHr = intOrNull(form.maxHr);
  const elevationM = intOrNull(form.elevation);
  const effort = intOrNull(form.effort);
  if ([avgHr, maxHr, elevationM, effort].some((v) => Number.isNaN(v))) return { error: 'Un nombre entier est attendu (FC, dénivelé, ressenti).' };
  return {
    input: {
      startedAt: start.toISOString(),
      day: form.day,
      distanceM,
      durationS,
      avgHr,
      maxHr,
      elevationM,
      kind: form.kind,
      effort,
      title: form.title.trim(),
      note: form.note.trim(),
    },
  };
}

/** Une allure tapée, « 5:20 » (par kilomètre) → secondes ; `null` si vide ou incompréhensible. */
export function parsePace(text: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim().replace(/\s*\/\s*km$/i, ''));
  if (!m || Number(m[2]) >= 60) return null;
  const s = Number(m[1]) * 60 + Number(m[2]);
  return s >= 120 && s <= 1200 ? s : null;
}

/** Une allure en secondes, pour un champ : « 5:20 ». */
export function paceInput(seconds: number | null): string {
  if (seconds === null) return '';
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
