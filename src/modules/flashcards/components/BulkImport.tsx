import { useMemo, useState } from 'react';
import { parseBulkImport, withoutDuplicates } from '../lib/bulkImport';
import type { ParsedCard } from '../lib/bulkImport';

interface Props {
  /** Recto des cartes déjà présentes dans le paquet — pour ne pas dupliquer un import recollé par erreur. */
  existingFronts: string[];
  onCancel: () => void;
  onImport: (cards: ParsedCard[]) => Promise<void>;
}

/**
 * Importer une liste de cartes — étape 7 (docs/etude-flashcards.md §9) :
 * « l'usage devient tenable dans la durée » sans avoir à ouvrir l'éditeur
 * une carte à la fois. Aperçu avant écriture, comme l'import CSV d'Astra :
 * rien n'est créé tant qu'on n'a pas cliqué « Importer ».
 */
export function BulkImport({ existingFronts, onCancel, onImport }: Props) {
  const [text, setText] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  const parsed = useMemo(() => parseBulkImport(text), [text]);
  const { fresh, duplicates } = useMemo(
    () => withoutDuplicates(parsed.cards, existingFronts),
    [parsed.cards, existingFronts],
  );

  async function submit() {
    setError('');
    setImporting(true);
    try {
      await onImport(fresh);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import impossible.');
      setImporting(false);
    }
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <div
        className="modal flashcards-bulk-import"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <span className="modal-title">Importer une liste</span>
          <button className="btn btn-ghost btn-sm" onClick={onCancel} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label htmlFor="flashcards-bulk-text">
              Une carte par ligne — recto puis verso, séparés par un point-virgule ou une
              tabulation
            </label>
            <textarea
              id="flashcards-bulk-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'Hola ; Bonjour\nAdios ; Au revoir'}
              rows={10}
              autoFocus
            />
          </div>

          {text.trim() !== '' && (
            <p className="flashcards-bulk-summary">
              <b>{fresh.length}</b> nouvelle{fresh.length !== 1 ? 's' : ''} carte
              {fresh.length !== 1 ? 's' : ''}
              {duplicates.length > 0 && (
                <>
                  {' · '}
                  {duplicates.length} déjà connue{duplicates.length !== 1 ? 's' : ''}, ignorée
                  {duplicates.length !== 1 ? 's' : ''}
                </>
              )}
              {parsed.invalid.length > 0 && (
                <>
                  {' · '}
                  {parsed.invalid.length} ligne{parsed.invalid.length !== 1 ? 's' : ''} incomprise
                  {parsed.invalid.length !== 1 ? 's' : ''}
                </>
              )}
            </p>
          )}

          {parsed.invalid.length > 0 && (
            <ul className="flashcards-bulk-invalid">
              {parsed.invalid.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}

          {error && <div className="notice error">{error}</div>}
        </div>

        <div className="modal-foot">
          <button className="btn" onClick={onCancel}>
            Annuler
          </button>
          <button
            className="btn btn-primary"
            onClick={() => void submit()}
            disabled={importing || fresh.length === 0}
          >
            {importing ? 'Import…' : `Importer${fresh.length > 0 ? ` (${fresh.length})` : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
