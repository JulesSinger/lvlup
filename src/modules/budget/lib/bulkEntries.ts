import { parsePositiveAmountToCents } from './amount';
import type { BudgetEntryInput } from './types';

/**
 * Saisir plusieurs écritures d'un coup (demande de Jules, 07/10/2026) : le
 * ticket de la semaine, trois remboursements, des espèces oubliées. Chaque
 * ligne du tableau est une écriture ; ce fichier dit quand une ligne compte,
 * et ce qu'elle devient.
 */

export interface BulkRow {
  /** Identifiant de la ligne à l'écran, jamais enregistré. */
  key: string;
  day: string;
  label: string;
  isExpense: boolean;
  amountText: string;
  /** `''` : à classer. */
  categoryId: string;
  /** Une fois vrai, la suggestion par mots-clés n'écrase plus le choix fait. */
  categoryTouched: boolean;
}

let counter = 0;

/**
 * Une ligne neuve reprend le jour et le sens de la précédente : on saisit
 * le plus souvent une série du même jour, ou une série de dépenses.
 */
export function newBulkRow(day: string, previous?: BulkRow): BulkRow {
  counter += 1;
  return {
    key: `row-${counter}`,
    day: previous?.day ?? day,
    label: '',
    isExpense: previous?.isExpense ?? true,
    amountText: '',
    categoryId: '',
    categoryTouched: false,
  };
}

/** Une ligne sans libellé ni montant est ignorée : une ligne de trop ne bloque rien. */
export function isBlankRow(row: BulkRow): boolean {
  return row.label.trim() === '' && row.amountText.trim() === '';
}

export interface BulkValidation {
  inputs: BudgetEntryInput[];
  /** Erreur par ligne (clé de la ligne) — rien n'est enregistré tant qu'il en reste une. */
  errors: Record<string, string>;
}

/**
 * Tout ou rien : une ligne fausse empêche l'enregistrement des autres, pour
 * qu'on ne se demande jamais lesquelles sont parties.
 */
export function validateBulkRows(rows: readonly BulkRow[]): BulkValidation {
  const inputs: BudgetEntryInput[] = [];
  const errors: Record<string, string> = {};
  for (const row of rows) {
    if (isBlankRow(row)) continue;
    const label = row.label.trim();
    const positive = parsePositiveAmountToCents(row.amountText);
    if (!row.day) errors[row.key] = 'Le jour est obligatoire.';
    else if (!label) errors[row.key] = 'Le libellé est obligatoire.';
    else if (positive === null || positive === 0) errors[row.key] = 'Montant supérieur à zéro (ex. 12,50).';
    else
      inputs.push({
        day: row.day,
        label,
        amountCents: row.isExpense ? -positive : positive,
        categoryId: row.categoryId || null,
        source: 'manuelle',
      });
  }
  return { inputs: Object.keys(errors).length > 0 ? [] : inputs, errors };
}
