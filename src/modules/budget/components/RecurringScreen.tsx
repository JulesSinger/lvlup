import { useCallback, useEffect, useState } from 'react';
import { newId } from '../../../core/data/coreStore';
import { dayString } from '../../../core/lib/day';
import { budgetStore } from '../data';
import { syncReminders } from '../data/syncReminders';
import { centsToInputValue } from '../lib/amount';
import { detectRecurring, FREQUENCY_LABELS, type Recurring } from '../lib/recurring';
import { draftFromRecurring, subscriptionsView, type DeclaredView } from '../lib/subscriptions';
import type { BudgetCategory, BudgetEntry, BudgetSubscription, BudgetSubscriptionInput, IgnoredRecurring } from '../lib/types';
import { SubscriptionEditor } from './SubscriptionEditor';

/** « 2026-10-13 » → « 13/10/2026 », comme on l'écrit. */
const frDay = (day: string) => day.split('-').reverse().join('/');

type Editing = { subscription: BudgetSubscription } | { draft: BudgetSubscriptionInput | null };

/**
 * L'onglet « Abonnements » : ceux que tu as déclarés (docs/etude-astra.md
 * §14), ce que les relevés en disent, puis les dépenses récurrentes repérées
 * toutes seules (`lib/recurring.ts`) — à déclarer d'un toucher, ou à écarter
 * si ce n'en sont pas. Ce qu'ils coûtent au mois et à l'année, et un rappel
 * avant l'échéance pour ceux qui le demandent.
 */
