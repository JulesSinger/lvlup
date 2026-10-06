import { useCallback, useEffect, useState } from 'react';
import { dayString } from '../../../core/lib/day';
import { budgetStore } from '../data';
import { centsToInputValue } from '../lib/amount';
import { detectRecurring, FREQUENCY_LABELS, recurringTotals, type Recurring } from '../lib/recurring';
import type { BudgetCategory, BudgetEntry } from '../lib/types';

/** « 2026-10-13 » → « 13/10/2026 », comme on l'écrit. */
const frDay = (day: string) => day.split('-').reverse().join('/');

/**
 * L'onglet « Abonnements » : les dépenses qui reviennent, repérées dans les
 * écritures (`lib/recurring.ts`) — rien à saisir. Ce qu'elles coûtent au mois
 * et à l'année, la prochaine échéance, une hausse de prix ; et à part, celles
 * qu'on ne voit plus passer (résiliées… ou oubliées sur une autre carte).
 */
export function RecurringScreen({ categories, onError, reloadToken }: { categories: BudgetCategory[]; onError: (message: string) => void; reloadToken: number }) {
  const [entries, setEntries] = useState<BudgetEntry[] | null>(null);

  const refresh = useCallback(async () => {
    try {
      setEntries(await budgetStore.listEntries());
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Chargement impossible.');
    }
  }, [onError]);

  useEffect(() => {
    void refresh();
  }, [refresh, reloadToken]);

  if (!entries) return <p>Chargement…</p>;
  const found = detectRecurring(entries, categories, dayString());

  const active = found.filter((r) => r.active);
  const stopped = found.filter((r) => !r.active);
  const totals = recurringTotals(found);

  const today = dayString();
  const row = (r: Recurring) => {
    const category = categories.find((c) => c.id === r.categoryId);
    const rose = r.lastAmountCents > r.amountCents;
    return (
      <li key={r.key} className="budget-row budget-recurring-row">
        <span className="budget-row-swatch" style={{ background: category?.color ?? 'var(--surface-2)' }} aria-hidden="true">
          {category?.emoji ?? '🔁'}
        </span>
        <span className="budget-row-name">
          {r.label}
          <span className="budget-row-category">
            {FREQUENCY_LABELS[r.frequency]} · {r.count} paiements depuis le {frDay(r.firstDay)}
            {!r.active
              ? ` · dernier le ${frDay(r.lastDay)}`
              : r.nextDay >= today
                ? ` · prochain vers le ${frDay(r.nextDay)}`
                : ` · attendu vers le ${frDay(r.nextDay)}, pas encore vu`}
          </span>
        </span>
        <span className="budget-recurring-amount">
          <b>{centsToInputValue(r.lastAmountCents)} €</b>
          {rose && <span className="budget-recurring-rise">était {centsToInputValue(r.amountCents)} €</span>}
          {r.frequency !== 'mensuel' && <span className="budget-recurring-monthly">≈ {centsToInputValue(r.monthlyCents)} € / mois</span>}
        </span>
      </li>
    );
  };

  return (
    <div className="budget-recurring">
      <p className="budget-rules-intro">
        Repérés dans tes dépenses, rien n’est à saisir : un même libellé qui revient à intervalle régulier, pour un montant stable.
      </p>
      {found.length === 0 ? (
        <div className="empty">
          <h3>Rien de récurrent repéré pour l’instant</h3>
          <p>Il faut quelques paiements du même libellé : trois mois d’un abonnement mensuel, deux années d’un paiement annuel.</p>
        </div>
      ) : (
        <>
          <div className="budget-month-summary">
            <div className="budget-month-stat">
              <span className="budget-month-stat-label">Par mois</span>
              <span className="budget-month-stat-amount">{centsToInputValue(totals.monthlyCents)} €</span>
            </div>
            <div className="budget-month-stat">
              <span className="budget-month-stat-label">Par an</span>
              <span className="budget-month-stat-amount">{centsToInputValue(totals.yearlyCents)} €</span>
            </div>
          </div>
          {active.length > 0 && (
            <section className="budget-group" aria-label="Encore payés">
              <h2 className="budget-group-title">Encore payés ({active.length})</h2>
              <ul className="budget-list">{active.map(row)}</ul>
            </section>
          )}
          {stopped.length > 0 && (
            <section className="budget-group" aria-label="Plus vus depuis un moment">
              <h2 className="budget-group-title">Plus vus depuis un moment ({stopped.length})</h2>
              <p className="budget-rules-intro">Résiliés, ou payés autrement (une autre carte, un autre compte) : à vérifier.</p>
              <ul className="budget-list">{stopped.map(row)}</ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
