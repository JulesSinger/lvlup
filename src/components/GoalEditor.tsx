import { useEffect, useState } from 'react';
import { getRank, suggestRanks } from '../lib/ranks';
import type { Goal, GoalInput, TierInput } from '../lib/types';
import { RankBadge } from './RankBadge';

const EMOJIS = [
  // sport & corps
  '🎯', '🏃', '🏅', '💪', '🚶', '🤸', '🏊', '🚲', '⚽', '🧗', '⚖️',
  // santé & alimentation
  '🥗', '💧', '😴', '🍳', '🍎', '🚭', '🥤', '🍫',
  // esprit
  '🧘', '📓', '🙏', '🧠', '🌱',
  // argent
  '💰', '📊', '🧾', '📈',
  // apprendre & créer
  '📚', '🗣️', '🎸', '💻', '✍️', '📷', '🎨', '🚀',
  // vie
  '🏠', '🧹', '👥', '📞', '💼', '✈️', '📱', '🐾',
];

/** Amorce d'un objectif venu d'un modèle, ou vide pour partir de zéro. */
export interface GoalSeed {
  title: string;
  description: string;
  emoji: string;
  tiers: string[];
}

interface Props {
  goal: Goal | null;
  seed?: GoalSeed | null;
  onCancel: () => void;
  onSave: (input: GoalInput, tiers: TierInput[]) => Promise<void>;
}

interface DraftTier {
  key: number;
  title: string;
}

let nextKey = 1;

function draftsFrom(titles: string[]): DraftTier[] {
  return titles.map((title) => ({ key: nextKey++, title }));
}

export function GoalEditor({ goal, seed, onCancel, onSave }: Props) {
  const isEdit = goal !== null;
  const [title, setTitle] = useState(goal?.title ?? seed?.title ?? '');
  const [description, setDescription] = useState(goal?.description ?? seed?.description ?? '');
  const [emoji, setEmoji] = useState(goal?.emoji ?? seed?.emoji ?? '🎯');
  const [drafts, setDrafts] = useState<DraftTier[]>(() =>
    isEdit ? [] : draftsFrom(seed?.tiers ?? ['', '', '']),
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  // Les rangs ne sont plus choisis un par un : ils se répartissent tout seuls
  // sur l'échelle selon le nombre d'étapes. Le premier test utilisateur a
  // montré qu'afficher les dix rangs à la création donne l'impression qu'il
  // faut tous les remplir — et décourage avant même de commencer.
  const filled = drafts.filter((d) => d.title.trim().length > 0);
  const ranks = suggestRanks(Math.max(filled.length, 1));

  function setDraft(key: number, patch: Partial<DraftTier>) {
    setDrafts((list) => list.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  function addDraft() {
    setDrafts((list) => [...list, { key: nextKey++, title: '' }]);
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
    const kept = drafts.map((d) => d.title.trim()).filter((t) => t.length > 0);
    if (!isEdit && kept.length === 0) {
      setError('Ajoute au moins une étape — c’est le cœur du suivi.');
      return;
    }
    const finalRanks = suggestRanks(kept.length);
    const tiers: TierInput[] = kept.map((t, i) => ({ title: t, rank: finalRanks[i] }));

    setSaving(true);
    setError('');
    try {
      await onSave({ title: cleanTitle, description: description.trim(), emoji }, tiers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  }

  /** Rang qui sera attribué à la nième étape non vide (pour l'aperçu). */
  function rankForIndex(index: number) {
    const position = drafts.slice(0, index).filter((d) => d.title.trim().length > 0).length;
    return getRank(ranks[Math.min(position, ranks.length - 1)]);
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
              <label>Les étapes</label>
              <p className="field-hint" style={{ marginTop: 0, marginBottom: 10 }}>
                De la plus accessible à la plus ambitieuse. Mets-en autant que tu veux : deux
                suffisent, et les rangs se répartissent tout seuls.
              </p>
              {drafts.map((draft, index) => (
                <div className="draft-tier" key={draft.key}>
                  <span className="draft-index">{index + 1}</span>
                  <input
                    value={draft.title}
                    onChange={(e) => setDraft(draft.key, { title: e.target.value })}
                    placeholder={
                      ['Courir 10 km', 'Semi-marathon', 'Marathon'][index] ?? 'Étape suivante…'
                    }
                  />
                  {draft.title.trim() ? (
                    <RankBadge rank={rankForIndex(index)} />
                  ) : (
                    <span className="draft-rank-empty">—</span>
                  )}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => removeDraft(draft.key)}
                    aria-label={`Supprimer l'étape ${index + 1}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" className="btn btn-sm" onClick={addDraft}>
                + Ajouter une étape
              </button>
              <p className="field-hint">
                Les étapes vides sont ignorées. Tu pourras ajuster les rangs plus tard, en
                dépliant l'objectif.
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
