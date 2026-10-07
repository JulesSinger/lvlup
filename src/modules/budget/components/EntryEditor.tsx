import { useEffect, useState } from 'react';
import { centsToInputValue, parsePositiveAmountToCents } from '../lib/amount';
import { matchRule } from '../lib/boursobankImport';
import { frequentCategoryIds, menuKindOrder } from '../lib/categoryPicker';
import { suggestedPattern, validateRulePattern } from '../lib/classify';
import { availableForEntry, linkedMove, withdrawalProblem } from '../lib/envelopes';
import type { BudgetCategory, BudgetEntry, BudgetEntryInput, BudgetEnvelope, BudgetEnvelopeMove, BudgetRule } from '../lib/types';
import { CategorySelect } from './CategorySelect';

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Props {
  entry: BudgetEntry | null;
  categories: BudgetCategory[];
  /** Pour la suggestion par mots-clés (même moteur que l'import, voir `matchRule`). */
  rules: BudgetRule[];
  /**
   * Tout l'historique des écritures : les catégories les plus utilisées dans
   * le sens choisi (dépense ou entrée) en sont tirées, en accès rapide.
   */
  history: BudgetEntry[];
  onCancel: () => void;
  /**
   * `rememberPattern` : une règle à créer avec cette écriture, pour que les
   * prochains relevés rangent tout seuls le même libellé.
   */
  onSave: (input: BudgetEntryInput, rememberPattern?: string, envelopeId?: string | null) => Promise<void>;
  /** Les enveloppes : une dépense peut être payée par l'une d'elles (§6 bis). */
  envelopes?: BudgetEnvelope[];
  moves?: BudgetEnvelopeMove[];
  /** Passer à la saisie de plusieurs écritures d'un coup (nouvelle écriture seulement). */
  onSwitchToBulk?: () => void;
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
export function EntryEditor({ entry, categories, rules, history, onCancel, onSave, envelopes = [], moves = [], onSwitchToBulk }: Props) {
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
  const existingLink = entry ? linkedMove(moves, entry.id) : null;
  const [envelopeId, setEnvelopeId] = useState(existingLink?.envelopeId ?? '');
  /** Retenir le choix pour les prochains relevés : proposé quand on range une écriture « à classer ». */
  const [remember, setRemember] = useState(false);
  const pattern = suggestedPattern(label.trim());
  const canRemember =
    isEdit && entry.categoryId === null && categoryId !== '' && validateRulePattern(pattern, rules) === null;

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

  const direction = isExpense ? 'expense' : 'income';
  const frequentCategories = frequentCategoryIds(history, categories, direction)
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
    if (isExpense && envelopeId) {
      const tooMuch = withdrawalProblem(positive, availableForEntry(envelopeId, moves, entry?.id ?? null));
      if (tooMuch) {
        setError(tooMuch);
        return;
      }
    }
    setSaving(true);
    setError('');
    try {
      await onSave(
        {
          day,
          label: trimmedLabel,
          amountCents: isExpense ? -positive : positive,
          categoryId: categoryId || null,
          // Une écriture importée le reste quand on la corrige.
          source: entry?.source ?? 'manuelle',
        },
        canRemember && remember ? pattern : undefined,
        // Une entrée d'argent n'est jamais payée par une enveloppe ; sans enveloppe du tout, rien à dire.
        envelopes.length > 0 || existingLink ? (isExpense && envelopeId ? envelopeId : null) : undefined,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  }

  // Un clic à côté ne ferme pas : il effaçait une saisie en cours. On ferme
  // par ✕, Annuler ou Échap.
  return (
    <div className="overlay">
      <div
        className="modal budget-entry-editor"
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-head">
          <span className="modal-title">{isEdit ? "Modifier l'écriture" : 'Nouvelle écriture'}</span>
          {!isEdit && onSwitchToBulk && (
            <button type="button" className="btn btn-ghost btn-sm budget-head-action" onClick={onSwitchToBulk}>
              Plusieurs à la fois
            </button>
          )}
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

            <CategorySelect
              id="budget-entry-category"
              value={categoryId}
              categories={categories}
              kindOrder={menuKindOrder(direction)}
              onChange={(id) => {
                setCategoryId(id);
                setCategoryTouched(true);
              }}
            />
          </div>

          {isExpense && envelopes.length > 0 && (
            <div className="field">
              <label htmlFor="budget-entry-envelope">Payée avec une enveloppe</label>
              <select id="budget-entry-envelope" value={envelopeId} onChange={(e) => setEnvelopeId(e.target.value)}>
                <option value="">Aucune</option>
                {envelopes.map((env) => (
                  <option key={env.id} value={env.id}>
                    {env.emoji} {env.name} — {centsToInputValue(availableForEntry(env.id, moves, entry?.id ?? null))} €
                  </option>
                ))}
              </select>
              <span className="field-hint">Le montant est retiré de l’enveloppe ; le total épargné, lui, ne bouge pas.</span>
            </div>
          )}

          {canRemember && (
            <label className="budget-remember">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span>
                Retenir : ranger aussi les prochaines écritures « {pattern} » dans cette catégorie
              </span>
            </label>
          )}

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
