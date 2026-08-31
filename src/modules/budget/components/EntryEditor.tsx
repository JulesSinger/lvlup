import { useEffect, useMemo, useState } from 'react';
import { centsToInputValue, parsePositiveAmountToCents } from '../lib/amount';
import { matchRule } from '../lib/boursobankImport';
import { BUDGET_CATEGORY_KINDS, CATEGORY_KIND_LABELS } from '../lib/types';
import type { BudgetCategory, BudgetEntry, BudgetEntryInput, BudgetRule } from '../lib/types';

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Props {
  entry: BudgetEntry | null;
  categories: BudgetCategory[];
  /** Pour la suggestion par mots-clés (même moteur que l'import, voir `matchRule`). */
  rules: BudgetRule[];
  /** Les catégories les plus utilisées, en accès rapide au-dessus du menu déroulant. */
  frequentCategoryIds: string[];
  onCancel: () => void;
  onSave: (input: BudgetEntryInput) => Promise<void>;
}

/**
 * Ajout manuel — un formulaire court : jour, libellé, montant, catégorie
 * (docs/etude-astra.md §5). Le montant se tape toujours positif ; c'est le
 * bouton « Dépense »/« Entrée » qui porte le signe, pour ne jamais faire
 * deviner à l'utilisateur s'il doit taper un `-`.
 *
 * Trouver la bonne catégorie était devenu pénible avec un simple menu à
 * plat (amélioration post-V1, 31/08/2026) : le menu est maintenant groupé
 * par nature, une suggestion se pré-sélectionne d'après les règles d'import
 * existantes dès que le libellé matche l'une d'elles, et les catégories les
 * plus utilisées sont proposées en pastilles avant même d'ouvrir le menu.
 */
export function EntryEditor({ entry, categories, rules, frequentCategoryIds, onCancel, onSave }: Props) {
  const isEdit = entry !== null;
  const [day, setDay] = useState(entry?.day ?? today());
  const [label, setLabel] = useState(entry?.label ?? '');
  const [isExpense, setIsExpense] = useState(entry ? entry.amountCents <= 0 : true);
  const [amountText, setAmountText] = useState(entry ? centsToInputValue(entry.amountCents) : '');
  const [categoryId, setCategoryId] = useState<string>(entry?.categoryId ?? '');
  /** Une fois vrai, la suggestion par mots-clés n'écrase plus le choix de l'utilisateur. */
  const [categoryTouched, setCategoryTouched] = useState(isEdit);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  // Suggestion par mots-clés : seulement pour une nouvelle écriture, et tant
  // que l'utilisateur n'a pas lui-même choisi une catégorie — une écriture en
  // cours de modification a déjà la sienne, elle ne doit jamais être
  // silencieusement remplacée pendant qu'on corrige le libellé.
  useEffect(() => {
    if (isEdit || categoryTouched) return;
    const rule = matchRule(label, rules);
    if (rule) setCategoryId(rule.categoryId);
  }, [label, rules, isEdit, categoryTouched]);

  const groupedCategories = useMemo(
    () =>
      BUDGET_CATEGORY_KINDS.map((kind) => ({
        kind,
        label: CATEGORY_KIND_LABELS[kind],
        items: categories.filter((c) => c.kind === kind),
      })).filter((group) => group.items.length > 0),
    [categories],
  );

  const frequentCategories = frequentCategoryIds
    .map((id) => categories.find((c) => c.id === id))
    .filter((c): c is BudgetCategory => c !== undefined);

  async function submit() {
    if (!day) {
      setError('Le jour est obligatoire.');
      return;
    }
    const trimmedLabel = label.trim();
    if (!trimmedLabel) {
      setError('Le libellé est obligatoire.');
      return;
    }
    const positive = parsePositiveAmountToCents(amountText);
    if (positive === null || positive === 0) {
      setError('Le montant doit être un nombre supérieur à zéro (ex. 12,50).');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({
        day,
        label: trimmedLabel,
        amountCents: isExpense ? -positive : positive,
        categoryId: categoryId || null,
        source: 'manuelle',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <div
        className="modal budget-entry-editor"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <span className="modal-title">{isEdit ? "Modifier l'écriture" : 'Nouvelle écriture'}</span>
          <button className="btn btn-ghost btn-sm" onClick={onCancel} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="row">
            <div className="field">
              <label htmlFor="budget-entry-day">Jour</label>
              <input
                id="budget-entry-day"
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Type</label>
              {/* Deux boutons simples plutôt qu'un `role="radiogroup"` : la
                  bascule n'a que deux états et un bouton pressé se comprend
                  sans sémantique ARIA supplémentaire. */}
              <div className="budget-kind-toggle" aria-label="Dépense ou entrée">
                <button
                  type="button"
                  aria-pressed={isExpense}
                  className={`btn btn-sm${isExpense ? ' selected' : ''}`}
                  onClick={() => setIsExpense(true)}
                >
                  − Dépense
                </button>
                <button
                  type="button"
                  aria-pressed={!isExpense}
                  className={`btn btn-sm${!isExpense ? ' selected' : ''}`}
                  onClick={() => setIsExpense(false)}
                >
                  + Entrée
                </button>
              </div>
            </div>
          </div>

          <div className="field">
            <label htmlFor="budget-entry-label">Libellé</label>
            <input
              id="budget-entry-label"
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Courses, restaurant, espèces…"
              autoFocus
            />
          </div>

          <div className="field">
            <label htmlFor="budget-entry-amount">Montant (€)</label>
            <input
              id="budget-entry-amount"
              type="text"
              inputMode="decimal"
              value={amountText}
              onChange={(e) => setAmountText(e.target.value)}
              placeholder="12,50"
            />
          </div>

          <div className="field">
            <label htmlFor="budget-entry-category">Catégorie</label>

            {frequentCategories.length > 0 && (
              <div className="budget-category-chips" role="group" aria-label="Catégories fréquentes">
                {frequentCategories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`budget-category-chip${categoryId === c.id ? ' on' : ''}`}
                    aria-pressed={categoryId === c.id}
                    onClick={() => {
                      setCategoryId(c.id);
                      setCategoryTouched(true);
                    }}
                  >
                    <span aria-hidden="true">{c.emoji}</span> {c.name}
                  </button>
                ))}
              </div>
            )}

            <select
              id="budget-entry-category"
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setCategoryTouched(true);
              }}
            >
              <option value="">À classer</option>
              {groupedCategories.map((group) => (
                <optgroup key={group.kind} label={group.label}>
                  {group.items.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji} {c.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {error && <div className="notice error">{error}</div>}
        </div>

        <div className="modal-foot">
          <button className="btn" onClick={onCancel}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={() => void submit()} disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
