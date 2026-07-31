import { profileRank } from '../lib/progress';
import { rankByValue } from '../lib/ranks';
import type { Goal } from '../lib/types';

export function ProfileHeader({ goals }: { goals: Goal[] }) {
  const profile = profileRank(goals);
  const rank = profile.rank;
  const active = goals.filter((g) => !g.archived);
  const tiersDone = active.reduce((n, g) => n + g.tiers.filter((t) => t.completedAt).length, 0);
  const tiersTotal = active.reduce((n, g) => n + g.tiers.length, 0);

  const nextRank =
    rank && rank.value < 10 ? rankByValue(rank.value + 1) : rank ? null : rankByValue(1);

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
      </div>

      <div className="profile-stats">
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
