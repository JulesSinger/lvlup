import { useState } from 'react';
import type { Action, ActionInput } from '../lib/types';
import { ACTION_PP_CHOICES } from '../lib/types';

/**
 * Édition des actions d'un objectif, dans la carte dépliée.
 *
 * Le pari : renommer « Un vrai effort » en « Sortie course » coûte
 * infiniment moins cher que d'inventer une liste devant un formulaire vide.
 * On ne demande donc jamais rien à la création — on donne deux actions
 * génériques et on rend l'édition triviale.
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

  async function commit() {
    const title = draft.trim();
    setEditing(false);
    if (title && title !== action.title) await onUpdate({ title });
    else setDraft(action.title);
  }

  return (
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
  );
}
