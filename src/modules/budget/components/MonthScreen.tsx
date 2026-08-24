import { useCallback, useEffect, useState } from 'react';
import { budgetStore } from '../data';
import { currentMonthKey, monthKeyOf, monthLabel, shiftMonthKey } from '../lib/month';
import { computeMonthlyBreakdown } from '../lib/monthlyBreakdown';
import { formatCents } from '../lib/amount';
import type { BudgetCategory, BudgetEntry } from '../lib/types';
import { EntriesView } from './EntriesView';
import { PieChart } from './PieChart';

function categoryName(categories: BudgetCategory[], id: string | null): string {
  if (id === null) return 'À classer';
  return categories.find((c) => c.id === id)?.name ?? 'À classer';
}

/**
 * L'écran du mois (étape 4, docs/etude-astra.md §5) : « le total dépensé,
 * le camembert par catégorie, et le sélecteur de mois. Cliquer une part
 * filtre la liste en dessous. » — et la liste, l'outil de correction,
 * reste sous le camembert plutôt que dans un onglet séparé.
 */
export function MonthScreen({
  categories,
  onError,
  reloadToken,
}: {
  categories: BudgetCategory[];
  onError: (message: string) => void;
  reloadToken: number;
}) {
  const [monthKey, setMonthKey] = useState(currentMonthKey);
  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  /** `undefined` = pas de filtre ; une valeur (dont `null` pour « à classer ») = filtré sur cette part. */
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      setEntries(await budgetStore.listEntries());
      onError('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [refresh, reloadToken]);

  // Changer de mois efface un filtre de part qui n'aurait plus de sens
  // (une part qui n'existe pas forcément dans le nouveau mois).
  useEffect(() => {
    setSelectedCategoryId(undefined);
  }, [monthKey]);

  function toggleSlice(categoryId: string | null) {
    setSelectedCategoryId((current) => (current !== undefined && current === categoryId ? undefined : categoryId));
  }

  if (loading) return <p>Chargement…</p>;

  const monthEntries = entries.filter((e) => monthKeyOf(e.day) === monthKey);
  const breakdown = computeMonthlyBreakdown(entries, categories, monthKey);
  const visibleEntries =
    selectedCategoryId === undefined ? monthEntries : monthEntries.filter((e) => e.categoryId === selectedCategoryId);
  const totalLabel = breakdown.totalSpentCents === 0 ? '0,00 €' : formatCents(-breakdown.totalSpentCents);

  return (
    <div className="budget-month">
      <div className="budget-month-selector">
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setMonthKey((m) => shiftMonthKey(m, -1))}
          aria-label="Mois précédent"
        >
          ←
        </button>
        <span className="budget-month-label">{monthLabel(monthKey)}</span>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setMonthKey((m) => shiftMonthKey(m, 1))}
          aria-label="Mois suivant"
        >
          →
        </button>
      </div>

      <div className="budget-month-total">
        <span className="budget-month-total-label">Total dépensé</span>
        <span className="budget-month-total-amount">{totalLabel}</span>
      </div>

      <PieChart
        slices={breakdown.slices}
        totalCents={breakdown.totalSpentCents}
        selectedCategoryId={selectedCategoryId}
        onSelect={toggleSlice}
      />

      <div className="budget-month-list">
        {selectedCategoryId !== undefined && (
          <div className="budget-filter-notice">
            <span>Filtré sur « {categoryName(categories, selectedCategoryId)} »</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedCategoryId(undefined)}>
              Retirer le filtre
            </button>
          </div>
        )}

        <EntriesView
          entries={visibleEntries}
          categories={categories}
          onError={onError}
          onChanged={refresh}
          emptyTitle={monthEntries.length === 0 ? 'Aucune écriture ce mois-ci' : 'Aucune écriture pour cette part'}
          emptyBody={
            monthEntries.length === 0
              ? "Une écriture, c'est une dépense ou une entrée d'argent : un jour, un libellé, un montant, et une catégorie — ou « à classer » si tu n'es pas encore fixé."
              : undefined
          }
        />
      </div>
    </div>
  );
}
