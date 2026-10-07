import type { CSSProperties } from 'react';
import { formatDate, freezeFill, freezeOffer, todayPP } from '../lib/progress';
import { MAX_FREEZES, computeStreak, dayString, nextStreakMilestone, recentStreakDays } from '../lib/streak';
import type { DayStreakStatus } from '../lib/streak';
import { FREEZE_COST } from '../lib/types';
import type { Checkin, FreezePurchase, Goal } from '../lib/types';
import { DailyRing } from './DailyRing';

/** Ce que dit chaque jour de la bandelette de streak, au survol. */
function streakDayTitle(entry: { day: string; status: DayStreakStatus }, today: string): string {
  const date = formatDate(`${entry.day}T12:00:00`);
  const etat =
    entry.status === 'done'
      ? 'fait'
      : entry.status === 'frozen'
        ? 'gel utilisé'
        : entry.status === 'missed'
          ? 'manqué'
          : entry.day === today
            ? 'à venir'
            : 'avant le début du streak';
  return `${date} : ${etat}`;
}

/**
 * Le bandeau du jour, en tête de l'accueil (07/10/2026, demande de Jules).
 *
 * Il remplace le grand anneau, la flamme et le bandeau « streak en jeu » : le
 * streak était dit trois fois sur la page (bandeau, flamme, profil), il ne
 * l'est plus qu'ici. L'anneau des PP du jour y reste, en petit — il répond
 * toujours à « ai-je fini ? », sans prendre le haut de la page à ce qui se
 * coche. Le streak en jeu colore le bandeau au lieu d'en ajouter un.
 */
export function DayBand({
  goals,
  checkins,
  freezePurchases,
  dailyGoal,
  onBuyFreeze,
}: {
  goals: Goal[];
  checkins: Checkin[];
  freezePurchases: FreezePurchase[];
  dailyGoal: number;
  onBuyFreeze: () => void;
}) {
  const today = dayString();
  const earned = todayPP(goals, checkins);
  const streak = computeStreak(goals, checkins, today, freezePurchases);
  const recentDays = recentStreakDays(goals, checkins, freezePurchases, today, 7);
  const remaining = Math.max(0, dailyGoal - earned);
  const dayDone = earned >= dailyGoal;
  const atRisk = streak.atRisk && streak.current > 0;
  const milestone = nextStreakMilestone(streak.current);
  const offre = freezeOffer(goals, checkins, freezePurchases, streak.freezes, MAX_FREEZES, FREEZE_COST);

  return (
    <section className={`day-band${atRisk ? ' at-risk' : ''}${dayDone ? ' done' : ''}`}>
      <div className="day-band-streak">
        <span className={`flame${streak.activeToday ? ' lit' : ''}`} aria-hidden="true">
          🔥
        </span>
        <div>
          <div className="flame-count">{streak.current}</div>
          <div className="flame-label">
            jour{streak.current > 1 ? 's' : ''} d'affilée
            {streak.freezes > 0 && (
              <>
                {' · '}
                <span
                  className="freeze"
                  title={`${streak.freezes} gel(s) : un jour manqué en consomme un au lieu de casser le streak`}
                >
                  ❄×{streak.freezes}
                </span>
              </>
            )}
          </div>
        </div>
        {/* Les sept derniers jours : ce que la seule flamme du jour ne raconte
            pas — quels jours ont été faits, lesquels ont coûté un gel. */}
        <ol className="streak-strip" aria-label="Les sept derniers jours">
          {recentDays.map((entry) => (
            <li key={entry.day} className={`streak-day ${entry.status}`} title={streakDayTitle(entry, today)}>
              <span aria-hidden="true">{entry.status === 'frozen' ? '❄' : '🔥'}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="day-band-day">
        <DailyRing value={earned} goal={dailyGoal} size={62} compact />
        <div>
          <h2 className="daily-title">
            {dayDone ? 'Journée bouclée' : earned === 0 ? 'La journée commence' : `Plus que ${remaining} PP`}
          </h2>
          <p className="daily-sub">
            {earned} / {dailyGoal} PP aujourd'hui
            {dayDone && earned > dailyGoal ? ` · +${earned - dailyGoal} au-delà` : ''}
          </p>
        </div>
      </div>

      {/* La seule chose que les PP achètent : le bouton reste visible et se
          remplit à mesure que la semaine avance (voir l'histoire de ce choix
          dans le journal de CLAUDE.md). */}
      <div className="day-band-freeze">
        {offre.full ? (
          <span className="freeze-full" title={`Réserve pleine : ${MAX_FREEZES} gels`}>
            ❄ Réserve pleine
          </span>
        ) : (
          <button
            className={`btn btn-sm buy-freeze${offre.affordable ? '' : ' is-short'}`}
            onClick={onBuyFreeze}
            disabled={!offre.affordable}
            style={{ '--freeze-fill': `${freezeFill(offre)}%` } as CSSProperties}
            title={
              offre.affordable
                ? `Il te reste ${offre.balance} PP cette semaine`
                : `Encore ${offre.cost - offre.balance} PP cette semaine pour un gel`
            }
          >
            ❄ Un gel · {offre.cost} PP
            <span className="buy-freeze-balance">
              {offre.affordable ? `sur ${offre.balance}` : `${offre.balance}/${offre.cost}`}
            </span>
          </button>
        )}
      </div>

      <p className="day-band-line" role={atRisk ? 'status' : undefined}>
        {atRisk ? (
          <>
            <strong>Streak de {streak.current} jour{streak.current > 1 ? 's' : ''} en jeu</strong> — fais une action
            avant minuit pour le prolonger
            {streak.freezes > 0 ? ` (sinon un gel ❄ sur ${streak.freezes} sera consommé).` : '.'}
          </>
        ) : streak.current === 0 ? (
          'Fais une action pour lancer ton streak.'
        ) : milestone ? (
          <>
            Prochain cap : <strong>{milestone.target} jours</strong>, dans {milestone.inDays} jour
            {milestone.inDays > 1 ? 's' : ''}
            {streak.best > streak.current ? ` · record ${streak.best} jours` : ''}
          </>
        ) : (
          `Plus d'un an d'affilée. Record : ${streak.best} jours.`
        )}
      </p>
    </section>
  );
}
