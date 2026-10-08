/**
 * Le calque de Sport dans Calendar — bibliothèque pure (docs/etude-sport.md
 * §6.2, §18).
 *
 * Les sorties faites, à leur heure ; le plan en cours : chaque séance qui a un
 * jour, déplaçable dans sa semaine ; les séances sans jour (le plan n'impose
 * pas de jours, décision de Jules) résumées en une marque le lundi de leur
 * semaine ; le jour de la course.
 */
import type { CalendarMark } from '../../../core/lib/services';
import { shiftDay } from '../../../core/lib/day';
import { formatDuration, formatKm, formatPace, formatPaceRange } from './format';
import { KIND_LABELS } from './kinds';
import { paceOf } from './pace';
import { PHASE_LABELS } from './plan';
import { planWeeks } from './planView';
import type { Plan, PlanSession, Run } from './types';

const two = (n: number) => String(n).padStart(2, '0');

function sessionText(s: PlanSession): string {
  return [
    s.distanceM !== null ? formatKm(s.distanceM) : null,
    s.paceMinS !== null && s.paceMaxS !== null ? formatPaceRange(s.paceMinS, s.paceMaxS) : null,
    s.hrZone !== null ? `zone ${s.hrZone}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export interface SportCalendarData {
  runs: Run[];
  plans: Plan[];
  sessions: PlanSession[];
}

/** Une marque : `run:<id>`, `session:<id>`, `week:<plan>:<n>`, `race:<plan>`. */
export function markTarget(markId: string): { kind: 'run' | 'session' | 'week' | 'race'; id: string } | null {
  const m = /^(run|session|week|race):(.+)$/.exec(markId);
  return m ? { kind: m[1] as 'run' | 'session' | 'week' | 'race', id: m[2] } : null;
}

export function sportMarks(data: SportCalendarData, from: string, to: string, today: string): CalendarMark[] {
  const marks: CalendarMark[] = [];
  for (const r of data.runs) {
    if (r.day < from || r.day > to) continue;
    const start = new Date(r.startedAt);
    const pace = paceOf(r.distanceM, r.durationS);
    marks.push({
      id: `run:${r.id}`,
      day: r.day,
      title: `✓ ${r.title || KIND_LABELS[r.kind]} · ${formatKm(r.distanceM)}`,
      detail: [formatDuration(r.durationS), pace ? formatPace(pace) : null, r.avgHr ? `${r.avgHr} bpm` : null].filter(Boolean).join(' · '),
      time: `${two(start.getHours())}:${two(start.getMinutes())}`,
      duration: Math.min(1440, Math.max(15, Math.round(r.durationS / 60))),
      link: `run:${r.id}`,
    });
  }

  const plan = data.plans.find((p) => p.status === 'actif');
  if (!plan) return marks;
  if (plan.raceDay >= from && plan.raceDay <= to) {
    marks.push({ id: `race:${plan.id}`, day: plan.raceDay, title: `🏁 ${plan.title}`, detail: plan.raceDayConfirmed ? 'Date officielle' : 'Date à confirmer', link: 'plan' });
  }
  for (const week of planWeeks(plan, data.sessions, data.runs, today)) {
    if (week.monday > to || shiftDay(week.monday, 6) < from) continue;
    const open = week.sessions.filter((s) => s.state !== 'faite');
    for (const { session } of open.filter((s) => s.session.day)) {
      const day = session.day!;
      if (day < from || day > to || session.kind === 'course') continue;
      marks.push({
        id: `session:${session.id}`,
        day,
        title: `${session.title}${session.distanceM !== null ? ` · ${formatKm(session.distanceM)}` : ''}`,
        detail: [sessionText(session), session.instructions].filter(Boolean).join(' — '),
        movable: true,
        link: `session:${session.id}`,
      });
    }
    const undated = open.filter((s) => !s.session.day && s.session.kind !== 'course');
    if (undated.length > 0 && week.monday >= from && week.monday <= to) {
      const km = undated.reduce((s, x) => s + (x.session.distanceM ?? 0), 0);
      marks.push({
        id: `week:${plan.id}:${week.week}`,
        day: week.monday,
        title: `🏃 Semaine ${week.week} · ${undated.length} séance${undated.length > 1 ? 's' : ''}${km > 0 ? `, ${formatKm(km)}` : ''}`,
        detail: `${PHASE_LABELS[week.phase]}${week.recovery ? ' (allégée)' : ''} — ${undated.map((x) => x.session.title).join(', ')}`,
        link: 'plan',
      });
    }
  }
  return marks;
}

/**
 * Où une séance peut aller : un jour de **sa** semaine du plan. La déplacer
 * plus loin changerait le plan lui-même (la semaine porte la progression du
 * volume) : c'est le rôle de la fenêtre de la séance, pas d'un glisser.
 */
export function sessionMoveError(weekMonday: string, to: { day: string; time: string | null }): string | null {
  if (to.time !== null) return 'Une séance se pose à la journée : glisse-la dans la bande « Journée ».';
  if (to.day < weekMonday || to.day > shiftDay(weekMonday, 6)) return 'Une séance reste dans sa semaine du plan : change le plan dans Sport pour aller plus loin.';
  return null;
}
