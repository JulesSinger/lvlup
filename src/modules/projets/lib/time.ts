/**
 * Le temps passé (docs/etude-projets.md §3.10) — bibliothèque pure.
 *
 * Une durée tapée après coup, pas de chronomètre : « 2h30 », « 2 h », « 45 »,
 * « 1,5 h ». Le taux horaire réel dit ce qu'a vraiment rapporté une heure —
 * c'est ce qui apprend à chiffrer le devis suivant.
 */
import { TIME_ENTRY_MAX_MINUTES, type TimeEntry } from './types';

/**
 * « 2h30 », « 2 h 30 », « 2h », « 1,5h », « 1.5 h », « 45 », « 45 min » →
 * minutes. Un nombre seul compte en minutes. `null` si illisible, nul ou
 * au-delà d'une journée.
 */
export function parseDuration(text: string): number | null {
  const t = text.trim().toLowerCase().replace(',', '.').replace(/\s+/g, '');
  let minutes: number | null = null;
  let m: RegExpExecArray | null;
  if ((m = /^(\d+)h(\d{1,2})?(min)?$/.exec(t))) minutes = Number(m[1]) * 60 + Number(m[2] ?? 0);
  else if ((m = /^(\d+(?:\.\d+)?)h$/.exec(t))) minutes = Math.round(Number(m[1]) * 60);
  else if ((m = /^(\d+)(min|mn|m)?$/.exec(t))) minutes = Number(m[1]);
  if (minutes === null || minutes <= 0 || minutes > TIME_ENTRY_MAX_MINUTES) return null;
  return minutes;
}

/** 150 → « 2 h 30 », 45 → « 45 min », 120 → « 2 h ». */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

export const totalMinutes = (entries: readonly TimeEntry[], projectId: string) =>
  entries.filter((e) => e.projectId === projectId).reduce((sum, e) => sum + e.minutes, 0);

/** Combien rapporte une heure, en centimes ; `null` sans temps noté. */
export function hourlyRateCents(amountCents: number, minutes: number): number | null {
  if (minutes <= 0) return null;
  return Math.round((amountCents * 60) / minutes);
}
