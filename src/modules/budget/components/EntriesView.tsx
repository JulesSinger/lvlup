import { useEffect, useState } from 'react';
import { budgetStore } from '../data';
import { formatCents } from '../lib/amount';
import { linkedMove, linkPlan } from '../lib/envelopes';
import type { BudgetCategory, BudgetEntry, BudgetEntryInput, BudgetEnvelope, BudgetEnvelopeMove, BudgetRule } from '../lib/types';
import { BulkEntryEditor } from './BulkEntryEditor';
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
  envelopes = [],
  moves = [],
  history,
  onError,
  onChanged,
  emptyTitle,
  emptyBody,
}: {
  entries: BudgetEntry[];
  categories: BudgetCategory[];
  rules: BudgetRule[];
  /** Les enveloppes et leurs mouvements : une dépense peut être payée par une enveloppe. */
  envelopes?: BudgetEnvelope[];
  moves?: BudgetEnvelopeMove[];
  /** Tout l'historique : la fenêtre d'une écriture en tire ses catégories fréquentes. */
  history: BudgetEntry[];
  onError: (message: string) => void;
  onChanged: () => Promise<void>;
  emptyTitle: string;
  emptyBody?: string;
}) {
  const [editing, setEditing] = useState<BudgetEntry | 'new' | 'bulk' | null>(null);

  // Raccourci « N » : ouvre une nouvelle écriture sans passer par la souris.
  // Ignoré pendant la frappe (un champ de texte, un menu…) et avec un
  // modificateur (Cmd/Ctrl+N reste le « nouvelle fenêtre » du navigateur).
  useEffect(() => {
    function isTypingTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      return (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      );
    }
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() !== 'n') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (editing !== null) return;
      if (isTypingTarget(document.activeElement)) return;
      e.preventDefault();
      setEditing('new');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing]);

  async function saveEntry(input: BudgetEntryInput, rememberPattern?: string, envelopeId?: string | null) {
    let saved: { id: string; amountCents: number; day: string; label: string };
    if (editing !== null && editing !== 'new' && editing !== 'bulk') {
      await budgetStore.updateEntry(editing.id, input);
      saved = { id: editing.id, amountCents: input.amountCents, day: input.day, label: input.label };
    } else {
      saved = await budgetStore.createEntry(input);
    }
    // La règle après l'écriture : l'écriture compte plus que la règle, qui
    // n'est qu'un confort pour les relevés suivants.
    if (rememberPattern && input.categoryId) {
      await budgetStore.createRule({ pattern: rememberPattern, categoryId: input.categoryId, priority: 10 });
    }
    // Le retrait d'enveloppe suit la dépense (§6 bis) : l'ancien d'abord retiré,
    // le nouveau ensuite — jamais deux retraits pour une même dépense.
    if (envelopeId !== undefined) {
      const plan = linkPlan(linkedMove(moves, saved.id), envelopeId, saved);
      if (plan.remove) await budgetStore.deleteEnvelopeMove(plan.remove);
      if (plan.create) await budgetStore.createEnvelopeMove(plan.create);
    }
    setEditing(null);
    await onChanged();
  }

  // Toutes les lignes en un envoi (`importEntries`, sans clé d'import : rien
  // n'est écarté comme doublon) — elles partent ensemble ou pas du tout.
  async function saveBulk(inputs: BudgetEntryInput[]) {
    await budgetStore.importEntries(inputs);
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
          <button className="btn" onClick={() => setEditing('bulk')}>
            Plusieurs à la fois
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
                      {(() => {
                        const paid = linkedMove(moves, entry.id);
                        const envelope = paid && envelopes.find((e) => e.id === paid.envelopeId);
                        return envelope ? ` · payée par l’enveloppe ${envelope.emoji} ${envelope.name}` : null;
                      })()}
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
            title="Nouvelle écriture (N)"
            aria-label="Nouvelle écriture"
          >
            <span className="budget-add-icon" aria-hidden="true" />
          </button>
        </>
      )}

      {editing === 'bulk' && (
        <BulkEntryEditor
          categories={categories}
          rules={rules}
          onCancel={() => setEditing(null)}
          onSave={saveBulk}
        />
      )}

      {editing !== null && editing !== 'bulk' && (
        <EntryEditor
          entry={editing === 'new' ? null : editing}
          categories={categories}
          rules={rules}
          envelopes={envelopes}
          moves={moves}
          history={history}
          onCancel={() => setEditing(null)}
          onSave={saveEntry}
          onSwitchToBulk={() => setEditing('bulk')}
        />
      )}
    </div>
  );
}
