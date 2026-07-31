import { goalProgress, history, ppForRank, relativeDate } from '../lib/progress';
import { getRank } from '../lib/ranks';
import type { Goal, Tier } from '../lib/types';
import { ProfileHeader } from './ProfileHeader';
import { RankBadge } from './RankBadge';

/**
 * Écran d'accueil — le « hub » : ton rang en héros, les prochains paliers à
 * aller chercher, et l'activité récente. C'est ici que le check-in quotidien
 * et le streak viendront se loger au prochain sprint.
 */
export function Hub({
  goals,
  onValidateTier,
  onGoToGoals,
}: {
  goals: Goal[];
  onValidateTier: (goal: Goal, tier: Tier) => void;
  onGoToGoals: () => void;
}) {
  const active = goals.filter((g) => !g.archived);

  // Le prochain palier de chaque objectif encore en cours, trié du rang le
  // plus accessible au plus ambitieux : commencer petit, finir grand.
  const nextTiers = active
    .map((goal) => ({ goal, progress: goalProgress(goal) }))
    .filter(({ progress }) => progress.next)
    .map(({ goal, progress }) => ({ goal, tier: progress.next as Tier }))
    .sort((a, b) => getRank(a.tier.rank).value - getRank(b.tier.rank).value);

  const recent = history(goals).slice(0, 5);

  return (
    <div className="hub">
      <ProfileHeader goals={goals} />

      <div className="hub-columns">
        <section className="hub-section">
          <div className="hub-section-head">
            <h2>À aller chercher</h2>
            <span className="hub-section-hint">le prochain palier de chaque objectif</span>
          </div>
          {nextTiers.length === 0 ? (
            <div className="hub-empty">
              {active.length === 0 ? (
                <>
                  <p>Aucun objectif pour l'instant — c'est le moment d'ouvrir la saison.</p>
                  <button className="btn btn-primary btn-sm" onClick={onGoToGoals}>
                    Créer mon premier objectif
                  </button>
                </>
              ) : (
                <p>Tous tes paliers sont validés. Ajoute une suite à tes objectifs !</p>
              )}
            </div>
          ) : (
            <ul className="next-list">
              {nextTiers.map(({ goal, tier }) => {
                const rank = getRank(tier.rank);
                return (
                  <li key={tier.id} className="next-tier">
                    <span className="next-emoji" aria-hidden="true">
                      {goal.emoji}
                    </span>
                    <span className="next-body">
                      <span className="next-title">{tier.title}</span>
                      <span className="next-goal">{goal.title}</span>
                    </span>
                    <RankBadge rank={rank} />
                    <button
                      className="btn btn-sm next-validate"
                      onClick={() => onValidateTier(goal, tier)}
                      title={`Valider « ${tier.title} » (+${ppForRank(rank)} PP)`}
                    >
                      Valider · +{ppForRank(rank)} PP
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="hub-section">
          <div className="hub-section-head">
            <h2>Activité récente</h2>
          </div>
          {recent.length === 0 ? (
            <div className="hub-empty">
              <p>Tes validations apparaîtront ici, avec leur date.</p>
            </div>
          ) : (
            <ul className="activity-list">
              {recent.map(({ tier, goal, date }) => {
                const rank = getRank(tier.rank);
                return (
                  <li key={tier.id} className="activity-item">
                    <span
                      className="activity-dot"
                      style={{ background: `linear-gradient(150deg, ${rank.color2}, ${rank.color})` }}
                      aria-hidden="true"
                    />
                    <span className="activity-body">
                      <span className="activity-title">{tier.title}</span>
                      <span className="activity-meta">
                        {goal.emoji} {goal.title} · {relativeDate(date)}
                      </span>
                    </span>
                    <span className="activity-pp">+{ppForRank(rank)} PP</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
