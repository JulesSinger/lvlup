import { useCallback, useEffect, useMemo, useState } from 'react';
import { budgetStore } from '../data';
import { currentMonthKey } from '../lib/month';
import { computeSpendingTrend } from '../lib/spendingTrend';
import type { BudgetCategory, BudgetEntry } from '../lib/types';
import { SpendingTrendChart } from './SpendingTrendChart';

/** La vue « Total » n'a pas de couleur de catégorie à elle : l'accent partagé d'Atlas. */
const TOTAL_COLOR = '#f2c14e';

/**
 * L'onglet Évolution (demandé par Jules le 06/09/2026) : « avoir de la
 * visibilité sur ce que je dépense, mais aussi pouvoir faire évoluer ma
 * façon de dépenser et voir cette évolution au fil du temps ». Le camembert
 * du mois répond à « où est parti l'argent ce mois-ci » ; cet écran répond
 * à « et par rapport à d'habitude ».
 */
export function EvolutionScreen({
  categories,
  onError,
  reloadToken,
}: {
  categories: BudgetCategory[];
  onError: (message: string) => void;
  reloadToken: number;
}) {
  const [entries, setEntries] = useState<BudgetEntry[]>([]);
  const [loading, setLoading] = useState(true);
  /** `null` = Total de toutes les dépenses. */
  const [categoryId, setCategoryId] = useState<string | null>(null);

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

  // Seules les catégories qui peuvent porter une dépense : les mêmes qui
  // peuvent faire une part du camembert (transfert/épargne exclus, revenu
  // hors sujet ici), et seulement des catégories normales — une
  // sous-catégorie remonte déjà dans la courbe de son parent
  // (`computeSpendingTrend`), elle n'a pas sa propre entrée dans ce menu.
  const options = categories
    .filter((c) => c.parentId === null && c.kind !== 'transfert' && c.kind !== 'epargne' && c.kind !== 'revenu')
    .sort((a, b) => a.position - b.position);

  const selected = categoryId ? (categories.find((c) => c.id === categoryId) ?? null) : null;
  const trend = useMemo(
    () => computeSpendingTrend(entries, categories, categoryId, currentMonthKey()),
    [entries, categories, categoryId],
  );

  if (loading) return <p>Chargement…</p>;

  return (
    <div className="budget-evolution">
      <div className="field budget-evolution-picker">
        <label htmlFor="budget-evolution-category">Catégorie</label>
        <select
          id="budget-evolution-category"
          value={categoryId ?? ''}
          onChange={(e) => setCategoryId(e.target.value || null)}
        >
          <option value="">Total des dépenses</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.emoji} {c.name}
            </option>
          ))}
        </select>
      </div>

      <SpendingTrendChart
        title={selected ? `${selected.emoji} ${selected.name}` : 'Total des dépenses'}
        points={trend}
        color={selected?.color ?? TOTAL_COLOR}
      />
    </div>
  );
}
