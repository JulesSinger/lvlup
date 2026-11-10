import { useState } from 'react';
import { LIST_DESCRIPTION_MAX, LIST_TITLE_MAX, type TierList, type TierListInput } from '../lib/types';
import { validateList } from '../lib/validation';
import { Modal } from './Modal';

/** Créer une tier list, ou modifier son titre et sa description ; tout remettre à classer, la supprimer. */
export function ListDialog({ list, onSave, onReset, onDelete, onClose }: {
  list: TierList | null;
  onSave: (input: TierListInput) => Promise<void>;
  onReset?: () => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(list?.title ?? '');
  const [description, setDescription] = useState(list?.description ?? '');
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Ça n’a pas marché.');
      setBusy(false);
    }
  };

  const save = () => {
    const input = { title, description: description.trim() };
    const refusal = validateList(input);
    if (refusal) return setProblem(refusal);
    void run(() => onSave(input));
  };

  return (
    <Modal
      title={list ? 'La tier list' : 'Nouvelle tier list'}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {list ? 'Enregistrer' : 'Créer'}
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="tierlists-title">Titre</label>
        <input
          id="tierlists-title"
          value={title}
          maxLength={LIST_TITLE_MAX}
          placeholder="Champions de LoL, films de 2026, burgers de Nancy…"
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />
      </div>
      <div className="field">
        <label htmlFor="tierlists-description">Description (facultative)</label>
        <textarea
          id="tierlists-description"
          rows={2}
          value={description}
          maxLength={LIST_DESCRIPTION_MAX}
          placeholder="Ce qu’on classe, et selon quoi"
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      {!list && <p className="field-hint">Elle commence avec les rangées S, A, B, C et D : tu pourras les renommer, les recolorer, en ajouter.</p>}
      {problem && <p className="tierlists-error">{problem}</p>}
      {list && (onReset || onDelete) && (
        <div className="tierlists-danger-zone">
          {onReset && (
            <button
              className="btn btn-sm"
              disabled={busy}
              onClick={() => window.confirm('Remettre tous les éléments à classer ? Les rangées restent.') && void run(onReset)}
            >
              ↺ Tout remettre à classer
            </button>
          )}
          {onDelete && (
            <button
              className="btn btn-sm btn-danger"
              disabled={busy}
              onClick={() => window.confirm(`Supprimer « ${list.title} » et tout ce qu’elle contient ?`) && void run(onDelete)}
            >
              Supprimer la tier list
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}
