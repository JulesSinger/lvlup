import { useState } from 'react';
import {
  MEASURE_PP,
  actionNature,
  natureFields,
  parseAmount,
  type ActionNature,
} from '../lib/quantities';
import type { Action, ActionInput } from '../lib/types';
import { ACTION_PP_CHOICES } from '../lib/types';

/**
 * Édition des actions d'un objectif, dans la carte dépliée.
 *
 * Le pari : renommer « Un vrai effort » en « Sortie course » coûte
 * infiniment moins cher que d'inventer une liste devant un formulaire vide.
 * On ne demande donc jamais rien à la création — on donne deux actions
 * génériques et on rend l'édition triviale.
 *
 * Même prudence pour les quantités : le formulaire d'ajout reste un titre et
 * des points. L'unité et la valeur habituelle se règlent après coup, derrière
 * un bouton, pour les rares actions qui en ont besoin.
 */
export function ActionEditor({
  actions,
  onCreate,
  onUpdate,
  onDelete,
}: {
  actions: Action[];
  onCreate: (input: ActionInput) => Promise<void>;
  onUpdate: (id: string, patch: Partial<ActionInput>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [newTitle, setNewTitle] = useState('');
  const [newPP, setNewPP] = useState(10);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    await onCreate({ title, pp: newPP });
    setNewTitle('');
  }

  return (
    <div className="action-editor">
      <div className="action-editor-head">
        <h4>Actions du quotidien</h4>
        <span>ce que tu peux faire au jour le jour pour cet objectif</span>
      </div>

      {actions.length === 0 && (
        <p className="action-empty">Aucune action. Ajoute-en une ci-dessous.</p>
      )}

      {actions.map((action) => (
        <ActionRow
          key={action.id}
          action={action}
          onUpdate={(patch) => onUpdate(action.id, patch)}
          onDelete={() => onDelete(action.id)}
        />
      ))}

      <form className="action-add" onSubmit={add}>
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Nouvelle action…"
          maxLength={80}
          aria-label="Titre de la nouvelle action"
        />
        <select
          value={newPP}
          onChange={(e) => setNewPP(Number(e.target.value))}
          aria-label="PP de la nouvelle action"
          style={{ width: 'auto', minWidth: 96 }}
        >
          {ACTION_PP_CHOICES.map((pp) => (
            <option key={pp} value={pp}>
              {pp} PP
            </option>
          ))}
        </select>
        <button type="submit" className="btn btn-sm" disabled={!newTitle.trim()}>
          Ajouter l'action
        </button>
      </form>
    </div>
  );
}

const NATURE_LABELS: { id: ActionNature; label: string; hint: string }[] = [
  { id: 'simple', label: 'Simple', hint: 'on la coche, c’est tout' },
  {
    id: 'quantifiee',
    label: 'Quantifiée',
    hint: 'un appui enregistre la valeur habituelle — tu ajustes si la séance est différente',
  },
  {
    id: 'releve',
    label: 'Relevé',
    hint: `une mesure qu’on note (poids, tour de taille) : la saisie est le geste, et elle rapporte ${MEASURE_PP} PP`,
  },
];

function ActionRow({
  action,
  onUpdate,
  onDelete,
}: {
  action: Action;
  onUpdate: (patch: Partial<ActionInput>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(action.title);
  const [open, setOpen] = useState(false);
  const nature = actionNature(action);

  async function commit() {
    const title = draft.trim();
    setEditing(false);
    if (title && title !== action.title) await onUpdate({ title });
    else setDraft(action.title);
  }

  const summary =
    nature === 'quantifiee'
      ? `${action.defaultValue ?? '?'} ${action.unit}`
      : nature === 'releve'
        ? `relevé en ${action.unit}`
        : '';

  return (
    <div className="action-row-wrap">
      <div className="action-row">
        <div className="action-row-body">
          {editing ? (
            <input
              value={draft}
              autoFocus
              maxLength={80}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') {
                  setDraft(action.title);
                  setEditing(false);
                }
              }}
            />
          ) : (
            <span className="action-row-title" onDoubleClick={() => setEditing(true)}>
              {action.title}
              {summary && <span className="action-row-unit">{summary}</span>}
            </span>
          )}
        </div>

        <select
          value={action.pp}
          onChange={(e) => void onUpdate({ pp: Number(e.target.value) })}
          aria-label={`PP de ${action.title}`}
          style={{ width: 'auto', minWidth: 90 }}
        >
          {ACTION_PP_CHOICES.map((pp) => (
            <option key={pp} value={pp}>
              {pp} PP
            </option>
          ))}
        </select>

        <div className="tier-tools">
          <button
            className={`btn btn-ghost btn-sm${open ? ' active' : ''}`}
            onClick={() => setOpen((v) => !v)}
            title="Unité et valeur habituelle"
            aria-label={`Quantifier ${action.title}`}
            aria-expanded={open}
          >
            #
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setEditing(true)}
            title="Renommer"
            aria-label={`Renommer ${action.title}`}
          >
            ✎
          </button>
          <button
            className="btn btn-ghost btn-sm btn-danger"
            onClick={onDelete}
            title="Supprimer (l'historique est conservé)"
            aria-label={`Supprimer ${action.title}`}
          >
            ✕
          </button>
        </div>
      </div>

      {open && (
        <div className="action-quant">
          <div className="action-quant-natures" role="group" aria-label="Nature de l'action">
            {NATURE_LABELS.map((n) => (
              <button
                key={n.id}
                className={`btn btn-sm${nature === n.id ? ' btn-primary' : ''}`}
                aria-pressed={nature === n.id}
                onClick={() => {
                  if (nature !== n.id) void onUpdate(natureFields(n.id, action));
                }}
              >
                {n.label}
              </button>
            ))}
          </div>

          <p className="action-quant-hint">
            {NATURE_LABELS.find((n) => n.id === nature)?.hint}
          </p>

          {nature !== 'simple' && (
            <div className="action-quant-fields">
              <label>
                <span>Unité</span>
                <input
                  defaultValue={action.unit}
                  maxLength={12}
                  placeholder={nature === 'releve' ? 'kg' : 'km'}
                  onBlur={(e) => {
                    const unit = e.target.value.trim();
                    if (unit && unit !== action.unit) void onUpdate({ unit });
                    else e.target.value = action.unit;
                  }}
                  aria-label={`Unité de ${action.title}`}
                />
              </label>

              {nature === 'quantifiee' && (
                <label>
                  <span>Valeur habituelle</span>
                  <input
                    inputMode="decimal"
                    defaultValue={action.defaultValue ?? ''}
                    placeholder="8"
                    onBlur={(e) => {
                      const value = parseAmount(e.target.value);
                      if (value !== null && value !== action.defaultValue) {
                        void onUpdate({ defaultValue: value });
                      } else {
                        e.target.value = String(action.defaultValue ?? '');
                      }
                    }}
                    aria-label={`Valeur habituelle de ${action.title}`}
                  />
                </label>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
