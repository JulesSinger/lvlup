import { useEffect, useState } from 'react';
import { getRank, suggestRanks } from '../lib/ranks';
import { GOAL_TEMPLATES, TEMPLATE_CATEGORIES, type GoalTemplate } from '../lib/templates';
import { RankBadge } from './RankBadge';

/**
 * Premier écran de création : on choisit un objectif tout prêt, ou on part
 * de zéro. La page blanche n'est plus le point de départ mais une porte de
 * sortie pour ceux qui savent déjà ce qu'ils veulent.
 */
export function GoalPicker({
  onPick,
  onScratch,
  onCancel,
}: {
  onPick: (template: GoalTemplate) => void;
  onScratch: () => void;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState<string>(TEMPLATE_CATEGORIES[0]);
  const [preview, setPreview] = useState<GoalTemplate | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (preview) setPreview(null);
        else onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, preview]);

  const shown = GOAL_TEMPLATES.filter((t) => t.category === category);

  if (preview) {
    const ranks = suggestRanks(preview.tiers.length);
    return (
      <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
        <div className="modal">
          <div className="modal-head">
            <h2 className="modal-title">
              {preview.emoji} {preview.title}
            </h2>
            <button className="btn btn-ghost" onClick={() => setPreview(null)} aria-label="Retour">
              ✕
            </button>
          </div>
          <div className="modal-body">
            <p className="picker-desc">{preview.description}</p>

            <div className="field">
              <label>Les étapes</label>
              <ul className="preview-tiers">
                {preview.tiers.map((title, i) => (
                  <li key={title}>
                    <span className="preview-index">{i + 1}</span>
                    <span className="preview-title">{title}</span>
                    <RankBadge rank={getRank(ranks[i])} />
                  </li>
                ))}
              </ul>
            </div>

            <div className="field">
              <label>Les actions du quotidien</label>
              <div className="preview-actions">
                {preview.actions.map((a) => (
                  <span key={a.title} className="preview-action">
                    {a.title} <b>+{a.pp}</b>
                  </span>
                ))}
              </div>
              <p className="field-hint">
                Tout est modifiable ensuite — titres, étapes, actions, rangs.
              </p>
            </div>
          </div>
          <div className="modal-foot">
            <button className="btn" onClick={() => setPreview(null)}>
              Retour
            </button>
            <button className="btn btn-primary" onClick={() => onPick(preview)}>
              Choisir cet objectif
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal modal-wide">
        <div className="modal-head">
          <h2 className="modal-title">Nouvel objectif</h2>
          <button className="btn btn-ghost" onClick={onCancel} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <p className="picker-intro">
            Choisis un objectif tout prêt — étapes et actions incluses, modifiables ensuite.
          </p>

          <div className="picker-tabs">
            {TEMPLATE_CATEGORIES.map((c) => (
              <button
                key={c}
                className={`picker-tab${c === category ? ' active' : ''}`}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="picker-grid">
            {shown.map((t) => (
              <button key={t.id} className="picker-card" onClick={() => setPreview(t)}>
                <span className="picker-emoji" aria-hidden="true">
                  {t.emoji}
                </span>
                <span className="picker-body">
                  <span className="picker-title">{t.title}</span>
                  <span className="picker-meta">
                    {t.tiers.length} étapes · {t.actions.length} actions
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="modal-foot picker-foot">
          <span className="picker-scratch-hint">Tu sais déjà ce que tu veux ?</span>
          <button className="btn" onClick={onScratch}>
            Partir de zéro
          </button>
        </div>
      </div>
    </div>
  );
}
