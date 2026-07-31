import { useState } from 'react';
import { formatDate, goalProgress } from '../lib/progress';
import { getRank, suggestRanks, type RankId } from '../lib/ranks';
import type { Goal, Tier, TierInput } from '../lib/types';
import { RankBadge, RankSelect } from './RankBadge';

interface Props {
  goal: Goal;
  /** Position dans la grille, sert au décalage de l'animation d'entrée */
  index?: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddTier: (input: TierInput) => Promise<void>;
  onUpdateTier: (
    tierId: string,
    patch: Partial<TierInput> & { completedAt?: string | null },
  ) => Promise<void>;
  onDeleteTier: (tierId: string) => Promise<void>;
  onMoveTier: (tierId: string, direction: -1 | 1) => Promise<void>;
}

export function GoalCard({
  goal,
  index = 0,
  expanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onAddTier,
  onUpdateTier,
  onDeleteTier,
  onMoveTier,
}: Props) {
  const progress = goalProgress(goal);
  const barColor = progress.rank
    ? `linear-gradient(90deg, ${progress.rank.color}, ${progress.rank.color2})`
    : 'linear-gradient(90deg, #3a4456, #4a5570)';

  return (
    <article
      className={`goal${progress.complete ? ' complete' : ''}`}
      style={{ ['--i' as string]: index }}
    >
      <div
        className="goal-head"
        onClick={onToggleExpand}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggleExpand();
          }
        }}
      >
        <span className={`chevron${expanded ? ' open' : ''}`}>▶</span>
        <span className="goal-emoji">{goal.emoji}</span>

        <div className="goal-main">
          <div className="goal-title-row">
            <h3 className="goal-title">{goal.title}</h3>
            <RankBadge rank={progress.rank} />
            {progress.complete && (
              <span style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600 }}>
                Objectif accompli
              </span>
            )}
          </div>
          {goal.description && <p className="goal-desc">{goal.description}</p>}

          <div className="goal-progress-row">
            <div className="bar">
              <span style={{ width: `${progress.percent}%`, background: barColor }} />
            </div>
            <span className="goal-count">
              {progress.done}/{progress.total} paliers
            </span>
          </div>
        </div>

        <div className="goal-actions" onClick={(e) => e.stopPropagation()}>
          <button className="btn btn-ghost btn-sm" onClick={onEdit} title="Modifier">
            ✎
          </button>
          <button className="btn btn-ghost btn-sm btn-danger" onClick={onDelete} title="Supprimer">
            🗑
          </button>
        </div>
      </div>

      {expanded && (
        <Ladder
          goal={goal}
          nextTierId={progress.next?.id ?? null}
          onAddTier={onAddTier}
          onUpdateTier={onUpdateTier}
          onDeleteTier={onDeleteTier}
          onMoveTier={onMoveTier}
        />
      )}
    </article>
  );
}

function Ladder({
  goal,
  nextTierId,
  onAddTier,
  onUpdateTier,
  onDeleteTier,
  onMoveTier,
}: {
  goal: Goal;
  nextTierId: string | null;
} & Pick<Props, 'onAddTier' | 'onUpdateTier' | 'onDeleteTier' | 'onMoveTier'>) {
  const [newTitle, setNewTitle] = useState('');
  const [newRank, setNewRank] = useState<RankId>(
    () => suggestRanks(goal.tiers.length + 1)[goal.tiers.length] ?? 'or',
  );

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    await onAddTier({ title, rank: newRank });
    setNewTitle('');
  }

  return (
    <div className="ladder">
      {goal.tiers.length === 0 && (
        <p className="ladder-empty">
          Aucun palier pour l'instant. Ajoute la première étape ci-dessous.
        </p>
      )}

      {goal.tiers.map((tier, index) => (
        <TierRow
          key={tier.id}
          tier={tier}
          isNext={tier.id === nextTierId}
          isFirst={index === 0}
          isLast={index === goal.tiers.length - 1}
          onUpdate={(patch) => onUpdateTier(tier.id, patch)}
          onDelete={() => onDeleteTier(tier.id)}
          onMove={(direction) => onMoveTier(tier.id, direction)}
        />
      ))}

      <form className="ladder-add" onSubmit={add}>
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Nouveau palier…"
          aria-label="Titre du nouveau palier"
        />
        <RankSelect value={newRank} onChange={setNewRank} />
        <button type="submit" className="btn btn-sm" disabled={!newTitle.trim()}>
          Ajouter
        </button>
      </form>
    </div>
  );
}

function TierRow({
  tier,
  isNext,
  isFirst,
  isLast,
  onUpdate,
  onDelete,
  onMove,
}: {
  tier: Tier;
  isNext: boolean;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (patch: Partial<TierInput> & { completedAt?: string | null }) => Promise<void>;
  onDelete: () => Promise<void>;
  onMove: (direction: -1 | 1) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [rankOpen, setRankOpen] = useState(false);
  const [draft, setDraft] = useState(tier.title);
  const rank = getRank(tier.rank);
  const done = Boolean(tier.completedAt);

  async function commit() {
    const title = draft.trim();
    setEditing(false);
    if (title && title !== tier.title) await onUpdate({ title });
    else setDraft(tier.title);
  }

  return (
    <div className={`tier${done ? ' done' : ''}`}>
      <button
        className={`tier-check${done ? ' done' : ''}`}
        onClick={() => onUpdate({ completedAt: done ? null : new Date().toISOString() })}
        title={done ? 'Annuler la validation' : 'Valider ce palier'}
        aria-pressed={done}
      >
        ✓
      </button>

      <div className="tier-body">
        {editing ? (
          <input
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              if (e.key === 'Escape') {
                setDraft(tier.title);
                setEditing(false);
              }
            }}
          />
        ) : (
          <>
            <div className="tier-title" onDoubleClick={() => setEditing(true)}>
              {tier.title}
            </div>
            {done && tier.completedAt && (
              <div className="tier-date">Validé le {formatDate(tier.completedAt)}</div>
            )}
            {!done && isNext && <div className="tier-next">Prochain palier</div>}
          </>
        )}
      </div>

      <span style={{ flexShrink: 0 }}>
        {rankOpen ? (
          <RankSelect
            value={tier.rank}
            onChange={(next) => {
              setRankOpen(false);
              void onUpdate({ rank: next });
            }}
          />
        ) : (
          <button
            className="btn btn-ghost btn-sm"
            style={{ padding: 0 }}
            onClick={() => setRankOpen(true)}
            title="Changer le rang de ce palier"
          >
            <RankBadge rank={rank} />
          </button>
        )}
      </span>

      <div className="tier-tools">
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setEditing(true)}
          title="Renommer"
          aria-label={`Renommer ${tier.title}`}
        >
          ✎
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => onMove(-1)}
          disabled={isFirst}
          title="Monter"
          aria-label={`Monter ${tier.title}`}
        >
          ↑
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => onMove(1)}
          disabled={isLast}
          title="Descendre"
          aria-label={`Descendre ${tier.title}`}
        >
          ↓
        </button>
        <button
          className="btn btn-ghost btn-sm btn-danger"
          onClick={onDelete}
          title="Supprimer"
          aria-label={`Supprimer ${tier.title}`}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
