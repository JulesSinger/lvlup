import { formatDate, history, relativeDate } from '../lib/progress';
import { getRank } from '../lib/ranks';
import type { Goal } from '../lib/types';
import { RankBadge } from './RankBadge';

export function Timeline({ goals }: { goals: Goal[] }) {
  const entries = history(goals);

  if (entries.length === 0) {
    return (
      <div className="empty">
        <h3>Aucun palier validé pour l'instant</h3>
        <p>
          Chaque palier que tu coches vient s'inscrire ici avec sa date. C'est ta frise de
          progression : de quoi mesurer le chemin parcouru sur des mois.
        </p>
      </div>
    );
  }

  return (
    <div className="timeline">
      {entries.map(({ tier, goal, date }) => {
        const rank = getRank(tier.rank);
        return (
          <div className="entry" key={tier.id} style={{ ['--dot' as string]: rank.color2 }}>
            <div className="entry-date">
              {formatDate(date)} · {relativeDate(date)}
            </div>
            <div className="entry-title">{tier.title}</div>
            <div className="entry-goal">
              {goal.emoji} {goal.title} <RankBadge rank={rank} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