export function RecurringScreen({ categories, onError, reloadToken }: { categories: BudgetCategory[]; onError: (message: string) => void; reloadToken: number }) {
  const [entries, setEntries] = useState<BudgetEntry[] | null>(null);
  const [subscriptions, setSubscriptions] = useState<BudgetSubscription[]>([]);
  const [ignored, setIgnored] = useState<IgnoredRecurring[]>([]);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [showIgnored, setShowIgnored] = useState(false);
  const [subsError, setSubsError] = useState('');
  const today = dayString();

  const refresh = useCallback(async () => {
    try {
      setEntries(await budgetStore.listEntries());
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Chargement impossible.');
    }
    // À part : une table manquante (migration pas encore appliquée) ne doit pas
    // empêcher de voir ce que la détection a trouvé.
    try {
      const [subs, ign] = await Promise.all([budgetStore.listSubscriptions(), budgetStore.listIgnoredRecurring()]);
      setSubscriptions(subs);
      setIgnored(ign);
      setSubsError('');
      syncReminders().catch(() => {});
    } catch (err) {
      setSubsError(`Les abonnements déclarés n’ont pas pu être chargés : ${err instanceof Error ? err.message : 'erreur inconnue'}.`);
    }
  }, [onError]);

  useEffect(() => {
    void refresh();
  }, [refresh, reloadToken]);

  if (!entries) return <p>Chargement…</p>;
  const view = subscriptionsView(subscriptions, detectRecurring(entries, categories, today), ignored, entries, today);
  const active = view.detected.filter((r) => r.active);
  const stopped = view.detected.filter((r) => !r.active);
  const category = (id: string | null) => categories.find((c) => c.id === id);

  async function ignore(r: Recurring) {
    try {
      await budgetStore.ignoreRecurring(r.key, r.label);
      await refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Impossible d’écarter cette dépense.');
    }
  }

  async function unignore(key: string) {
    try {
      await budgetStore.unignoreRecurring(key);
      await refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Impossible de la remettre.');
    }
  }

  const swatch = (categoryId: string | null) => {
    const c = category(categoryId);
    return (
      <span className="budget-row-swatch" style={{ background: c?.color ?? 'var(--surface-2)' }} aria-hidden="true">
        {c?.emoji ?? '🔁'}
      </span>
    );
  };

  const declaredRow = (d: DeclaredView) => {
    const s = d.subscription;
    const status = d.seen
      ? d.stale
        ? `plus vu depuis le ${frDay(d.seen.day)} — résilié ?`
        : `vu dans tes relevés le ${frDay(d.seen.day)}`
      : s.pattern
        ? 'pas encore vu dans tes relevés'
        : 'déclaré à la main';
    const rose = d.seen && !d.stale && d.seen.amountCents > s.amountCents;
    return (
      <li key={s.id} className="budget-row budget-recurring-row">
        {swatch(s.categoryId)}
        <span className="budget-row-name">
          {s.name}
          <span className="budget-row-category">
            {FREQUENCY_LABELS[s.frequency]} · prochaine échéance le {frDay(d.next)} ·{' '}
            <span className={d.stale ? 'budget-recurring-warn' : ''}>{status}</span>
            {s.remindDays && ` · 🔔 ${s.remindDays} j avant`}
          </span>
        </span>
        <span className="budget-recurring-amount">
          <b>{centsToInputValue(s.amountCents)} €</b>
          {rose && <span className="budget-recurring-rise">prélevé {centsToInputValue(d.seen!.amountCents)} €</span>}
          {s.frequency !== 'mensuel' && <span className="budget-recurring-monthly">≈ {centsToInputValue(d.monthlyCents)} € / mois</span>}
        </span>
        <span className="budget-row-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => setEditing({ subscription: s })} aria-label={`Modifier ${s.name}`}>
            Modifier
          </button>
        </span>
      </li>
    );
  };

  const detectedRow = (r: Recurring) => {
    const rose = r.lastAmountCents > r.amountCents;
    return (
      <li key={r.key} className="budget-row budget-recurring-row">
        {swatch(r.categoryId)}
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
        <span className="budget-row-actions">
          {r.active && (
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing({ draft: draftFromRecurring(r, today) })} aria-label={`Déclarer ${r.label} comme abonnement`}>
              C’est un abonnement
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => void ignore(r)} aria-label={`Écarter ${r.label}`}>
            Pas un abonnement
          </button>
        </span>
      </li>
    );
  };

  const nothing = view.declared.length === 0 && view.detected.length === 0;

  return (
    <div className="budget-recurring">
      <div className="budget-recurring-head">
        <p className="budget-rules-intro">
          Tes abonnements, et les dépenses qui reviennent repérées dans tes relevés. Une prévision : rien n’est ajouté à tes écritures.
        </p>
        <button className="btn btn-sm btn-primary" onClick={() => setEditing({ draft: null })}>
          + Ajouter un abonnement
        </button>
      </div>
      {subsError && <div className="notice error">{subsError}</div>}

      {nothing ? (
        <div className="empty">
          <h3>Aucun abonnement pour l’instant</h3>
          <p>
            Ajoute ceux que tu connais. Les autres apparaîtront d’eux-mêmes avec tes relevés : trois mois d’un paiement mensuel, deux années d’un
            paiement annuel.
          </p>
        </div>
      ) : (
        <>
          <div className="budget-month-summary">
            <div className="budget-month-stat">
              <span className="budget-month-stat-label">Par mois</span>
              <span className="budget-month-stat-amount">{centsToInputValue(view.monthlyCents)} €</span>
            </div>
            <div className="budget-month-stat">
              <span className="budget-month-stat-label">Par an</span>
              <span className="budget-month-stat-amount">{centsToInputValue(view.yearlyCents)} €</span>
            </div>
          </div>
          {view.declared.length > 0 && (
            <section className="budget-group" aria-label="Tes abonnements">
              <h2 className="budget-group-title">Tes abonnements ({view.declared.length})</h2>
              <ul className="budget-list">{view.declared.map(declaredRow)}</ul>
            </section>
          )}
          {active.length > 0 && (
            <section className="budget-group" aria-label="Repérés dans tes relevés">
              <h2 className="budget-group-title">Repérés dans tes relevés ({active.length})</h2>
              <ul className="budget-list">{active.map(detectedRow)}</ul>
            </section>
          )}
          {stopped.length > 0 && (
            <section className="budget-group" aria-label="Plus vus depuis un moment">
              <h2 className="budget-group-title">Plus vus depuis un moment ({stopped.length})</h2>
              <p className="budget-rules-intro">Résiliés, ou payés autrement (une autre carte, un autre compte) : à vérifier.</p>
              <ul className="budget-list">{stopped.map(detectedRow)}</ul>
            </section>
          )}
        </>
      )}

      {view.ignored.length > 0 && (
        <section className="budget-recurring-ignored">
          <button className="btn btn-ghost btn-sm" aria-expanded={showIgnored} onClick={() => setShowIgnored(!showIgnored)}>
            {showIgnored ? '▾' : '▸'} Écartés ({view.ignored.length})
          </button>
          {showIgnored && (
            <ul className="budget-list">
              {view.ignored.map((i) => (
                <li key={i.key} className="budget-row budget-recurring-row">
                  <span className="budget-row-name">{i.label || i.key}</span>
                  <span className="budget-row-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => void unignore(i.key)} aria-label={`Remettre ${i.label || i.key}`}>
                      Remettre
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {editing && (
        <SubscriptionEditor
          initial={'subscription' in editing ? editing.subscription : editing.draft}
          editing={'subscription' in editing}
          categories={categories}
          entries={entries}
          today={today}
          onCancel={() => setEditing(null)}
          onSave={async (input) => {
            if ('subscription' in editing) await budgetStore.updateSubscription(editing.subscription.id, input);
            else await budgetStore.createSubscription(input, newId());
            setEditing(null);
            await refresh();
          }}
          onDelete={
            'subscription' in editing
              ? async () => {
                  await budgetStore.deleteSubscription(editing.subscription.id);
                  setEditing(null);
                  await refresh();
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
