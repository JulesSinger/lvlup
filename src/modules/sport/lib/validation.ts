/**
 * Validation — bibliothèque pure. Les règles de la base (migration du
 * 07/10/2026) dites en français, avant l'envoi, pour qu'un refus de Postgres
 * ne soit jamais la première nouvelle.
 */
import {
  PLAN_TITLE_MAX,
  RUN_DISTANCE_MAX_M,
  RUN_DURATION_MAX_S,
  RUN_NOTE_MAX,
  RUN_TITLE_MAX,
  SESSIONS_PER_WEEK_MAX,
  SESSIONS_PER_WEEK_MIN,
  type PlanInput,
  type RunInput,
  type SportSettings,
} from './types';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const hrOk = (v: number | null | undefined) => v === null || v === undefined || (Number.isInteger(v) && v >= 30 && v <= 250);

/** Un message pour la première règle enfreinte, ou `null`. */
export function validateRun(input: RunInput): string | null {
  if (!DAY.test(input.day)) return 'Jour invalide.';
  if (Number.isNaN(Date.parse(input.startedAt))) return 'Heure de départ invalide.';
  if (!Number.isInteger(input.distanceM) || input.distanceM < 0 || input.distanceM > RUN_DISTANCE_MAX_M) {
    return 'La distance doit être comprise entre 0 et 500 km.';
  }
  if (!Number.isInteger(input.durationS) || input.durationS < 1 || input.durationS > RUN_DURATION_MAX_S) {
    return 'La durée doit être comprise entre 1 seconde et 72 heures.';
  }
  if (!hrOk(input.avgHr) || !hrOk(input.maxHr)) return 'Une fréquence cardiaque se situe entre 30 et 250.';
  if (input.avgHr && input.maxHr && input.avgHr > input.maxHr) return 'La FC moyenne dépasse la FC maximale.';
  if (input.effort !== null && input.effort !== undefined && !(Number.isInteger(input.effort) && input.effort >= 1 && input.effort <= 10)) {
    return 'Le ressenti va de 1 à 10.';
  }
  if ((input.title ?? '').length > RUN_TITLE_MAX) return `Le titre est trop long (${RUN_TITLE_MAX} caractères au plus).`;
  if ((input.note ?? '').length > RUN_NOTE_MAX) return `La note est trop longue (${RUN_NOTE_MAX} caractères au plus).`;
  return null;
}

export function validatePlan(input: PlanInput): string | null {
  const title = input.title.trim();
  if (!title) return 'Donne un nom au plan.';
  if (title.length > PLAN_TITLE_MAX) return `Le nom est trop long (${PLAN_TITLE_MAX} caractères au plus).`;
  if (!DAY.test(input.raceDay) || !DAY.test(input.startDay)) return 'Date invalide.';
  if (input.startDay > input.raceDay) return 'Le plan doit commencer avant la course.';
  if (input.raceDistanceM < 1000) return 'La course fait au moins 1 km.';
  const spw = input.sessionsPerWeek ?? 3;
  if (spw < SESSIONS_PER_WEEK_MIN || spw > SESSIONS_PER_WEEK_MAX) {
    return `De ${SESSIONS_PER_WEEK_MIN} à ${SESSIONS_PER_WEEK_MAX} séances par semaine.`;
  }
  const hasDistance = input.referenceDistanceM !== null && input.referenceDistanceM !== undefined;
  const hasTime = input.referenceS !== null && input.referenceS !== undefined;
  if (hasDistance !== hasTime) return 'Un temps de référence demande sa distance et son temps.';
  return null;
}

export function validateSettings(s: Pick<SportSettings, 'hrMax' | 'hrRest'>): string | null {
  if (s.hrMax !== null && (s.hrMax < 100 || s.hrMax > 250)) return 'La FC maximale se situe entre 100 et 250.';
  if (s.hrRest !== null && (s.hrRest < 25 || s.hrRest > 120)) return 'La FC de repos se situe entre 25 et 120.';
  if (s.hrMax !== null && s.hrRest !== null && s.hrRest >= s.hrMax) return 'La FC de repos doit être sous la FC maximale.';
  return null;
}
