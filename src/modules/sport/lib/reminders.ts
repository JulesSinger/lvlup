/**
 * Les rappels de Sport — bibliothèque pure (docs/etude-sport.md §6.3, §18).
 * Le module calcule, le socle envoie (`coreStore.scheduleReminders`).
 *
 * Rien les jours sans séance :
 *  · le **lundi à 7 h 30**, la semaine du plan (les séances sans jour, qu'on
 *    place soi-même) ;
 *  · **à 7 h 30 le jour d'une séance datée**, la séance et sa consigne ;
 *  · **la veille de la course à 18 h**.
 * Une séance déjà faite (une sortie rattachée) ne se rappelle pas.
 */
import type { ReminderInput } from '../../../core/data/coreStore';
import { dayString, shiftDay } from '../../../core/lib/day';
import { formatKm, formatPaceRange } from './format';
import { PHASE_LABELS } from './plan';
import { planWeeks } from './planView';
import type { Plan, PlanSession, Run } from './types';

export const REMINDER_HORIZON_DAYS = 7;
export const MORNING = '07:30';
export const RACE_EVE = '18:00';

function localInstant(day: string, time: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
}

function sessionLine(s: PlanSession): string {
  return [
    s.title,
    s.distanceM !== null ? formatKm(s.distanceM) : null,
    s.paceMinS !== null && s.paceMaxS !== null ? formatPaceRange(s.paceMinS, s.paceMaxS) : null,
    s.hrZone !== null ? `zone ${s.hrZone}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function plannedReminders(data: { runs: Run[]; plans: Plan[]; sessions: PlanSession[] }, now: Date, horizonDays = REMINDER_HORIZON_DAYS): ReminderInput[] {
  const plan = data.plans.find((p) => p.status === 'actif');
  if (!plan) return [];
  const today = dayString(now);
  const last = shiftDay(today, horizonDays - 1);
  const out: ReminderInput[] = [];
  const push = (ref: string, day: string, time: string, title: string, body: string) => {
    if (day < today || day > last) return;
    const at = localInstant(day, time);
    if (at <= now) return;
    out.push({ ref, fireAt: at.toISOString(), title, body: body.slice(0, 1000), url: '/#/sport' });
  };

  for (const week of planWeeks(plan, data.sessions, data.runs, today)) {
    const open = week.sessions.filter((s) => s.state !== 'faite' && s.session.kind !== 'course').map((s) => s.session);
    const undated = open.filter((s) => !s.day);
    if (undated.length > 0) {
      const km = undated.reduce((s, x) => s + (x.distanceM ?? 0), 0);
      push(
        `week:${plan.id}:${week.week}`,
        week.monday,
        MORNING,
        `🏃 Semaine ${week.week} du plan · ${PHASE_LABELS[week.phase]}`,
        `${undated.length} séance${undated.length > 1 ? 's' : ''}${km > 0 ? `, ${formatKm(km)}` : ''} : ${undated.map((s) => s.title).join(', ')}.`,
      );
    }
    for (const s of open.filter((x) => x.day)) {
      push(`session:${s.id}:${s.day}`, s.day!, MORNING, `🏃 Aujourd’hui : ${s.title}`, [sessionLine(s), s.instructions].filter(Boolean).join('. '));
    }
  }
  push(`race:${plan.id}:${plan.raceDay}`, shiftDay(plan.raceDay, -1), RACE_EVE, `🏁 Demain : ${plan.title}`, plan.raceDayConfirmed ? 'Bonne course !' : 'Bonne course ! (la date était encore « à confirmer » dans Sport)');
  return out;
}
