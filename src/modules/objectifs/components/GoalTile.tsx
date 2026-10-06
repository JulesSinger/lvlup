import type { KeyboardEvent, PointerEvent } from 'react';
import { formatAmount, tierProgress } from '../lib/counters';
import { goalStreak, goalState } from '../lib/heatmap';
import { goalProgress } from '../lib/progress';
import { getRank } from '../lib/ranks';
import { isUntouched, weekStrip } from '../lib/tile';
import type { Action, Checkin, Goal } from '../lib/types';
import { RankBadge } from './RankBadge';

/**
 * La tuile d'un objectif sur la page Objectifs (06/10/2026, demande de Jules).
 *
 * Une seule structure, quatre lignes de hauteur fixe, quel que soit l'objectif :
 * titre, progression et rang, prochain palier, bande des douze semaines avec
 * la série (ou « nouveau », « Entretien », « Accompli »). C'est ce qui
 * rend toutes les tuiles égales — un objectif neuf garde la place de sa bande,
 * en pointillés, au lieu de faire une tuile plus courte qui laissait un trou.
 * Tout le reste (grande grille, paliers, actions, courbes) est dans la fiche,
 * qui s'ouvre à la place des tuiles : la grille ne se recompose plus jamais.
 */
export interface TileHandle {
  dragging: boolean;
  onPointerDown: (e: PointerEvent<HTMLButtonElement>) => void;
  onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
}

export function GoalTile({
  goal,
  index,
  actions,
  checkins,
  today,
  onOpen,
  handle,
}: {
  goal: Goal;
  index: number;
  actions: Action[];
  checkins: Checkin[];
  today: string;
  onOpen: () => void;
  handle: TileHandle;
}) {
  const progress = goalProgress(goal);
  const state = goalState(goal, checkins);
  const untouched = isUntouched(goal, checkins);
  const strip = weekStrip(goal, checkins, today);
  const streak = goalStreak(goal, checkins, today);
  const activeDays = strip.reduce((sum, w) => sum + w.days, 0);
  const color = (progress.rank ?? (progress.next ? getRank(progress.next.rank) : null))?.color2 ?? 'var(--accent-deep)';
  const barColor = progress.rank
    ? `linear-gradient(90deg, ${progress.rank.color}, ${progress.rank.color2})`
    : 'linear-gradient(90deg, var(--border-strong), var(--gray))';
  const next = progress.next;
  const nextCount = next ? tierProgress(next, actions, checkins) : null;

  return (
    <article
      className={`goal-tile${progress.complete ? ' complete' : ''}${handle.dragging ? ' dragging' : ''}`}
      data-goal-id={goal.id}
      style={{ ['--i' as string]: index, ['--tile-color' as string]: color }}
    >
      <button
        type="button"
        className="goal-tile-handle"
        aria-label={`Déplacer ${goal.title}`}
        title="Glisser pour déplacer (ou flèches du clavier)"
        onPointerDown={handle.onPointerDown}
        onKeyDown={handle.onKeyDown}
      >
        ⠿
      </button>

      <button type="button" className="goal-tile-body" onClick={onOpen} aria-label={`Ouvrir ${goal.title}`}>
        <span className="goal-tile-head">
          <span className="goal-tile-emoji" aria-hidden="true">
            {goal.emoji}
          </span>
          <span className="goal-tile-title" title={goal.title}>
            {goal.title}
          </span>
        </span>

        <span className="goal-tile-progress">
          <span className="bar">
            <span style={{ width: `${progress.percent}%`, background: barColor }} />
          </span>
          <span className="goal-count">
            {progress.done}/{progress.total}
          </span>
          <RankBadge rank={progress.rank} />
        </span>

        <span className="goal-tile-next">
          {next ? (
            <>
              <span className="goal-tile-next-label">
                Prochain : <strong>{next.title}</strong>
              </span>
              {nextCount && (
                <span className="goal-tile-next-count">
                  <b>{formatAmount(nextCount.current)}</b> / {formatAmount(nextCount.target, next.unit)}
                </span>
              )}
            </>
          ) : progress.total === 0 ? (
            <span className="goal-tile-next-label goal-tile-hint">Ajoute un premier palier →</span>
          ) : (
            <span className="goal-tile-next-label">Tous les paliers sont validés</span>
          )}
        </span>

        <span className="goal-tile-activity">
          <span
            className="goal-tile-strip"
            role="img"
            aria-label={`${activeDays} jour${activeDays > 1 ? 's' : ''} d'activité sur les 12 dernières semaines`}
          >
            {strip.map((w) => (
              <span
                key={w.monday}
                className={`goal-tile-week${w.inRange ? '' : ' goal-tile-week-ghost'}${w.days === 0 ? ' goal-tile-week-empty' : ''}`}
                style={w.days > 0 ? { height: `${20 + (w.days / 7) * 80}%` } : undefined}
              />
            ))}
          </span>
          <span className="goal-tile-streak">
            {untouched ? (
              <span className="goal-tile-new">nouveau</span>
            ) : state === 'entretien' ? (
              <span className="goal-state maint">Entretien</span>
            ) : state === 'accompli' ? (
              <span className="goal-state done">Accompli</span>
            ) : streak > 0 ? (
              <>
                🔥 <b>{streak}</b> j
              </>
            ) : (
              `${activeDays} j en 12 sem.`
            )}
          </span>
        </span>
      </button>
    </article>
  );
}
