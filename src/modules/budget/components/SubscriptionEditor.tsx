import { useEffect, useState } from 'react';
import { centsToInputValue, parsePositiveAmountToCents } from '../lib/amount';
import { FREQUENCY_LABELS } from '../lib/recurring';
import { lastSeen, validateSubscription } from '../lib/subscriptions';
import {
  SUBSCRIPTION_FREQUENCIES,
  SUBSCRIPTION_REMIND_DAYS,
  type BudgetCategory,
  type BudgetEntry,
  type BudgetSubscriptionInput,
  type SubscriptionFrequency,
  type SubscriptionRemindDays,
} from '../lib/types';
import { CategorySelect } from './CategorySelect';

const frDay = (day: string) => day.split('-').reverse().join('/');

interface Props {
  /** Ce qu'on modifie, ou ce qu'on part déclarer (une dépense repérée) ; `null` : un abonnement vierge. */
  initial: BudgetSubscriptionInput | null;
  /** Vrai quand on modifie un abonnement déjà déclaré (et qu'on peut donc le supprimer). */
  editing: boolean;
  categories: readonly BudgetCategory[];
  entries: readonly BudgetEntry[];
  today: string;
  onCancel: () => void;
  onSave: (input: BudgetSubscriptionInput) => Promise<void>;
  onDelete?: () => Promise<void>;
}

/**
 * Déclarer ou modifier un abonnement (docs/etude-astra.md §14) : une
 * prévision, jamais une écriture. Le motif de libellé le rapproche de ses
 * paiements dans les relevés — ce qu'il trouve s'affiche en direct.
 */
export function SubscriptionEditor({ initial, editing, categories, entries, today, onCancel, onSave, onDelete }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [amountText, setAmountText] = useState(initial ? centsToInputValue(initial.amountCents) : '');
  const [frequency, setFrequency] = useState<SubscriptionFrequency>(initial?.frequency ?? 'mensuel');
  const [nextDay, setNextDay] = useState(initial?.nextDay ?? today);
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [pattern, setPattern] = useState(initial?.pattern ?? '');
  const [remindDays, setRemindDays] = useState<SubscriptionRemindDays | null>(initial?.remindDays ?? null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const seen = pattern.trim() ? lastSeen(pattern, entries) : null;

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
    const parsed = parsePositiveAmountToCents(amountText);
    const amountCents = amountText.trim() === '' ? null : parsed === null ? undefined : parsed;
    const problem = validateSubscription({ name, amountCents, nextDay, pattern });
    if (problem) return setError(problem);
    void run(() =>
      onSave({ name: name.trim(), amountCents: amountCents!, frequency, nextDay, categoryId: categoryId || null, pattern: pattern.trim(), remindDays }),
    );
  }

  const title = editing ? 'Modifier l’abonnement' : 'Nouvel abonnement';
  return (
    <div className="overlay">
      <div className="modal budget-subscription-editor" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <span className="modal-title">{title}</span>
          <button className="btn btn-ghost btn-sm" onClick={onCancel} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label htmlFor="budget-sub-name">Nom</label>
            <input id="budget-sub-name" value={name} placeholder="Netflix, assurance habitation…" onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="budget-sub-amount">Montant (€)</label>
              <input id="budget-sub-amount" inputMode="decimal" value={amountText} placeholder="13,99" onChange={(e) => setAmountText(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="budget-sub-frequency">Rythme</label>
              <select id="budget-sub-frequency" value={frequency} onChange={(e) => setFrequency(e.target.value as SubscriptionFrequency)}>
                {SUBSCRIPTION_FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {FREQUENCY_LABELS[f]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="budget-sub-next">Prochaine échéance</label>
              <input id="budget-sub-next" type="date" value={nextDay} onChange={(e) => setNextDay(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="budget-sub-remind">Me prévenir</label>
              <select
                id="budget-sub-remind"
                value={remindDays ?? ''}
                onChange={(e) => setRemindDays(e.target.value ? (Number(e.target.value) as SubscriptionRemindDays) : null)}
              >
                <option value="">Jamais</option>
                {SUBSCRIPTION_REMIND_DAYS.map((d) => (
                  <option key={d} value={d}>
                    {d} jours avant
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="budget-sub-category">Catégorie</label>
            <CategorySelect id="budget-sub-category" value={categoryId} onChange={setCategoryId} categories={categories} emptyLabel="Aucune" />
          </div>
          <div className="field">
            <label htmlFor="budget-sub-pattern">Le reconnaître dans les relevés (facultatif)</label>
            <input id="budget-sub-pattern" value={pattern} placeholder="NETFLIX" onChange={(e) => setPattern(e.target.value)} />
            <span className="field-hint">
              {!pattern.trim()
                ? 'Un mot du libellé bancaire : l’abonnement et ses paiements ne feront qu’un.'
                : seen
                  ? `${seen.count} paiement${seen.count > 1 ? 's' : ''} trouvé${seen.count > 1 ? 's' : ''}, le dernier le ${frDay(seen.day)} (${centsToInputValue(seen.amountCents)} €).`
                  : 'Aucun paiement trouvé pour l’instant.'}
            </span>
          </div>
          {remindDays && <p className="budget-rules-intro">Le rappel arrive sur les appareils où les notifications d’Atlas sont activées.</p>}
          {error && <div className="notice error">{error}</div>}
        </div>
        <div className="modal-foot budget-rule-foot">
          {editing && onDelete && (
            <button
              className="btn btn-ghost btn-sm btn-danger"
              disabled={saving}
              onClick={() => window.confirm(`Supprimer « ${name} » ? Tes écritures ne bougent pas.`) && void run(onDelete)}
            >
              Supprimer
            </button>
          )}
          <span className="budget-spacer" />
          <button className="btn" onClick={onCancel}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {editing ? 'Enregistrer' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
}
