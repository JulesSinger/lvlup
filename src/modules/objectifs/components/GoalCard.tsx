import { useState } from 'react';
import { formatAmount, tierProgress } from '../lib/counters';
import { goalState } from '../lib/heatmap';
import { formatDate, goalProgress } from '../lib/progress';
import { getRank, movableTier, suggestRanks, type RankId } from '../lib/ranks';
import type { Action, Checkin, Goal, Tier, TierInput } from '../lib/types';
import { Heatmap } from './Heatmap';
import { MeasureChart } from './MeasureChart';
import { RankBadge, RankSelect } from './RankBadge';
import { TierCounter } from './TierCounter';
import { TierMeter } from './TierMeter';

interface Props {
  goal: Goal;
  /** Position dans la grille, sert au décalage de l'animation d'entrée */
  index?: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onAddTier: (input: TierInput) => Promise<void>;
  onUpdateTier: (
    tierId: string,
    patch: Partial<TierInput> & { completedAt?: string | null },
  ) => Promise<void>;
  onDeleteTier: (tierId: string) => Promise<void>;
  onMoveTier: (tierId: string, direction: -1 | 1) => Promise<void>;
  /** Actions et réalisations : de quoi calculer l'avancée des paliers comptables */
  actions: Action[];
  checkins: Checkin[];
  /** Bloc d'édition des actions du quotidien, injecté par App */
  actionEditor?: React.ReactNode;
}

export function GoalCard({
  goal,
  index = 0,
  expanded,
  onToggleExpand,
  onEdit,
  onArchive,
  onDelete,
  onAddTier,
  onUpdateTier,
  onDeleteTier,
  onMoveTier,
  actions,
  checkins,
  actionEditor,
}: Props) {
  const progress = goalProgress(goal);
  // « Accompli » convient à un marathon couru. Pas à « arrêter de me ronger
  // les ongles » au 365ᵉ jour : on n'a pas fini, on entretient.
  const state = goalState(goal, checkins);
  const barColor = progress.rank
    ? `linear-gradient(90deg, ${progress.rank.color}, ${progress.rank.color2})`
    : 'linear-gradient(90deg, #3a4456, #4a5570)';

  return (
    <article
      className={`goal${progress.complete ? ' complete' : ''}${expanded ? ' expanded' : ''}`}
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
            {state === 'entretien' && (
              <span className="goal-state maint" title="Tous les paliers sont validés, et tu continues — une habitude ne se termine pas.">
                Entretien
              </span>
            )}
            {state === 'accompli' && <span className="goal-state done">Objectif accompli</span>}
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

          {!expanded && progress.next && (
            <div className="goal-next-line">
              Prochain : <strong>{progress.next.title}</strong>
              {/* Sans ce chiffre, une carte repliée annonce une cible sans
                  jamais dire où on en est — le compteur n'apparaissait qu'en
                  dépliant, ou depuis le hub. */}
              {(() => {
                const p = tierProgress(progress.next, actions, checkins);
                if (!p) return null;
                return (
                  <span className="goal-next-count">
                    {' · '}
                    <b>{formatAmount(p.current)}</b> / {formatAmount(p.target, progress.next.unit)}
                  </span>
                );
              })()}
            </div>
          )}
        </div>

        <div className="goal-actions" onClick={(e) => e.stopPropagation()}>
          <button className="btn btn-ghost btn-sm" onClick={onEdit} title="Modifier">
            ✎
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={onArchive}
            title="Archiver (réversible : l'objectif sort du rang et des PP)"
          >
            📦
          </button>
          <button className="btn btn-ghost btn-sm btn-danger" onClick={onDelete} title="Supprimer">
            🗑
          </button>
        </div>
      </div>

      {/* La mémoire de l'objectif : douze semaines de jours. C'est ce qui
          manquait pour qu'une habitude ait un visage — et un objectif
          classique y gagne la lecture de son assiduité.

          Hors de l'en-tête, et non dans la colonne du titre : là-bas elle
          partageait la largeur avec les boutons d'action et se faisait
          couper sur téléphone, masquant la colonne d'aujourd'hui.

          `rank` retombe sur le palier visé tant qu'aucun n'est validé : la
          couleur vers laquelle on travaille, plutôt qu'un gris muet. */}
      <Heatmap
        goal={goal}
        actions={actions}
        checkins={checkins}
        rank={progress.rank ?? (progress.next ? getRank(progress.next.rank) : null)}
      />

      {expanded && (
        <>
          <Ladder
            goal={goal}
            nextTierId={progress.next?.id ?? null}
            onAddTier={onAddTier}
            onUpdateTier={onUpdateTier}
            onDeleteTier={onDeleteTier}
            onMoveTier={onMoveTier}
            actions={actions}
            checkins={checkins}
          />
          {actionEditor}
        </>
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
  actions,
  checkins,
}: {
  goal: Goal;
  nextTierId: string | null;
  actions: Action[];
  checkins: Checkin[];
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
          canMoveUp={movableTier(goal.tiers, index, -1)}
          canMoveDown={movableTier(goal.tiers, index, 1)}
          onUpdate={(patch) => onUpdateTier(tier.id, patch)}
          onDelete={() => onDeleteTier(tier.id)}
          onMove={(direction) => onMoveTier(tier.id, direction)}
          actions={actions}
          checkins={checkins}
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
  canMoveUp,
  canMoveDown,
  onUpdate,
  onDelete,
  onMove,
  actions,
  checkins,
}: {
  tier: Tier;
  isNext: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onUpdate: (patch: Partial<TierInput> & { completedAt?: string | null }) => Promise<void>;
  onDelete: () => Promise<void>;
  onMove: (direction: -1 | 1) => Promise<void>;
  actions: Action[];
  checkins: Checkin[];
}) {
  const [editing, setEditing] = useState(false);
  const [rankOpen, setRankOpen] = useState(false);
  const [counting, setCounting] = useState(false);
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
            <TierMeter tier={tier} actions={actions} checkins={checkins} />
            {/* La pente, pas le pourcentage : sur une mesure, deux kilos
                perdus puis repris ne se lisent que sur une courbe. */}
            {tier.kind === 'mesure' && (
              <MeasureChart tier={tier} actions={actions} checkins={checkins} />
            )}
            {counting && <TierCounter tier={tier} onUpdate={onUpdate} />}
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
          className={`btn btn-ghost btn-sm${counting ? ' active' : ''}`}
          onClick={() => setCounting((v) => !v)}
          title="Façon de compter ce palier"
          aria-label={`Façon de compter ${tier.title}`}
          aria-expanded={counting}
        >
          #
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => setEditing(true)}
          title="Renommer"
          aria-label={`Renommer ${tier.title}`}
        >
          ✎
        </button>
        {/* Déplacer échange aussi les rangs (les rangs appartiennent aux
            barreaux). Un palier validé ne peut donc pas participer : son rang
            est un trophée daté, on ne le réécrit pas. */}
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => onMove(-1)}
          disabled={!canMoveUp}
          title={canMoveUp ? 'Monter' : 'Impossible : un palier validé garde sa place et son rang'}
          aria-label={`Monter ${tier.title}`}
        >
          ↑
        </button>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => onMove(1)}
          disabled={!canMoveDown}
          title={
            canMoveDown ? 'Descendre' : 'Impossible : un palier validé garde sa place et son rang'
          }
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
