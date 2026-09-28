import { useEffect, useState } from 'react';
import { LIST_COLORS, type ListColor, type TaskList } from '../lib/types';

interface Props {
  /** `null` : une nouvelle liste */
  list: TaskList | null;
  onCancel: () => void;
  onSave: (name: string, color: ListColor) => Promise<void>;
  onDelete?: () => Promise<void>;
}

const COLOR_LABELS: Record<ListColor, string> = { bleu: 'Bleu', vert: 'Vert', orange: 'Orange', rose: 'Rose', violet: 'Violet', gris: 'Gris' };

/** Créer, renommer ou supprimer une liste. La supprimer renvoie ses tâches à la boîte de réception. */
export function ListEditor({ list, onCancel, onSave, onDelete }: Props) {
  const [name, setName] = useState(list?.name ?? '');
  const [color, setColor] = useState<ListColor>(list?.color ?? 'bleu');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  async function run(action: () => Promise<void>) {
    setSaving(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  }

  function submit() {
    const value = name.trim();
    if (!value) return setError('Donne un nom à la liste.');
    if (value.length > 60) return setError('Le nom est trop long (60 caractères au plus).');
    void run(() => onSave(value, color));
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="modal taches-list-editor" role="dialog" aria-modal="true" aria-label={list ? 'Modifier la liste' : 'Nouvelle liste'} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">{list ? 'Modifier la liste' : 'Nouvelle liste'}</span>
          <button className="btn btn-ghost btn-sm" onClick={onCancel} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label htmlFor="taches-list-name">Nom</label>
            <input
              id="taches-list-name"
              type="text"
              value={name}
              placeholder="Maison, Travail, Papiers…"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              autoFocus
            />
          </div>
          <div className="field">
            <label>Couleur</label>
            <div className="taches-colors" role="radiogroup" aria-label="Couleur">
              {LIST_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === c}
                  aria-label={COLOR_LABELS[c]}
                  title={COLOR_LABELS[c]}
                  className={`taches-color taches-color-${c}${color === c ? ' on' : ''}`}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
          {list && <p className="taches-hint">Supprimer la liste renvoie ses tâches dans la boîte de réception.</p>}
          {error && <div className="notice error">{error}</div>}
        </div>
        <div className="modal-foot taches-editor-foot">
          {onDelete && (
            <button
              className="btn btn-ghost btn-sm btn-danger"
              onClick={() => window.confirm(`Supprimer la liste « ${list?.name} » ? Ses tâches iront dans la boîte de réception.`) && void run(onDelete)}
              disabled={saving}
            >
              Supprimer
            </button>
          )}
          <span className="taches-editor-spacer" />
          <button className="btn" onClick={onCancel}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {list ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}
