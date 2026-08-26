import { profileRank } from '../lib/progress';
import { rankByValue } from '../lib/ranks';
import { computeStreak, dayString, MAX_FREEZES } from '../lib/streak';
import type { Checkin, FreezePurchase, Goal } from '../lib/types';


export function ProfileHeader({
  goals,
  checkins = [],
  freezePurchases = [],
}: {
  goals: Goal[];
  checkins?: Checkin[];
  freezePurchases?: FreezePurchase[];
}) {
  const profile = profileRank(goals);
  const rank = profile.rank;
  const active = goals.filter((g) => !g.archived);
  const tiersDone = active.reduce((n, g) => n + g.tiers.filter((t) => t.completedAt).length, 0);
  const tiersTotal = active.reduce((n, g) => n + g.tiers.length, 0);
  /*
   * Pas de PP ici. Ce bandeau dit qui tu es — rang, streak, objectifs, paliers.
   * Les PP sont devenus une mesure de rythme, et le rythme a déjà sa carte
   * (« Cette semaine »), avec le comparatif à la semaine précédente que ce
   * bandeau n'a pas. Les afficher aux deux endroits, c'était le même nombre
   * deux fois sur le même écran.
   */
  const streak = computeStreak(goals, checkins, dayString(), freezePurchases);

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
