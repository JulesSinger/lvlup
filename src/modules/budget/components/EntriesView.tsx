import { useCallback, useEffect, useState } from 'react';
import { budgetStore } from '../data';
import { formatCents } from '../lib/amount';
import type { BudgetCategory, BudgetEntry } from '../lib/types';
import { EntryEditor } from './EntryEditor';

function categoryFor(categories: BudgetCategory[], id: string | null): BudgetCategory | null {
  if (!id) return null;
  return categories.find((c) => c.id === id) ?? null;
}

/**
 * La liste des opérations — l'outil de correction (docs/etude-astra.md §5) :
 * sans elle, impossible de rattraper une ligne mal rangée. L'import du
 * relevé arrive à l'étape 5 ; pour l'instant, seule la saisie manuelle
 * alimente cette liste.
 */
export function EntriesView({
  categories,
  onError,
  reloadToken,
}: {
  categories: BudgetCategory[];
  onError: (message: string) => void;
  reloadToken: number;
}) {
  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BudgetEntry | 'new' | null>(null);

  const refresh = useCallback(async () => {
    try {
      setEntries(await budgetStore.listEntries());
      onError('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh, reloadToken]);

  async function saveEntry(input: Parameters<typeof budgetStore.createEntry>[0]) {
    if (editing !== null && editing !== 'new') {
      await budgetStore.updateEntry(editing.id, input);
    } else {
      await budgetStore.createEntry(input);
    }
    setEditing(null);
    await refresh();
  }

  async function removeEntry(entry: BudgetEntry) {
    if (!window.confirm(`Supprimer « ${entry.label} » (${formatCents(entry.amountCents)}) ?`)) return;
    try {
      await budgetStore.deleteEntry(entry.id);
      await refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Suppression impossible.');
    }
  }

  if (loading) return <p>Chargement…</p>;

  return (
    <div className="budget-entries">
      {entries.length === 0 ? (
        <div className="empty">
          <h3>Aucune écriture pour l'instant</h3>
          <p>
            Une écriture, c'est une dépense ou une entrée d'argent : un jour, un libellé, un
            montant, et une catégorie — ou « à classer » si tu n'es pas encore fixé.
          </p>
          <button className="btn btn-primary" onClick={() => setEditing('new')}>
            Ajouter une écriture
          </button>
        </div>
      ) : (
        <>
          <ul className="budget-list">
            {entries.map((entry) => {
              const category = categoryFor(categories, entry.categoryId);
              return (
                <li key={entry.id} className="budget-row budget-entry-row">
                  <span className="budget-row-day">{entry.day}</span>
                  <span
                    className="budget-row-swatch"
                    style={{ background: category?.color ?? 'var(--surface-2)' }}
                    aria-hidden="true"
                  >
                    {category?.emoji ?? '❔'}
                  </span>
                  <span className="budget-row-name">
                    {entry.label}
                    <span className="budget-row-category">
                      {category ? category.name : 'À classer'}
                    </span>
                  </span>
                  <span
                    className={`budget-row-amount${entry.amountCents < 0 ? ' negative' : ' positive'}`}
                  >
                    {formatCents(entry.amountCents)}
                  </span>
                  <span className="budget-row-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(entry)}>
                      Modifier
                    </button>
                    <button
                      className="btn btn-ghost btn-sm btn-danger"
                      onClick={() => void removeEntry(entry)}
                    >
                      Supprimer
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
          <button className="btn btn-primary budget-add" onClick={() => setEditing('new')}>
            + Nouvelle écriture
          </button>
        </>
      )}

      {editing !== null && (
        <EntryEditor
          entry={editing === 'new' ? null : editing}
          categories={categories}
          onCancel={() => setEditing(null)}
          onSave={saveEntry}
        />
      )}
    </div>
  );
}
