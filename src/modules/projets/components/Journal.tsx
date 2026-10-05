import { useState } from 'react';
import { shortDate } from '../lib/format';
import type { ProjectNote } from '../lib/types';
import { validateNote } from '../lib/validation';
import { useSaving } from './useSaving';

interface Props {
  notes: readonly ProjectNote[];
  today: string;
  onAdd: (day: string, text: string) => Promise<void>;
  onDelete: (note: ProjectNote) => Promise<void>;
}

/**
 * Le journal du projet (§3.9) : des notes datées, la plus récente en haut.
 * C'est la mémoire du projet — et ce qui protège en cas de désaccord.
 */
export function Journal({ notes, today, onAdd, onDelete }: Props) {
  const [day, setDay] = useState(today);
  const [text, setText] = useState('');
  const { saving, error, setError, run } = useSaving();
  const sorted = [...notes].sort((a, b) => b.day.localeCompare(a.day) || b.createdAt.localeCompare(a.createdAt));

  function submit() {
    const problem = validateNote(text);
    if (problem) return setError(problem);
    void run(async () => {
      await onAdd(day || today, text.trim());
      setText('');
    });
  }

  return (
    <div className="projets-journal">
      <div className="projets-journal-form">
        <input type="date" aria-label="Date de la note" value={day} onChange={(e) => setDay(e.target.value)} />
        <textarea
          rows={2}
          aria-label="Note"
          value={text}
          placeholder="Appel : elle veut ajouter une page Mariages…"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && submit()}
        />
        <button className="btn btn-primary btn-sm" onClick={submit} disabled={saving}>
          Ajouter au journal
        </button>
      </div>
      {error && <div className="notice error">{error}</div>}
      {sorted.length === 0 ? (
        <p className="projets-hint">Rien encore. Note ici les appels, les décisions, les validations du client.</p>
      ) : (
        <ul className="projets-notes">
          {sorted.map((n) => (
            <li key={n.id} className="projets-note">
              <span className="projets-note-day">{shortDate(n.day, today)}</span>
              <span className="projets-note-text">{n.text}</span>
              <button
                type="button"
                className="btn btn-ghost btn-sm projets-edit-btn"
                aria-label="Retirer la note"
                onClick={() => window.confirm('Retirer cette note du journal ?') && void run(() => onDelete(n))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
