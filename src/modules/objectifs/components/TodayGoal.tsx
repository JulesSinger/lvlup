import type { ReactNode } from 'react';
import { isCountable } from '../lib/counters';
import { goalState, goalStreak } from '../lib/heatmap';
import { goalProgress, ppForRank } from '../lib/progress';
import { getRank } from '../lib/ranks';
import { brokeYesterday } from '../lib/today';
import type { Action, Checkin, Goal, Tier } from '../lib/types';
import { RankBadge } from './RankBadge';
import { TierMeter } from './TierMeter';

/**
 * La carte d'un objectif sur l'accueil (07/10/2026, demande de Jules).
 *
 * Avant, chaque objectif apparaissait deux fois : ses actions dans
 * « Aujourd'hui », son prochain palier bien plus bas dans « Ce que ça
 * construit », trié par rang. Le lien « je coche → mon palier avance » ne se
 * voyait jamais d'un coup d'œil. La carte les réunit : le palier visé, puis ce
 * qu'on coche aujourd'hui pour s'en approcher (`children`, les pastilles, dont
 * l'état reste tenu par le hub).
 *
 * Un objectif dont tout est coché ce jour-là se replie en une ligne : ce qui
 * reste à faire remonte, sans que l'ordre choisi sur la page Objectifs change.
 */
export function TodayGoal({
  goal,
  actions,
  checkins,
  today,
  onToday,
  collapsed,
  onExpand,
  onOpenGoal,
  onValidateTier,
  children,
}: {
  goal: Goal;
  actions: Action[];
  checkins: Checkin[];
  today: string;
  /** Le jour affiché est aujourd'hui : seuls ces jours-là parlent d'hier. */
  onToday: boolean;
  collapsed: boolean;
  onExpand: () => void;
  onOpenGoal: () => void;
  onValidateTier: (goal: Goal, tier: Tier) => void;
  children: ReactNode;
}) {
  const progress = goalProgress(goal);
  const tier = progress.next;
  const streak = goalStreak(goal, checkins, today);
  const gap = onToday && brokeYesterday(goal, checkins, today);
  const state = goalState(goal, checkins);
  const rank = tier ? getRank(tier.rank) : null;

  const head = (
    <div className="today-goal-head">
      <button type="button" className="today-goal-name" onClick={onOpenGoal} title="Ouvrir la fiche de l'objectif">
        <span aria-hidden="true">{goal.emoji}</span> {goal.title}
      </button>
      {streak > 0 && (
        <span className="today-goal-streak" title={`${streak} jour${streak > 1 ? 's' : ''} d'affilée sur cet objectif`}>
          🔥 {streak}
        </span>
      )}
      {gap && (
        <span className="today-goal-gap" title="Fait avant-hier, rien hier : une action aujourd'hui et la série repart">
          hier vide
        </span>
      )}
    </div>
  );

  if (collapsed) {
    return (
      <div className="today-goal collapsed">
        {head}
        <button type="button" className="today-goal-done" onClick={onExpand} aria-label={`Tout est fait pour ${goal.title} — afficher`}>
          ✓ fait
        </button>
      </div>
    );
  }

  return (
    <div className="today-goal">
      {head}

      {tier && rank ? (
        <div className="next-tier">
          <span className="next-body">
            <span className="next-title">{tier.title}</span>
            {/* Le lien entre le geste du jour et la marche qu'il fait monter.
                Rien ne s'affiche pour un jalon. */}
            <TierMeter tier={tier} actions={actions} checkins={checkins} compact />
          </span>
          <RankBadge rank={rank} />
          {/* Un palier comptable se valide tout seul en atteignant sa cible :
              proposer le bouton reviendrait à proposer de tricher. */}
          {!isCountable(tier) && (
            <button
              className="btn btn-sm next-validate"
              onClick={() => onValidateTier(goal, tier)}
              title={`Valider « ${tier.title} » (+${ppForRank(rank)} PP)`}
            >
              Valider · +{ppForRank(rank)} PP
            </button>
          )}
        </div>
      ) : (
        <div className="next-tier next-tier-none">
          {progress.total === 0 ? (
            <button type="button" className="today-goal-link" onClick={onOpenGoal}>
              Ajoute un premier palier →
            </button>
          ) : state === 'entretien' ? (
            <span className="goal-state maint">Entretien</span>
          ) : (
            <button type="button" className="today-goal-link" onClick={onOpenGoal}>
              Tous les paliers sont validés — ajoute une suite →
            </button>
          )}
        </div>
      )}

      {children}
    </div>
  );
}
