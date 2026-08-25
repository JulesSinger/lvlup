import { useCallback, useEffect, useState } from 'react';
import { budgetStore } from '../data';
import { currentMonthKey, monthKeyOf, monthLabel, shiftMonthKey } from '../lib/month';
import { computeMonthlyBreakdown } from '../lib/monthlyBreakdown';
import { centsToInputValue, formatCents } from '../lib/amount';
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
  const netCents = breakdown.totalIncomeCents - breakdown.totalSpentCents;

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

      {/* Trois chiffres côte à côte plutôt qu'un seul total : « combien j'ai
          dépensé » ne dit pas si le mois est positif, et un solde seul sans
          les deux montants qui le composent n'explique rien (retour direct
          de Jules — voir CLAUDE.md §8). */}
      <div className="budget-month-summary">
        <div className="budget-month-stat">
          <span className="budget-month-stat-label">Dépensé</span>
          <span className="budget-month-stat-amount expense">
            {breakdown.totalSpentCents === 0 ? '0,00 €' : formatCents(-breakdown.totalSpentCents)}
          </span>
        </div>
        <div className="budget-month-stat">
          <span className="budget-month-stat-label">Entré</span>
          {/* Magnitude, jamais de signe forcé — contrairement au solde ci-
              dessous, une entrée n'a rien à contraster : elle est toujours
              positive par construction (§5 bis de monthlyBreakdown.ts). */}
          <span className="budget-month-stat-amount income">{centsToInputValue(breakdown.totalIncomeCents)} €</span>
        </div>
        <div className="budget-month-stat">
          <span className="budget-month-stat-label">Solde</span>
          {/* `.negative`/`.positive` plutôt que `.expense`/`.income` : ces
              deux dernières classes marquent une nature fixe (Dépensé est
              toujours en rouge, Entré toujours en vert), alors que le solde
              change de couleur selon son signe — les confondre ferait
              matcher les deux stats sur un même sélecteur CSS ou e2e. */}
          <span
            className={`budget-month-stat-amount budget-month-stat-net${netCents < 0 ? ' negative' : netCents > 0 ? ' positive' : ''}`}
          >
            {netCents === 0 ? '0,00 €' : formatCents(netCents)}
          </span>
        </div>
      </div>

      {/* Deux camemberts côte à côte sur un écran large plutôt qu'un seul
          centré : l'espace disponible restait à moitié vide, et « dépensé »
          seul ne montrait pas d'où vient l'argent (même retour). Ils passent
          l'un sous l'autre en dessous de 900px (voir la media query). */}
      <div className="budget-pies-grid">
        <div className="budget-pie-card budget-pie-card-expense">
          <h2 className="budget-pie-card-title">Dépenses</h2>
          <PieChart
            slices={breakdown.slices}
            totalCents={breakdown.totalSpentCents}
            selectedCategoryId={selectedCategoryId}
            onSelect={toggleSlice}
            variant="expense"
          />
        </div>
        <div className="budget-pie-card budget-pie-card-income">
          <h2 className="budget-pie-card-title">Entrées</h2>
          <PieChart
            slices={breakdown.incomeSlices}
            totalCents={breakdown.totalIncomeCents}
            selectedCategoryId={selectedCategoryId}
            onSelect={toggleSlice}
            variant="income"
          />
        </div>
      </div>

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
