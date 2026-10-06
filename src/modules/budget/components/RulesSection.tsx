import { useCallback, useEffect, useState } from 'react';
import { budgetStore } from '../data';
import type { BudgetCategory, BudgetEntry, BudgetRule } from '../lib/types';
import { RuleEditor } from './RuleEditor';

/**
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

  const category = (id: string) => categories.find((c) => c.id === id);
  const sorted = [...rules].sort((a, b) => a.pattern.localeCompare(b.pattern, 'fr', { sensitivity: 'base' }));

  async function save(input: { pattern: string; categoryId: string }, alsoClassify: string[]) {
    if (editing && editing !== 'new') await budgetStore.updateRule(editing.id, input);
    else await budgetStore.createRule({ ...input, priority: 10 });
    if (alsoClassify.length > 0) await budgetStore.setEntriesCategory(alsoClassify, input.categoryId);
    setEditing(null);
    setNotice(alsoClassify.length > 0 ? `Règle enregistrée, ${alsoClassify.length} écriture${alsoClassify.length > 1 ? 's' : ''} rangée${alsoClassify.length > 1 ? 's' : ''}.` : 'Règle enregistrée.');
    await refresh();
  }

  return (
    <section className="budget-rules" aria-label="Règles de classement">
      <h2 className="budget-rules-title">Règles de classement</h2>
      <p className="budget-rules-intro">
        À l’import d’un relevé, une ligne dont le libellé contient un motif est rangée dans sa catégorie. La règle la plus
        prioritaire l’emporte quand plusieurs correspondent.
      </p>
      {sorted.length === 0 ? (
        <p className="budget-rules-intro">Aucune règle pour l’instant : elles se créent à l’import, en rangeant une écriture, ou ici.</p>
      ) : (
        <ul className="budget-list">
          {sorted.map((rule) => {
            const c = category(rule.categoryId);
            return (
              <li key={rule.id} className="budget-row budget-rule-row">
                <span className="budget-rule-pattern">« {rule.pattern} »</span>
                <span className="budget-rule-arrow" aria-hidden="true">
                  →
                </span>
                <span className="budget-row-swatch" style={{ background: c?.color ?? 'var(--surface-2)' }} aria-hidden="true">
                  {c?.emoji ?? '❔'}
                </span>
                <span className="budget-row-name">{c?.name ?? 'Catégorie supprimée'}</span>
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
        + Nouvelle règle
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
