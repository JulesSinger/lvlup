import { useCallback, useEffect, useState } from 'react';
import { budgetStore } from '../data';
import type { BudgetCategory, BudgetEntry, BudgetRule } from '../lib/types';
import { isFiche } from '../lib/labels';
import { RuleEditor, type RuleInput } from './RuleEditor';

/**
 * Le carnet des libellés et les règles de classement (docs/etude-astra.md §18) :
 * une seule liste, puisqu'un motif ne fait qu'une ligne — ce qu'il cache (un
 * nom, une description), où le ranger, ou les deux.
 *
 * Les règles de classement, enfin visibles : jusqu'ici une règle se créait
 * en cochant une case à l'import, et plus rien ne permettait de la voir, la
 * corriger ou la supprimer — une règle créée par erreur rangeait mal chaque
 * relevé suivant, pour toujours.
 */
export function RulesSection({ categories, onError, reloadToken }: { categories: BudgetCategory[]; onError: (message: string) => void; reloadToken: number }) {
  const [rules, setRules] = useState<BudgetRule[]>([]);
  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [editing, setEditing] = useState<BudgetRule | 'new' | null>(null);
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [nextRules, nextEntries] = await Promise.all([budgetStore.listRules(), budgetStore.listEntries()]);
      setRules(nextRules);
      setEntries(nextEntries);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Chargement impossible.');
    }
  }, [onError]);

  useEffect(() => {
    void refresh();
  }, [refresh, reloadToken]);

  const category = (id: string | null) => (id ? categories.find((c) => c.id === id) : undefined);
  const sorted = [...rules].sort((a, b) => (a.label || a.pattern).localeCompare(b.label || b.pattern, 'fr', { sensitivity: 'base' }));

  async function save(input: RuleInput, alsoClassify: string[]) {
    if (editing && editing !== 'new') await budgetStore.updateRule(editing.id, input);
    else await budgetStore.createRule({ ...input, priority: 10 });
    if (alsoClassify.length > 0 && input.categoryId) await budgetStore.setEntriesCategory(alsoClassify, input.categoryId);
    setEditing(null);
    setNotice(alsoClassify.length > 0 ? `Enregistré, ${alsoClassify.length} écriture${alsoClassify.length > 1 ? 's' : ''} rangée${alsoClassify.length > 1 ? 's' : ''}.` : 'Enregistré.');
    await refresh();
  }

  return (
    <section className="budget-rules" aria-label="Règles de classement">
      <h2 className="budget-rules-title">Qui est qui, et règles de classement</h2>
      <p className="budget-rules-intro">
        Ce que cache un libellé de banque (« COMPTOIR DE STA » = la buvette de l’ASNL), affiché sous chaque écriture qui le
        contient ; et, si tu veux, la catégorie où ranger les suivantes à l’import. La plus prioritaire l’emporte quand
        plusieurs correspondent.
      </p>
      {sorted.length === 0 ? (
        <p className="budget-rules-intro">
          Rien pour l’instant : « C’est quoi ? » sur une écriture, une règle à l’import, ou ici.
        </p>
      ) : (
        <ul className="budget-list">
          {sorted.map((rule) => {
            const c = category(rule.categoryId);
            return (
              <li key={rule.id} className="budget-row budget-rule-row">
                <span className="budget-rule-pattern">
                  « {rule.pattern} »
                  {isFiche(rule) && (
                    <span className="budget-rule-fiche">
                      {rule.label && <b>{rule.label}</b>}
                      {rule.label && rule.description && ' — '}
                      {rule.description}
                    </span>
                  )}
                </span>
                <span className="budget-rule-arrow" aria-hidden="true">
                  →
                </span>
                <span className="budget-row-swatch" style={{ background: c?.color ?? 'var(--surface-2)' }} aria-hidden="true">
                  {rule.categoryId ? (c?.emoji ?? '❔') : '·'}
                </span>
                <span className="budget-row-name">{rule.categoryId ? (c?.name ?? 'Catégorie supprimée') : 'Pas rangée'}</span>
                <span className="budget-row-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(rule)} aria-label={`Modifier la règle ${rule.pattern}`}>
                    Modifier
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <button className="btn btn-sm budget-rules-add" onClick={() => setEditing('new')}>
        + Nouvelle fiche ou règle
      </button>
      {notice && (
        <div className="notice success" role="status">
          {notice}
        </div>
      )}
      {editing !== null && (
        <RuleEditor
          rule={editing === 'new' ? null : editing}
          rules={rules}
          categories={categories}
          entries={entries}
          onCancel={() => setEditing(null)}
          onSave={save}
          onDelete={
            editing === 'new'
              ? undefined
              : async () => {
                  await budgetStore.deleteRule(editing.id);
                  setEditing(null);
                  setNotice('Règle supprimée. Les écritures déjà rangées ne bougent pas.');
                  await refresh();
                }
          }
        />
      )}
    </section>
  );
}
