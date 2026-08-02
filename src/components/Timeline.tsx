import { formatDate, history, relativeDate } from '../lib/progress';
import { getRank } from '../lib/ranks';
import type { Checkin, Goal } from '../lib/types';
import { PPChart } from './PPChart';
import { RankBadge } from './RankBadge';

interface JournalEntry {
  key: string;
  date: Date;
  kind: 'tier' | 'checkin';
  title: string;
  goalLabel: string;
  note?: string;
  rankColor?: string;
  rankId?: Goal['tiers'][number]['rank'];
}

/**
 * Historique = courbe de progression + journal de bord : paliers validés ET
 * check-ins (avec leur note éventuelle), du plus récent au plus ancien.
 */
export function Timeline({ goals, checkins }: { goals: Goal[]; checkins: Checkin[] }) {
  const goalById = new Map(goals.map((g) => [g.id, g]));

  const entries: JournalEntry[] = [
    ...history(goals).map(({ tier, goal, date }) => ({
      key: `tier-${tier.id}`,
      date,
      kind: 'tier' as const,
      title: tier.title,
      goalLabel: `${goal.emoji} ${goal.title}`,
      rankColor: getRank(tier.rank).color2,
      rankId: tier.rank,
    })),
    ...checkins
      .map((c) => {
        const goal = goalById.get(c.goalId);
        if (!goal) return null;
        return {
          key: `checkin-${c.id}`,
          date: new Date(`${c.day}T12:00:00`),
          kind: 'checkin' as const,
          title: c.note ? c.note : 'Check-in',
          goalLabel: `${goal.emoji} ${goal.title}`,
          note: c.note,
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  if (entries.length === 0) {
    return (
      <div className="empty">
        <h3>Aucune activité pour l'instant</h3>
        <p>
          Chaque palier validé et chaque check-in vient s'inscrire ici avec sa date. C'est ton
          journal de bord : de quoi mesurer le chemin parcouru sur des mois.
        </p>
      </div>
    );
  }

  return (
    <>
      <PPChart goals={goals} checkins={checkins} />

      <div className="timeline">
        {entries.map((entry) => (
          <div
            className={`entry${entry.kind === 'checkin' ? ' entry-checkin' : ''}`}
            key={entry.key}
            style={{ ['--dot' as string]: entry.rankColor ?? 'var(--border-strong)' }}
          >
            <div className="entry-date">
              {formatDate(entry.date)} · {relativeDate(entry.date)}
            </div>
            <div className="entry-title">{entry.title}</div>
            <div className="entry-goal">
              {entry.goalLabel}{' '}
              {entry.kind === 'tier' && entry.rankId ? (
                <RankBadge rank={getRank(entry.rankId)} />
              ) : (
                <span className="entry-kind">check-in</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
