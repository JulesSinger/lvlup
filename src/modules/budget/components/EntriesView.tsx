import { useState } from 'react';
import { budgetStore } from '../data';
import { formatCents } from '../lib/amount';
import type { BudgetCategory, BudgetEntry, BudgetEntryInput, BudgetRule } from '../lib/types';
import { EntryEditor } from './EntryEditor';

function categoryFor(categories: BudgetCategory[], id: string | null): BudgetCategory | null {
  if (!id) return null;
  return categories.find((c) => c.id === id) ?? null;
}

/**
 * La liste des opérations — l'outil de correction (docs/etude-astra.md §5) :
 * sans elle, impossible de rattraper une ligne mal rangée. Depuis l'étape 4,
 * elle vit sous le camembert du mois (`MonthScreen`), qui lui fournit déjà
 * les écritures à afficher (déjà filtrées par mois, et le cas échéant par
 * part cliquée) — cette liste ne va donc plus chercher les écritures
 * elle-même, à la différence de l'étape 3.
 */
export function EntriesView({
  entries,
  categories,
  rules,
  frequentCategoryIds,
  onError,
  onChanged,
  emptyTitle,
  emptyBody,
}: {
  entries: BudgetEntry[];
  categories: BudgetCategory[];
  rules: BudgetRule[];
  frequentCategoryIds: string[];
  onError: (message: string) => void;
  onChanged: () => Promise<void>;
  emptyTitle: string;
  emptyBody?: string;
}) {
  const [editing, setEditing] = useState<BudgetEntry | 'new' | null>(null);

  async function saveEntry(input: BudgetEntryInput) {
    if (editing !== null && editing !== 'new') {
      await budgetStore.updateEntry(editing.id, input);
    } else {
      await budgetStore.createEntry(input);
    }
    setEditing(null);
    await onChanged();
  }

  async function removeEntry(entry: BudgetEntry) {
    if (!window.confirm(`Supprimer « ${entry.label} » (${formatCents(entry.amountCents)}) ?`)) return;
    try {
      await budgetStore.deleteEntry(entry.id);
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Suppression impossible.');
    }
  }

  return (
    <div className="budget-entries">
      {entries.length === 0 ? (
        <div className="empty">
          <h3>{emptyTitle}</h3>
          {emptyBody && <p>{emptyBody}</p>}
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
          <button
            className="btn btn-primary budget-add"
            onClick={() => setEditing('new')}
            title="Nouvelle écriture"
            aria-label="Nouvelle écriture"
          >
            <span className="budget-add-icon" aria-hidden="true" />
          </button>
        </>
      )}

      {editing !== null && (
        <EntryEditor
          entry={editing === 'new' ? null : editing}
          categories={categories}
          rules={rules}
          frequentCategoryIds={frequentCategoryIds}
          onCancel={() => setEditing(null)}
          onSave={saveEntry}
        />
      )}
    </div>
  );
}
