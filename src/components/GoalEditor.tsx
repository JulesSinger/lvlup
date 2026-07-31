import { useEffect, useState } from 'react';
import { suggestRanks, type RankId } from '../lib/ranks';
import type { Goal, GoalInput, TierInput } from '../lib/types';
import { RankSelect } from './RankBadge';

const EMOJIS = ['🎯', '🏃', '📚', '📵', '💪', '🎸', '🧘', '💰', '🍳', '🌱', '🧠', '✈️'];

interface Props {
  goal: Goal | null;
  onCancel: () => void;
  onSave: (input: GoalInput, tiers: TierInput[]) => Promise<void>;
}

interface DraftTier {
  key: number;
  title: string;
  rank: RankId;
}

let nextKey = 1;

function emptyDrafts(count: number): DraftTier[] {
  const ranks = suggestRanks(count);
  return ranks.map((rank) => ({ key: nextKey++, title: '', rank }));
}

export function GoalEditor({ goal, onCancel, onSave }: Props) {
  const isEdit = goal !== null;
  const [title, setTitle] = useState(goal?.title ?? '');
  const [description, setDescription] = useState(goal?.description ?? '');
  const [emoji, setEmoji] = useState(goal?.emoji ?? '🎯');
  const [drafts, setDrafts] = useState<DraftTier[]>(() => (isEdit ? [] : emptyDrafts(5)));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  function setDraft(key: number, patch: Partial<DraftTier>) {
    setDrafts((list) => list.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  function addDraft() {
    setDrafts((list) => {
      // On ne renumérote pas les rangs déjà choisis : le nouveau palier reprend
      // simplement la suggestion correspondant à sa position.
      const suggestion = suggestRanks(list.length + 1)[list.length];
      return [...list, { key: nextKey++, title: '', rank: suggestion }];
    });
  }

  function removeDraft(key: number) {
    setDrafts((list) => list.filter((d) => d.key !== key));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError('Donne un titre à ton objectif.');
      return;
    }
    const tiers: TierInput[] = drafts
      .map((d) => ({ title: d.title.trim(), rank: d.rank }))
      .filter((t) => t.title.length > 0);

    if (!isEdit && tiers.length === 0) {
      setError('Ajoute au moins un palier — c’est le cœur du suivi.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onSave({ title: cleanTitle, description: description.trim(), emoji }, tiers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <form className="modal" onSubmit={submit}>
        <div className="modal-head">
          <h2 className="modal-title">{isEdit ? "Modifier l'objectif" : 'Nouvel objectif'}</h2>
          <button type="button" className="btn btn-ghost" onClick={onCancel} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {error && <div className="notice error">{error}</div>}

          <div className="row">
            <div className="field compact">
              <label htmlFor="goal-emoji">Icône</label>
              <input
                id="goal-emoji"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
                style={{ textAlign: 'center', fontSize: 19 }}
              />
            </div>
            <div className="field">
              <label htmlFor="goal-title">Titre de l'objectif</label>
              <input
                id="goal-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Courir un marathon"
                autoFocus
              />
            </div>
          </div>

          <div className="field" style={{ marginTop: -6 }}>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setEmoji(e)}
                  style={{ padding: '3px 7px', opacity: emoji === e ? 1 : 0.55 }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label htmlFor="goal-desc">Description (facultatif)</label>
            <textarea
              id="goal-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Pourquoi cet objectif compte pour toi, comment tu comptes t'y prendre…"
            />
          </div>

          {!isEdit && (
            <div className="field">
              <label>Paliers</label>
              <p className="field-hint" style={{ marginTop: 0, marginBottom: 10 }}>
                Du plus accessible au plus ambitieux. Les rangs sont pré-remplis pour couvrir
                l'échelle, mais tu choisis librement celui de chaque palier.
              </p>
              {drafts.map((draft, index) => (
                <div className="draft-tier" key={draft.key}>
                  <span className="draft-index">{index + 1}</span>
                  <input
                    value={draft.title}
                    onChange={(e) => setDraft(draft.key, { title: e.target.value })}
                    placeholder={
                      ['Courir 10 km', 'Courir 15 km', 'Semi-marathon', 'Courir 30 km', 'Marathon'][
                        index
                      ] ?? 'Prochain palier…'
                    }
                  />
                  <RankSelect value={draft.rank} onChange={(rank) => setDraft(draft.key, { rank })} />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => removeDraft(draft.key)}
                    aria-label={`Supprimer le palier ${index + 1}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn-sm" onClick={addDraft}>
                + Ajouter un palier
              </button>
              <p className="field-hint">
                Les paliers laissés vides sont ignorés. Tu pourras en ajouter ou en retirer à tout
                moment.
              </p>
            </div>
          )}
        </div>

        <div className="modal-foot">
          <button type="button" className="btn" onClick={onCancel}>
            Annuler
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer' : "Créer l'objectif"}
          </button>
        </div>
      </form>
    </div>
  );
}
