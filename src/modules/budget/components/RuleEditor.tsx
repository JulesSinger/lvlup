import { useEffect, useState } from 'react';
import { unclassifiedMatching, validateRulePattern } from '../lib/classify';
import type { BudgetCategory, BudgetEntry, BudgetRule } from '../lib/types';
import { CategorySelect } from './CategorySelect';

interface Props {
  /** `null` : une nouvelle règle */
  rule: BudgetRule | null;
  rules: readonly BudgetRule[];
  categories: readonly BudgetCategory[];
  /** Toutes les écritures, pour proposer de ranger les « à classer » qui correspondent. */
  entries: readonly BudgetEntry[];
  onCancel: () => void;
  onSave: (input: { pattern: string; categoryId: string }, alsoClassify: string[]) => Promise<void>;
  onDelete?: () => Promise<void>;
}

/**
 * Une règle de classement : « un libellé qui contient ce motif va dans cette
 * catégorie ». Elle range les relevés suivants à l'import ; ici, elle
 * propose aussi de ranger d'un coup les « à classer » qui correspondent déjà.
 */
export function RuleEditor({ rule, rules, categories, entries, onCancel, onSave, onDelete }: Props) {
  const [pattern, setPattern] = useState(rule?.pattern ?? '');
  const [categoryId, setCategoryId] = useState(rule?.categoryId ?? '');
  const [alsoClassify, setAlsoClassify] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const matching = categoryId ? unclassifiedMatching(entries, pattern) : [];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  async function run(action: () => Promise<void>) {
    setSaving(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  }

  function submit() {
    const problem = validateRulePattern(pattern, rules, rule?.id);
    if (problem) return setError(problem);
    if (!categoryId) return setError('Choisis la catégorie où ranger ces écritures.');
    void run(() => onSave({ pattern: pattern.trim(), categoryId }, alsoClassify ? matching.map((e) => e.id) : []));
  }

  return (
    <div className="overlay">
      <div className="modal budget-rule-editor" role="dialog" aria-modal="true" aria-label={rule ? 'Modifier la règle' : 'Nouvelle règle'}>
        <div className="modal-head">
          <span className="modal-title">{rule ? 'Modifier la règle' : 'Nouvelle règle'}</span>
          <button className="btn btn-ghost btn-sm" onClick={onCancel} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label htmlFor="budget-rule-pattern">Le libellé contient</label>
            <input id="budget-rule-pattern" value={pattern} placeholder="NETFLIX, LECLERC, EDF…" onChange={(e) => setPattern(e.target.value)} autoFocus />
            <span className="field-hint">Sans tenir compte des majuscules. À l’import, c’est le libellé complet de la banque qui est comparé.</span>
          </div>
          <div className="field">
            <label htmlFor="budget-rule-category">Ranger dans</label>
            <CategorySelect id="budget-rule-category" value={categoryId} onChange={setCategoryId} categories={categories} emptyLabel="Choisir une catégorie…" />
          </div>
          {matching.length > 0 && (
            <label className="budget-remember">
              <input type="checkbox" checked={alsoClassify} onChange={(e) => setAlsoClassify(e.target.checked)} />
              <span>
                Ranger aussi {matching.length === 1 ? 'l’écriture « à classer » qui correspond' : `les ${matching.length} écritures « à classer » qui correspondent`}
              </span>
            </label>
          )}
          {error && <div className="notice error">{error}</div>}
        </div>
        <div className="modal-foot budget-rule-foot">
          {rule && onDelete && (
            <button
              className="btn btn-ghost btn-sm btn-danger"
              disabled={saving}
              onClick={() => window.confirm(`Supprimer la règle « ${rule.pattern} » ? Les écritures déjà rangées ne bougent pas.`) && void run(onDelete)}
            >
              Supprimer
            </button>
          )}
          <span className="budget-spacer" />
          <button className="btn" onClick={onCancel}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {rule ? 'Enregistrer' : 'Créer la règle'}
          </button>
        </div>
      </div>
    </div>
  );
}
