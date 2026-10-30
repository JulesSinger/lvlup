import { useEffect, useState } from 'react';
import { unclassifiedMatching } from '../lib/classify';
import { ficheProblem } from '../lib/labels';
import type { BudgetCategory, BudgetEntry, BudgetRule } from '../lib/types';
import { RULE_DESCRIPTION_MAX, RULE_LABEL_MAX } from '../lib/types';
import { CategorySelect } from './CategorySelect';

export interface RuleInput {
  pattern: string;
  categoryId: string | null;
  label: string;
  description: string;
}

interface Props {
  /** `null` : une nouvelle fiche ou règle */
  rule: BudgetRule | null;
  /** Pour une nouvelle : le motif proposé (« C'est quoi ? » depuis une écriture). */
  initialPattern?: string;
  /** Ouvert pour dire ce que c'est (« C'est quoi ? ») plutôt que pour ranger. */
  asFiche?: boolean;
  rules: readonly BudgetRule[];
  categories: readonly BudgetCategory[];
  /** Toutes les écritures, pour proposer de ranger les « à classer » qui correspondent. */
  entries: readonly BudgetEntry[];
  onCancel: () => void;
  onSave: (input: RuleInput, alsoClassify: string[]) => Promise<void>;
  onDelete?: () => Promise<void>;
}

/**
 * Une ligne du carnet des libellés (docs/etude-astra.md §18) : un motif du
 * libellé de banque, et ce qu'on veut en savoir — un nom lisible, une
 * description, une catégorie où ranger. L'un, l'autre, ou tout : « ranger »
 * et « se souvenir » sont la même ligne, pour un même motif.
 *
 * Avec une catégorie, elle range les relevés suivants à l'import ; ici, elle
 * propose aussi de ranger d'un coup les « à classer » qui correspondent déjà.
 */
export function RuleEditor({ rule, initialPattern = '', asFiche = false, rules, categories, entries, onCancel, onSave, onDelete }: Props) {
  const [pattern, setPattern] = useState(rule?.pattern ?? initialPattern);
  const [label, setLabel] = useState(rule?.label ?? '');
  const [description, setDescription] = useState(rule?.description ?? '');
  const [categoryId, setCategoryId] = useState(rule?.categoryId ?? '');
  const [alsoClassify, setAlsoClassify] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const matching = categoryId ? unclassifiedMatching(entries, pattern) : [];
  /** Les écritures que la fiche décrira : de quoi vérifier que le motif vise juste. */
  const described = pattern.trim().length >= 3 ? unclassifiedMatching(entries.map((e) => ({ ...e, categoryId: null })), pattern) : [];

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
    const input: RuleInput = { pattern: pattern.trim(), categoryId: categoryId || null, label: label.trim(), description: description.trim() };
    const problem = ficheProblem(input, rules, rule?.id);
    if (problem) return setError(problem);
    void run(() => onSave(input, alsoClassify ? matching.map((e) => e.id) : []));
  }

  const title = rule ? (asFiche || rule.label || rule.description ? 'Ce que cache ce libellé' : 'Modifier la règle') : asFiche ? 'C’est quoi ?' : 'Nouvelle règle';

  return (
    <div className="overlay">
      <div className="modal budget-rule-editor" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <span className="modal-title">{title}</span>
          <button className="btn btn-ghost btn-sm" onClick={onCancel} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label htmlFor="budget-rule-pattern">Le libellé contient</label>
            <input
              id="budget-rule-pattern"
              value={pattern}
              placeholder="COMPTOIR DE STA, NETFLIX, LECLERC…"
              onChange={(e) => setPattern(e.target.value)}
              autoFocus={!asFiche}
            />
            <span className="field-hint">
              Sans tenir compte des majuscules.
              {described.length > 0 && ` ${described.length} écriture${described.length > 1 ? 's' : ''} déjà concernée${described.length > 1 ? 's' : ''}.`}
            </span>
          </div>
          <div className="field">
            <label htmlFor="budget-rule-label">C’est…</label>
            <input
              id="budget-rule-label"
              value={label}
              maxLength={RULE_LABEL_MAX}
              placeholder="Buvette ASNL"
              onChange={(e) => setLabel(e.target.value)}
              autoFocus={asFiche}
            />
          </div>
          <div className="field">
            <label htmlFor="budget-rule-description">Pour s’en souvenir</label>
            <textarea
              id="budget-rule-description"
              rows={2}
              value={description}
              maxLength={RULE_DESCRIPTION_MAX}
              placeholder="Le stade Marcel-Picot, les soirs de match"
              onChange={(e) => setDescription(e.target.value)}
            />
            <span className="field-hint">Affiché sous chaque écriture dont le libellé contient le motif, et trouvé par la recherche.</span>
          </div>
          <div className="field">
            <label htmlFor="budget-rule-category">Ranger dans</label>
            <CategorySelect
              id="budget-rule-category"
              value={categoryId}
              onChange={setCategoryId}
              categories={categories}
              emptyLabel="Ne pas ranger, seulement retenir"
            />
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
              onClick={() => window.confirm(`Supprimer « ${rule.label || rule.pattern} » ? Les écritures déjà rangées ne bougent pas.`) && void run(onDelete)}
            >
              Supprimer
            </button>
          )}
          <span className="budget-spacer" />
          <button className="btn" onClick={onCancel}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {rule ? 'Enregistrer' : asFiche ? 'Retenir' : 'Créer la règle'}
          </button>
        </div>
      </div>
    </div>
  );
}
