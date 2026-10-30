import { useEffect, useRef, useState } from 'react';
import { budgetStore } from '../data';
import { accountOf } from '../lib/accounts';
import { formatCents } from '../lib/amount';
import { suggestedPattern } from '../lib/classify';
import { linkedMove, linkPlan } from '../lib/envelopes';
import { knownFor, ruleWithPattern } from '../lib/labels';
import type { BudgetAccount, BudgetCategory, BudgetEntry, BudgetEntryInput, BudgetEnvelope, BudgetEnvelopeMove, BudgetRule } from '../lib/types';
import { BulkEntryEditor } from './BulkEntryEditor';
import { EntryEditor } from './EntryEditor';
import { RuleEditor, type RuleInput } from './RuleEditor';

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
  accounts = [],
  defaultAccountId = '',
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
  /** Les comptes, le principal en tête (`accountList`) ; un seul, et le compte ne se montre nulle part. */
  accounts?: BudgetAccount[];
  /** Le compte d'une nouvelle écriture : celui qu'on regarde, sinon le principal. */
  defaultAccountId?: string;
}) {
  const multiAccounts = accounts.length > 1;
  const [editing, setEditing] = useState<BudgetEntry | 'new' | 'bulk' | null>(null);
  /** « C'est quoi ? » : la fiche du libellé à écrire (ou à compléter), docs/etude-astra.md §18. */
  const [explaining, setExplaining] = useState<{ rule: BudgetRule | null; pattern: string } | null>(null);
  /** La note d'une écriture, écrite dans la ligne même. */
  const [noting, setNoting] = useState<{ id: string; text: string } | null>(null);
  /** Entrée ou Échap ont déjà décidé : la perte du focus qui suit ne réenregistre pas (ni n'annule une annulation). */
  const noteDecided = useRef(false);

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
      if (editing !== null || explaining !== null || noting !== null) return;
      if (isTypingTarget(document.activeElement)) return;
      e.preventDefault();
      setEditing('new');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, explaining, noting]);

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

  function explain(entry: BudgetEntry) {
    const known = knownFor(entry.label, rules);
    const pattern = suggestedPattern(entry.label);
    // La fiche déjà là, ou la règle du même motif (on la complète) ; sinon une nouvelle.
    setExplaining({ rule: known ?? ruleWithPattern(pattern, rules), pattern });
  }

  async function saveFiche(input: RuleInput, alsoClassify: string[]) {
    if (explaining?.rule) await budgetStore.updateRule(explaining.rule.id, input);
    else await budgetStore.createRule({ ...input, priority: 10 });
    if (alsoClassify.length > 0 && input.categoryId) await budgetStore.setEntriesCategory(alsoClassify, input.categoryId);
    setExplaining(null);
    await onChanged();
  }

  async function saveNote() {
    if (!noting) return;
    try {
      await budgetStore.updateEntry(noting.id, { note: noting.text.trim() });
      setNoting(null);
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Enregistrement impossible.');
    }
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
              const known = knownFor(entry.label, rules);
              const isNoting = noting?.id === entry.id;
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
                      {multiAccounts &&
                        (() => {
                          const account = accountOf(entry, accounts);
                          return account.isDefault ? null : ` · ${account.emoji} ${account.name}`;
                        })()}
                      {(() => {
                        const paid = linkedMove(moves, entry.id);
                        const envelope = paid && envelopes.find((e) => e.id === paid.envelopeId);
                        return envelope ? ` · payée par l’enveloppe ${envelope.emoji} ${envelope.name}` : null;
                      })()}
                    </span>
                    {known && (
                      <button
                        type="button"
                        className="budget-row-known"
                        title={known.description || 'Ce que cache ce libellé'}
                        onClick={() => explain(entry)}
                      >
                        💬 {known.label || known.description}
                        {known.label && known.description && <span className="budget-row-known-more"> — {known.description}</span>}
                      </button>
                    )}
                    {entry.note && !isNoting && <span className="budget-row-note">📝 {entry.note}</span>}
                    {isNoting && (
                      <input
                        className="budget-row-note-input"
                        aria-label={`Note de « ${entry.label} »`}
                        autoFocus
                        value={noting.text}
                        maxLength={1000}
                        placeholder="Ma part du canapé, cadeau de Julia…"
                        onChange={(e) => setNoting({ id: entry.id, text: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            noteDecided.current = true;
                            void saveNote();
                          }
                          if (e.key === 'Escape') {
                            noteDecided.current = true;
                            setNoting(null);
                          }
                        }}
                        onBlur={() => {
                          if (noteDecided.current) noteDecided.current = false;
                          else void saveNote();
                        }}
                      />
                    )}
                  </span>
                  <span
                    className={`budget-row-amount${entry.amountCents < 0 ? ' negative' : ' positive'}`}
                  >
                    {formatCents(entry.amountCents)}
                  </span>
                  <span className="budget-row-actions">
                    {!known && (
                      <button
                        className="btn btn-ghost btn-sm budget-row-icon"
                        onClick={() => explain(entry)}
                        title="C’est quoi ? Retenir ce que cache ce libellé"
                        aria-label={`C’est quoi « ${entry.label} » ?`}
                      >
                        ⓘ
                      </button>
                    )}
                    <button
                      className="btn btn-ghost btn-sm budget-row-icon"
                      onClick={() => {
                        noteDecided.current = false;
                        setNoting({ id: entry.id, text: entry.note });
                      }}
                      title={entry.note ? 'Modifier la note' : 'Ajouter une note'}
                      aria-label={`Note de « ${entry.label} »`}
                    >
                      📝
                    </button>
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

      {explaining && (
        <RuleEditor
          rule={explaining.rule}
          initialPattern={explaining.pattern}
          asFiche
          rules={rules}
          categories={categories}
          entries={history}
          onCancel={() => setExplaining(null)}
          onSave={saveFiche}
        />
      )}

      {editing === 'bulk' && (
        <BulkEntryEditor
          categories={categories}
          rules={rules}
          accounts={accounts}
          defaultAccountId={defaultAccountId}
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
          accounts={accounts}
          defaultAccountId={defaultAccountId}
          onCancel={() => setEditing(null)}
          onSave={saveEntry}
          onSwitchToBulk={() => setEditing('bulk')}
        />
      )}
    </div>
  );
}
