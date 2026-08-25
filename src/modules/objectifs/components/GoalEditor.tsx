import { useEffect, useState } from 'react';
import {
  guessAmount,
  kindFields,
  ladderKind,
  parseAmount,
  starterActions,
  targetForStore,
} from '../lib/quantities';
import { getRank, suggestRanks } from '../lib/ranks';
import type { TierSpec } from '../lib/templates';
import type { ActionInput, Goal, GoalInput, TierInput, TierKind } from '../lib/types';
import { RankBadge } from './RankBadge';
import { KINDS } from './TierCounter';

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
  tiers: TierSpec[];
}

interface Props {
  goal: Goal | null;
  seed?: GoalSeed | null;
  onCancel: () => void;
  onSave: (input: GoalInput, tiers: TierInput[], actions?: ActionInput[]) => Promise<void>;
}

interface DraftTier {
  key: number;
  title: string;
  /**
   * Comment ce palier se compte, hérité du modèle.
   *
   * On le conserve même si l'intitulé est retouché : renommer « 30 jours sans
   * écran » en « 30 jours sans écran le soir » ne change pas le fait que ça se
   * compte en jours. Un palier écrit de zéro reste un jalon — l'éditeur ne
   * demande pas encore de le qualifier, ce serait un formulaire de plus avant
   * la première victoire.
   */
  spec?: Omit<TierSpec, 'title'>;
  /**
   * Cible corrigée à la main, gardée telle qu'elle est tapée. On ne la
   * reformate pas à chaque frappe : sinon la virgule de « 21,1 » disparaît
   * sous les doigts au moment où on la tape.
   */
  amount?: string;
  unit?: string;
}

let nextKey = 1;

function draftsFrom(tiers: TierSpec[]): DraftTier[] {
  return tiers.map(({ title, ...spec }) => ({ key: nextKey++, title, spec }));
}

export function GoalEditor({ goal, seed, onCancel, onSave }: Props) {
  const isEdit = goal !== null;
  const [title, setTitle] = useState(goal?.title ?? seed?.title ?? '');
  const [description, setDescription] = useState(goal?.description ?? seed?.description ?? '');
  const [emoji, setEmoji] = useState(goal?.emoji ?? seed?.emoji ?? '🎯');
  const [drafts, setDrafts] = useState<DraftTier[]>(() =>
    isEdit ? [] : draftsFrom(seed?.tiers ?? [{ title: '' }, { title: '' }, { title: '' }]),
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  /**
   * La nature de l'objectif, demandée **une fois** au lieu d'être répétée sur
   * chaque palier. Un modèle arrive déjà annoté : on part de sa nature
   * dominante, et on ne réécrit ses paliers que si on la change vraiment —
   * sinon « Marcher 10 000 pas » (deux paliers en jours puis deux randonnées
   * en km) serait aplati par le simple fait d'ouvrir l'écran.
   */
  const seedKind = ladderKind(
    (seed?.tiers ?? []).map((t) => ({ kind: t.kind ?? 'jalon', unit: t.unit ?? '' })),
  );
  const [kind, setKind] = useState<TierKind>(seedKind?.kind ?? 'jalon');
  const kindTouched = kind !== (seedKind?.kind ?? 'jalon');
  const compte = kind !== 'jalon';

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

  /** Cible et unité effectives d'une étape : la saisie manuelle l'emporte. */
  function amountOf(draft: DraftTier): { raw: string; target: number | null; unit: string } {
    const guess = guessAmount(draft.title);
    const raw =
      draft.amount !== undefined
        ? draft.amount
        : guess
          ? String(guess.target).replace('.', ',')
          : '';
    return {
      raw,
      target: parseAmount(raw),
      unit: draft.unit !== undefined ? draft.unit : (guess?.unit || (seedKind?.unit ?? '')),
    };
  }

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
    const kept = drafts
      .map((d) => ({ ...d, title: d.title.trim() }))
      .filter((d) => d.title.length > 0);
    if (!isEdit && kept.length === 0) {
      setError('Ajoute au moins une étape — c’est le cœur du suivi.');
      return;
    }
    const finalRanks = suggestRanks(kept.length);
    const tiers: TierInput[] = kept.map((d, i) => {
      const base = { title: d.title, rank: finalRanks[i] };
      // Nature inchangée depuis le modèle : on garde son annotation, plus
      // précise que tout ce qu'on pourrait déduire.
      if (!kindTouched && d.spec) return { ...base, ...d.spec };
      if (!compte) return base;
      const { target, unit } = amountOf(d);
      // Sans cible lisible, on reste un jalon : un palier comptable à zéro
      // afficherait une barre bloquée pour toujours.
      if (target === null) return base;
      const fields = kindFields(kind, { unit, target });
      const signe = targetForStore(target, {
        kind,
        direction: fields.direction ?? 'hausse',
        mode: fields.mode ?? 'absolu',
      });
      return { ...base, ...fields, unit, target: signe };
    });

    // Les actions doivent porter l'unité, sinon les paliers comptables ne
    // monteront jamais — voir `starterActions`.
    const cibles = tiers
      .map((t) => t.target)
      .filter((t): t is number => typeof t === 'number');
    const unite = tiers.find((t) => t.unit)?.unit ?? '';
    const actions = compte ? starterActions(kind, unite, cibles) : undefined;

    setSaving(true);
    setError('');
    try {
      await onSave({ title: cleanTitle, description: description.trim(), emoji }, tiers, actions);
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
              {drafts.map((draft, index) => {
                const montant = amountOf(draft);
                return (
                <div className="draft-tier" key={draft.key}>
                  <span className="draft-index">{index + 1}</span>
                  <input
                    value={draft.title}
                    onChange={(e) => setDraft(draft.key, { title: e.target.value })}
                    placeholder={
                      ['Courir 10 km', 'Semi-marathon', 'Marathon'][index] ?? 'Étape suivante…'
                    }
                  />
                  {/* La cible lue dans l'intitulé, montrée avant d'être
                      enregistrée : on ne devine jamais en silence. Elle reste
                      modifiable, et une étape sans nombre reste à cocher. */}
                  {compte && draft.title.trim() !== '' && (
                    <span className="draft-amount">
                      <input
                        inputMode="decimal"
                        value={montant.raw}
                        onChange={(e) => setDraft(draft.key, { amount: e.target.value })}
                        placeholder="—"
                        aria-label={`Cible de l'étape ${index + 1}`}
                      />
                      <input
                        value={montant.unit}
                        maxLength={12}
                        onChange={(e) => setDraft(draft.key, { unit: e.target.value })}
                        placeholder="unité"
                        aria-label={`Unité de l'étape ${index + 1}`}
                      />
                    </span>
                  )}
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
                );
              })}
              <button type="button" className="btn btn-sm" onClick={addDraft}>
                + Ajouter une étape
              </button>

              {/* La question posée UNE fois pour tout l'objectif, au lieu d'être
                  répétée sur chaque palier après coup. Par défaut « à cocher » :
                  le chemin d'avant ne change pas d'un pixel. */}
              <div className="draft-kind">
                <label htmlFor="goal-kind">Ces étapes se comptent en</label>
                <select
                  id="goal-kind"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as TierKind)}
                >
                  {KINDS.filter((k) => k.id !== 'serie').map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label}
                    </option>
                  ))}
                </select>
                <span className="field-hint">{KINDS.find((k) => k.id === kind)?.hint}</span>
              </div>
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
