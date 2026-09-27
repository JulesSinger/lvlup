import { useEffect } from 'react';
import type { Scope } from '../lib/seriesEdit';

interface Props {
  action: 'edit' | 'delete' | 'move';
  /** « Cet événement » n'a pas de sens quand c'est la règle qui change. */
  allowThis: boolean;
  onChoose: (scope: Scope) => void;
  onCancel: () => void;
}

const TITLES = {
  edit: 'Modifier un événement répété',
  move: 'Déplacer un événement répété',
  delete: 'Supprimer un événement répété',
};

/**
 * La question que pose tout agenda devant une série : cette occurrence
 * seule, celle-ci et les suivantes, ou toutes (étude §3). La réponse est
 * traduite en écritures par `lib/seriesEdit.ts`.
 */
export function ScopeDialog({ action, allowThis, onChoose, onCancel }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // La fenêtre de l'événement, dessous, écoute aussi Échap : on ne ferme que celle-ci.
        e.stopImmediatePropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onCancel]);

  return (
    <div className="overlay calendrier-scope-overlay" onClick={onCancel}>
      <div className="modal calendrier-scope" role="dialog" aria-modal="true" aria-label={TITLES[action]} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">{TITLES[action]}</span>
        </div>
        <div className="modal-body calendrier-scope-choices">
          {allowThis && (
            <button className="btn" onClick={() => onChoose('this')}>
              Cet événement
            </button>
          )}
          <button className="btn" onClick={() => onChoose('following')}>
            Cet événement et les suivants
          </button>
          <button className={`btn${action === 'delete' ? ' btn-danger' : ''}`} onClick={() => onChoose('all')}>
            Tous les événements
          </button>
          {!allowThis && <p className="calendrier-series-note">La répétition change : elle vaut pour une suite d’événements, pas pour un seul.</p>}
        </div>
        <div className="modal-foot">
          <span className="calendrier-editor-spacer" />
          <button className="btn btn-ghost" onClick={onCancel}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
