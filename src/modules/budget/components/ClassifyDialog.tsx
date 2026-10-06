import { useEffect, useState } from 'react';
import { formatCents } from '../lib/amount';
import { suggestedPattern, unclassifiedGroups, validateRulePattern, type UnclassifiedGroup } from '../lib/classify';
import type { BudgetCategory, BudgetEntry, BudgetRule } from '../lib/types';
import { CategorySelect } from './CategorySelect';

interface Props {
  entries: readonly BudgetEntry[];
  categories: readonly BudgetCategory[];
  rules: readonly BudgetRule[];
  onClose: () => void;
  /** Range le groupe ; `pattern` : une règle à créer pour les relevés suivants. */
  onClassify: (group: UnclassifiedGroup, categoryId: string, pattern: string | null) => Promise<void>;
}

/**
 * Classer les « à classer », tous mois confondus, par groupes de même
 * libellé : un choix de catégorie range d'un coup toutes les écritures du
 * groupe, et « retenir » crée la règle qui rangera les relevés suivants.
 */
export function ClassifyDialog({ entries, categories, rules, onClose, onClassify }: Props) {
  const groups = unclassifiedGroups(entries);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay">
      <div className="modal budget-classify" role="dialog" aria-modal="true" aria-label="Classer les écritures">
        <div className="modal-head">
          <span className="modal-title">À classer</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="modal-body">
          {groups.length === 0 ? (
            <p className="budget-rules-intro">Tout est rangé.</p>
          ) : (
            <>
              <p className="budget-rules-intro">
                {groups.reduce((n, g) => n + g.entries.length, 0)} écritures, regroupées par libellé. Choisis une catégorie : tout le groupe y
                va d’un coup.
              </p>
              <ul className="budget-classify-list">
                {groups.map((group) => (
                  <GroupRow key={group.key} group={group} categories={categories} rules={rules} onClassify={onClassify} />
                ))}
              </ul>
            </>
          )}
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

function GroupRow({
  group,
  categories,
  rules,
  onClassify,
}: {
  group: UnclassifiedGroup;
  categories: readonly BudgetCategory[];
  rules: readonly BudgetRule[];
  onClassify: Props['onClassify'];
}) {
  const [categoryId, setCategoryId] = useState('');
  const [remember, setRemember] = useState(false);
  const [pattern, setPattern] = useState(() => suggestedPattern(group.label));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const days = group.entries.map((e) => e.day).sort();

  async function classify() {
    if (!categoryId) return setError('Choisis une catégorie.');
    if (remember) {
      const problem = validateRulePattern(pattern, rules);
      if (problem) return setError(problem);
    }
    setSaving(true);
    setError('');
    try {
      await onClassify(group, categoryId, remember ? pattern.trim() : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Classement impossible.');
      setSaving(false);
    }
  }

  return (
    <li className="budget-classify-group" aria-label={group.label}>
      <div className="budget-classify-head">
        <b>{group.label}</b>
        <span className="budget-classify-meta">
          {group.entries.length} écriture{group.entries.length > 1 ? 's' : ''} · {formatCents(group.totalCents)}
          {group.entries.length > 1 ? ` · du ${days[0]} au ${days[days.length - 1]}` : ` · ${days[0]}`}
        </span>
      </div>
      <div className="budget-classify-actions">
        <CategorySelect value={categoryId} onChange={setCategoryId} categories={categories} emptyLabel="Choisir une catégorie…" ariaLabel={`Catégorie pour ${group.label}`} />
        <button className="btn btn-sm btn-primary" disabled={saving} onClick={() => void classify()}>
          Classer
        </button>
      </div>
      <label className="budget-remember">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        <span>Retenir pour les prochains relevés</span>
      </label>
      {remember && (
        <input className="budget-classify-pattern" aria-label={`Motif de la règle pour ${group.label}`} value={pattern} onChange={(e) => setPattern(e.target.value)} />
      )}
      {error && <div className="notice error">{error}</div>}
    </li>
  );
}
