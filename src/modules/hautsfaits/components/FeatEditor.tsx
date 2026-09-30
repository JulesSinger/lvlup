import { useEffect, useState } from 'react';
import { CATEGORY_INFO } from '../lib/categories';
import { inputFromDraft, type FeatDraft } from '../lib/editorDraft';
import { FEAT_CATEGORIES, FEAT_HIGHLIGHT_MAX, type FeatInput } from '../lib/types';
import { validateFeat } from '../lib/validation';
import { DateField } from './DateField';

/**
 * La fenêtre d'un haut fait, pour le créer ou le modifier. Un haut fait se
 * saisit rarement et à tête reposée : tout est sur une page, le titre et la
 * date d'abord, le reste facultatif ensuite.
 */
export function FeatEditor({
  initial,
  isNew,
  today,
  onSave,
  onCancel,
}: {
  initial: FeatDraft;
  isNew: boolean;
  today: string;
  onSave: (input: FeatInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<FeatDraft>) => setDraft((d) => ({ ...d, ...patch }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const input = inputFromDraft(draft);
    const problem = typeof input === 'string' ? input : validateFeat(input, today);
    if (problem || typeof input === 'string') {
      setError(problem ?? '');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(input);
    } catch (err) {
      // Le formulaire reste rempli : rien de ce qui a été écrit n'est perdu.
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  }

  return (
    // Un clic à côté ne ferme pas la fenêtre : il effacerait ce qui a été écrit (même règle que Flashcards).
    <div className="overlay">
      <form
        className="modal hautsfaits-editor"
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? 'Nouveau haut fait' : 'Modifier le haut fait'}
        onSubmit={(e) => void submit(e)}
      >
        <div className="modal-head">
          <span className="modal-title">{isNew ? 'Nouveau haut fait' : 'Modifier le haut fait'}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label htmlFor="hautsfaits-title">Titre</label>
            <input
              id="hautsfaits-title"
              autoFocus
              value={draft.title}
              placeholder="Semi-marathon de Paris, premier appartement…"
              onChange={(e) => set({ title: e.target.value })}
            />
          </div>

          <div className="field">
            <label id="hautsfaits-category-label">Catégorie</label>
            <div className="hautsfaits-category-picker" role="group" aria-labelledby="hautsfaits-category-label">
              {FEAT_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`hautsfaits-chip${draft.category === c ? ' on' : ''}`}
                  style={{ '--hautsfaits-c': CATEGORY_INFO[c].color } as React.CSSProperties}
                  aria-pressed={draft.category === c}
                  onClick={() => set({ category: c })}
                >
                  <span aria-hidden="true">{CATEGORY_INFO[c].emoji}</span> {CATEGORY_INFO[c].label}
                </button>
              ))}
            </div>
          </div>

          <DateField id="hautsfaits-start" label={draft.isPeriod ? 'Début' : 'Date'} value={draft.start} onChange={(start) => set({ start })} />

          <label className="switch hautsfaits-switch">
            <input
              type="checkbox"
              checked={draft.isPeriod}
              onChange={(e) => set({ isPeriod: e.target.checked, end: e.target.checked && !draft.isPeriod ? draft.start : draft.end })}
            />
            <span>C’est une période (six mois à l’étranger, trois ans d’école…)</span>
          </label>
          {draft.isPeriod && <DateField id="hautsfaits-end" label="Fin" value={draft.end} onChange={(end) => set({ end })} />}

          <label className="switch hautsfaits-switch">
            <input type="checkbox" checked={draft.major} onChange={(e) => set({ major: e.target.checked })} />
            <span>Un des grands : une grande carte dans la frise</span>
          </label>

          <div className="field">
            <label htmlFor="hautsfaits-highlight">Chiffre clé</label>
            <input
              id="hautsfaits-highlight"
              value={draft.highlight}
              maxLength={FEAT_HIGHLIGHT_MAX}
              placeholder="1 h 52 min, mention Bien, 42 m²…"
              onChange={(e) => set({ highlight: e.target.value })}
            />
            <div className="field-hint">Affiché en médaillon. Facultatif.</div>
          </div>

          <div className="hautsfaits-editor-pair">
            <div className="field">
              <label htmlFor="hautsfaits-place">Lieu</label>
              <input id="hautsfaits-place" value={draft.place} placeholder="Madrid" onChange={(e) => set({ place: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="hautsfaits-people">Avec qui</label>
              <input id="hautsfaits-people" value={draft.people} placeholder="avec Léa et Tom" onChange={(e) => set({ people: e.target.value })} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="hautsfaits-story">Le récit</label>
            <textarea
              id="hautsfaits-story"
              rows={4}
              value={draft.story}
              placeholder="Ce que tu ressentais, le détail que tu oublierais…"
              onChange={(e) => set({ story: e.target.value })}
            />
          </div>

          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
        </div>

        <div className="modal-foot">
          <button type="button" className="btn" onClick={onCancel}>
            Annuler
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {isNew ? 'Graver' : 'Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  );
}
