import { useEffect, useRef, useState } from 'react';
import { profilePP, profileRank } from '../lib/progress';
import { rankByValue } from '../lib/ranks';
import { computeStreak, MAX_FREEZES } from '../lib/streak';
import type { Checkin, Goal } from '../lib/types';

/**
 * Anime un nombre de sa valeur précédente vers la nouvelle (easing doux).
 * Rend les gains de PP visibles : le compteur défile au lieu de sauter.
 */
function useCountUp(target: number, duration = 900): number {
  const [display, setDisplay] = useState(target);
  const previous = useRef(target);

  useEffect(() => {
    const from = previous.current;
    previous.current = target;
    if (from === target) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    function frame(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return display;
}

export function ProfileHeader({
  goals,
  checkins = [],
}: {
  goals: Goal[];
  checkins?: Checkin[];
}) {
  const profile = profileRank(goals);
  const rank = profile.rank;
  const active = goals.filter((g) => !g.archived);
  const tiersDone = active.reduce((n, g) => n + g.tiers.filter((t) => t.completedAt).length, 0);
  const tiersTotal = active.reduce((n, g) => n + g.tiers.length, 0);
  const pp = useCountUp(profilePP(goals, checkins));
  const streak = computeStreak(goals, checkins);

  const nextRank =
    rank && rank.value < 10 ? rankByValue(rank.value + 1) : rank ? null : rankByValue(1);

  const streakTitle = streak.activeToday
    ? `${streak.current} jour${streak.current > 1 ? 's' : ''} d'affilée — déjà validé aujourd'hui`
    : streak.atRisk
      ? `${streak.current} jour${streak.current > 1 ? 's' : ''} d'affilée — agis aujourd'hui pour continuer`
      : "Fais une action aujourd'hui pour lancer un streak";

  return (
    <section
      className="profile"
      style={{ ['--glow' as string]: rank ? `${rank.color}33` : 'transparent' }}
    >
      <div
        className="profile-crest"
        style={{
          background: rank
            ? `linear-gradient(150deg, ${rank.color2}, ${rank.color})`
            : 'linear-gradient(150deg, #39415a, #262e40)',
          color: rank ? rank.ink : 'var(--text-faint)',
        }}
      >
        {rank ? rank.label.charAt(0).toUpperCase() : '—'}
      </div>

      <div className="profile-body">
        <div className="profile-label">Rang du profil</div>
        <div className="profile-rank" style={{ color: rank ? rank.color2 : 'var(--text-dim)' }}>
          {rank ? rank.label : 'Non classé'}
        </div>
        <div className="profile-meta">
          {profile.rankedGoals === 0
            ? 'Crée un objectif et valide un palier pour décrocher ton premier rang.'
            : nextRank
              ? `${Math.round(profile.toNext * 100)} % du chemin vers ${nextRank.label} · moyenne de ${profile.rankedGoals} objectif${profile.rankedGoals > 1 ? 's' : ''}`
              : `Rang maximum atteint sur ${profile.rankedGoals} objectifs. Chapeau.`}
        </div>
        {nextRank && profile.rankedGoals > 0 && (
          <div className="profile-tonext" aria-hidden="true">
            <span
              style={{
                width: `${Math.round(profile.toNext * 100)}%`,
                background: rank
                  ? `linear-gradient(90deg, ${rank.color}, ${rank.color2})`
                  : 'var(--border-strong)',
              }}
            />
          </div>
        )}
      </div>

      <div className="profile-stats">
        <div title={streakTitle}>
          <div
            className={`stat-value stat-streak${streak.activeToday ? ' lit' : ''}${streak.atRisk ? ' risk' : ''}`}
          >
            <span aria-hidden="true">🔥</span> {streak.current}
          </div>
          <div className="stat-label">
            Streak
            {streak.freezes > 0 && (
              <span
                className="stat-freezes"
                title={`${streak.freezes}/${MAX_FREEZES} gel${streak.freezes > 1 ? 's' : ''} : un jour manqué consomme un gel au lieu de casser le streak`}
              >
                {' '}
                ❄×{streak.freezes}
              </span>
            )}
          </div>
        </div>
        <div>
          <div className="stat-value stat-pp">{pp.toLocaleString('fr-FR')}</div>
          <div className="stat-label">PP</div>
        </div>
        <div>
          <div className="stat-value">{active.length}</div>
          <div className="stat-label">Objectifs</div>
        </div>
        <div>
          <div className="stat-value">
            {tiersDone}
            <span style={{ color: 'var(--text-faint)', fontSize: 15 }}>/{tiersTotal}</span>
          </div>
          <div className="stat-label">Paliers</div>
        </div>
      </div>
    </section>
  );
}
