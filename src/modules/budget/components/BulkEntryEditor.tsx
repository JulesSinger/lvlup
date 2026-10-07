import { useEffect, useState } from 'react';
import { centsToInputValue, parsePositiveAmountToCents } from '../lib/amount';
import { matchRule } from '../lib/boursobankImport';
import { isBlankRow, newBulkRow, validateBulkRows, type BulkRow } from '../lib/bulkEntries';
import { menuKindOrder } from '../lib/categoryPicker';
import type { BudgetCategory, BudgetEntryInput, BudgetRule } from '../lib/types';
import { CategorySelect } from './CategorySelect';

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const START_ROWS = 3;

/**
 * Plusieurs écritures d'un coup (demande de Jules, 07/10/2026) : un tableau
 * d'une ligne par écriture, plutôt que de rouvrir la fenêtre à chaque fois.
 * Volontairement plus court que la fenêtre d'une écriture : ni enveloppe, ni
 * règle à retenir — ces cas-là se règlent une écriture à la fois.
 *
 * Entrée dans le montant de la dernière ligne en ajoute une ; une nouvelle
 * ligne reprend le jour et le sens de la précédente. Les catégories se
 * proposent comme dans la fenêtre d'une écriture : par les règles d'après le
 * libellé, et dans le menu, ce qui va avec le sens d'abord.
 *
 * Rien de tapé ne se perd : Échap ne ferme que si tout est vide, et
 * « Annuler » demande confirmation dès qu'une ligne est remplie.
 */
export function BulkEntryEditor({
  categories,
  rules,
  onCancel,
  onSave,
}: {
  categories: BudgetCategory[];
  rules: BudgetRule[];
  onCancel: () => void;
  onSave: (inputs: BudgetEntryInput[]) => Promise<void>;
}) {
  const [rows, setRows] = useState<BulkRow[]>(() => {
    const first = newBulkRow(today());
    const list = [first];
    while (list.length < START_ROWS) list.push(newBulkRow(today(), list[list.length - 1]));
    return list;
  });
  const [focusKey, setFocusKey] = useState(rows[0].key);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const allBlank = rows.every(isBlankRow);

  function cancel() {
    if (!allBlank && !window.confirm('Abandonner les écritures saisies ?')) return;
    onCancel();
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && allBlank) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [allBlank, onCancel]);

  function patch(key: string, change: Partial<BulkRow>) {
    setRows((list) =>
      list.map((row) => {
        if (row.key !== key) return row;
        const next = { ...row, ...change };
        // Suggestion par mots-clés tant que la catégorie n'a pas été choisie à la main.
        if (change.label !== undefined && !next.categoryTouched) {
          next.categoryId = matchRule(next.label, rules)?.categoryId ?? '';
        }
        return next;
      }),
    );
    setErrors((current) => {
      if (!(key in current)) return current;
      const rest = { ...current };
      delete rest[key];
      return rest;
    });
  }

  function addRow() {
    const row = newBulkRow(today(), rows[rows.length - 1]);
    setRows([...rows, row]);
    setFocusKey(row.key);
  }

  function removeRow(key: string) {
    setRows((list) => (list.length > 1 ? list.filter((r) => r.key !== key) : [newBulkRow(today())]));
  }

  const filled = rows.filter((r) => !isBlankRow(r));
  // Le total de ce qui est déjà lisible : une ligne en cours de frappe n'y entre pas encore.
  const totalCents = filled.reduce((sum, row) => {
    const cents = parsePositiveAmountToCents(row.amountText) ?? 0;
    return sum + (row.isExpense ? -cents : cents);
  }, 0);

  async function submit() {
    const result = validateBulkRows(rows);
    if (Object.keys(result.errors).length > 0) {
      setErrors(result.errors);
      setError('Corrige les lignes signalées : rien n’a encore été enregistré.');
      return;
    }
    if (result.inputs.length === 0) {
      setError('Remplis au moins une ligne.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(result.inputs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  }

  return (
    <div className="overlay">
      <div className="modal budget-bulk-editor" role="dialog" aria-modal="true" aria-label="Plusieurs écritures">
        <div className="modal-head">
          <span className="modal-title">Plusieurs écritures</span>
          <button className="btn btn-ghost btn-sm" onClick={cancel} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <ol className="budget-bulk-rows">
            {rows.map((row, index) => {
              const last = index === rows.length - 1;
              return (
                <li key={row.key} className={`budget-bulk-row${errors[row.key] ? ' invalid' : ''}`}>
                  <input
                    type="date"
                    className="budget-bulk-day"
                    aria-label={`Jour, ligne ${index + 1}`}
                    value={row.day}
                    onChange={(e) => patch(row.key, { day: e.target.value })}
                  />
                  <div className="budget-kind-toggle budget-bulk-kind" aria-label={`Dépense ou entrée, ligne ${index + 1}`}>
                    <button
                      type="button"
                      aria-pressed={row.isExpense}
                      className={`btn btn-sm${row.isExpense ? ' selected' : ''}`}
                      onClick={() => patch(row.key, { isExpense: true })}
                      title="Dépense"
                    >
                      −
                    </button>
                    <button
                      type="button"
                      aria-pressed={!row.isExpense}
                      className={`btn btn-sm${!row.isExpense ? ' selected' : ''}`}
                      onClick={() => patch(row.key, { isExpense: false })}
                      title="Entrée"
                    >
                      +
                    </button>
                  </div>
                  <input
                    type="text"
                    className="budget-bulk-label"
                    aria-label={`Libellé, ligne ${index + 1}`}
                    placeholder="Libellé"
                    value={row.label}
                    autoFocus={row.key === focusKey}
                    onChange={(e) => patch(row.key, { label: e.target.value })}
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    className="budget-bulk-amount"
                    aria-label={`Montant, ligne ${index + 1}`}
                    placeholder="0,00"
                    value={row.amountText}
                    onChange={(e) => patch(row.key, { amountText: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && last) {
                        e.preventDefault();
                        addRow();
                      }
                    }}
                  />
                  <span className="budget-bulk-category">
                    <CategorySelect
                      ariaLabel={`Catégorie, ligne ${index + 1}`}
                      value={row.categoryId}
                      categories={categories}
                      kindOrder={menuKindOrder(row.isExpense ? 'expense' : 'income')}
                      onChange={(id) => patch(row.key, { categoryId: id, categoryTouched: true })}
                    />
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm budget-bulk-remove"
                    onClick={() => removeRow(row.key)}
                    aria-label={`Retirer la ligne ${index + 1}`}
                  >
                    ✕
                  </button>
                  {errors[row.key] && <span className="budget-bulk-error">{errors[row.key]}</span>}
                </li>
              );
            })}
          </ol>

          <button type="button" className="btn btn-sm" onClick={addRow}>
            + Une ligne
          </button>
          <span className="field-hint budget-bulk-hint">
            Entrée dans le dernier montant ajoute une ligne. Les lignes vides sont ignorées.
          </span>

          {error && <div className="notice error">{error}</div>}
        </div>

        <div className="modal-foot">
          <span className="budget-bulk-summary" role="status">
            {filled.length > 0 &&
              `${filled.length} écriture${filled.length > 1 ? 's' : ''} · ${totalCents < 0 ? '−' : '+'}${centsToInputValue(totalCents)} €`}
          </span>
          <button className="btn" onClick={cancel}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={() => void submit()} disabled={saving}>
            {saving
              ? 'Enregistrement…'
              : filled.length > 1
                ? `Enregistrer les ${filled.length}`
                : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
