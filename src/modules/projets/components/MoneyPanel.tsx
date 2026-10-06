import { useState } from 'react';
import { shortDate } from '../lib/format';
import { formatEuros } from '../lib/money';
import { budgetRef, isPaymentLate, moneySummary, PAYMENT_METHOD_LABELS } from '../lib/payments';
import { formatDuration, hourlyRateCents, parseDuration, totalMinutes } from '../lib/time';
import type { Payment, Project, TimeEntry, Workstream } from '../lib/types';
import { useSaving } from './useSaving';

interface Props {
  project: Project;
  payments: readonly Payment[];
  time: readonly TimeEntry[];
  workstreams: readonly Workstream[];
  today: string;
  /** Les références déjà dans Budget ; `null` quand Budget n'est pas là. */
  inBudget: ReadonlySet<string> | null;
  onSchedule: () => Promise<void>;
  /** `null` : un nouveau paiement */
  onEditPayment: (payment: Payment | null) => void;
  onReceivePayment: (payment: Payment) => void;
  onSendToBudget: (payment: Payment) => Promise<void>;
  onAddTime: (input: { day: string; minutes: number; workstreamId: string | null; note: string }) => Promise<void>;
  onDeleteTime: (entry: TimeEntry) => Promise<void>;
}

/**
 * L'onglet « Argent » (§3.8, §3.10) : le prix, ce qui est encaissé et ce qui
 * reste, les paiements attendus et reçus ; puis le temps passé et ce qu'a
 * vraiment rapporté une heure.
 */
export function MoneyPanel(props: Props) {
  const { project, payments, time, today, inBudget } = props;
  const own = payments.filter((p) => p.projectId === project.id).sort((a, b) => a.position - b.position || a.number - b.number);
  const summary = moneySummary(project, payments, today);
  const target = summary.priceCents ?? summary.plannedCents;
  const ratio = target > 0 ? Math.min(1, summary.receivedCents / target) : 0;
  const entries = time.filter((t) => t.projectId === project.id).sort((a, b) => b.day.localeCompare(a.day) || b.createdAt.localeCompare(a.createdAt));
  const minutes = totalMinutes(time, project.id);
  const wsTitle = new Map(props.workstreams.map((w) => [w.id, w.title]));

  const [day, setDay] = useState(today);
  const [duration, setDuration] = useState('');
  const [workstreamId, setWorkstreamId] = useState('');
  const [note, setNote] = useState('');
  const schedule = useSaving();
  const timeSaving = useSaving();
  const budgetSaving = useSaving();

  function addTime() {
    const parsed = parseDuration(duration);
    if (parsed === null) return timeSaving.setError('Une durée s’écrit « 2h30 », « 2 h », « 1,5 h » ou « 45 » (minutes), une journée au plus.');
    void timeSaving.run(async () => {
      await props.onAddTime({ day: day || today, minutes: parsed, workstreamId: workstreamId || null, note: note.trim() });
      setDuration('');
      setNote('');
    });
  }

  const rateOnPrice = summary.priceCents !== null ? hourlyRateCents(summary.priceCents, minutes) : null;
  const rateOnReceived = hourlyRateCents(summary.receivedCents, minutes);

  return (
    <div className="projets-money">
      <section className="projets-panel" aria-label="Encaissements">
        <div className="projets-money-head">
          <div>
            <span className="projets-money-label">Prix convenu</span>
            <b className="projets-money-price">{summary.priceCents === null ? '—' : formatEuros(summary.priceCents)}</b>
          </div>
          <div className="projets-money-figures">
            <span>
              Encaissé <b>{formatEuros(summary.receivedCents)}</b>
            </span>
            <span>
              Reste <b>{formatEuros(summary.remainingCents)}</b>
            </span>
          </div>
        </div>
        <span className="projets-money-gauge" aria-hidden="true">
          <i style={{ width: `${Math.round(ratio * 100)}%` }} />
        </span>
        {summary.unplannedCents > 0 && own.length > 0 && (
          <p className="projets-hint">Les paiements prévus n’atteignent pas le prix : il en manque {formatEuros(summary.unplannedCents)}.</p>
        )}
        {summary.unplannedCents < 0 && <p className="projets-hint">Les paiements prévus dépassent le prix de {formatEuros(-summary.unplannedCents)}.</p>}

        {own.length === 0 ? (
          <div className="projets-money-empty">
            <p className="projets-hint">Aucun paiement prévu.</p>
            {summary.priceCents !== null && summary.priceCents > 0 && (
              <button className="btn btn-sm btn-primary" disabled={schedule.saving} onClick={() => void schedule.run(props.onSchedule)}>
                Proposer l’échéancier 30 / 70
              </button>
            )}
          </div>
        ) : (
          <ul className="projets-payments">
            {own.map((p) => {
              const late = isPaymentLate(p, today);
              const sent = inBudget?.has(budgetRef(p)) ?? false;
              return (
                <li key={p.id} className={`projets-payment${p.receivedDay ? ' received' : ''}${late ? ' late' : ''}`}>
                  <div className="projets-payment-main">
                    <b>{p.label}</b>
                    <span className="projets-payment-state">
                      {p.receivedDay
                        ? `Reçu le ${shortDate(p.receivedDay, today)}${p.method ? ` · ${PAYMENT_METHOD_LABELS[p.method]}` : ''}${p.invoiceRef ? ` · ${p.invoiceRef}` : ''}`
                        : p.expectedDay
                          ? `${late ? 'En retard — attendu' : 'Attendu'} le ${shortDate(p.expectedDay, today)}`
                          : 'Attendu, sans date'}
                    </span>
                    {p.receivedDay && inBudget && (
                      <span className="projets-payment-budget">
                        {sent ? (
                          '✓ dans Budget'
                        ) : (
                          <button className="btn btn-ghost btn-sm" disabled={budgetSaving.saving} onClick={() => void budgetSaving.run(() => props.onSendToBudget(p))}>
                            Ajouter à Budget
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                  <span className="projets-payment-amount">{formatEuros(p.amountCents)}</span>
                  {!p.receivedDay && (
                    <button className="btn btn-sm" onClick={() => props.onReceivePayment(p)}>
                      Reçu
                    </button>
                  )}
                  <button type="button" className="btn btn-ghost btn-sm projets-edit-btn" aria-label={`Modifier le paiement ${p.label}`} onClick={() => props.onEditPayment(p)}>
                    ✎
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {(schedule.error || budgetSaving.error) && <div className="notice error">{schedule.error || budgetSaving.error}</div>}
        <button className="btn btn-ghost btn-sm projets-add-ws" onClick={() => props.onEditPayment(null)}>
          + Ajouter un paiement
        </button>
      </section>

      <section className="projets-panel" aria-label="Temps passé">
        <h2 className="projets-section-title">
          Temps passé <span className="projets-count">{minutes === 0 ? '0' : formatDuration(minutes)}</span>
        </h2>
        {minutes > 0 && (
          <p className="projets-rate">
            {rateOnPrice !== null && (
              <span>
                Sur le prix convenu : <b>{formatEuros(rateOnPrice)} / h</b>
              </span>
            )}
            <span>
              Sur l’encaissé : <b>{rateOnReceived === null ? '—' : `${formatEuros(rateOnReceived)} / h`}</b>
            </span>
          </p>
        )}
        <div className="projets-time-form">
          <input type="date" aria-label="Jour" value={day} onChange={(e) => setDay(e.target.value)} />
          <input aria-label="Durée" value={duration} placeholder="2h30" onChange={(e) => setDuration(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTime()} />
          <select aria-label="Chantier" value={workstreamId} onChange={(e) => setWorkstreamId(e.target.value)}>
            <option value="">Sans chantier</option>
            {props.workstreams.map((w) => (
              <option key={w.id} value={w.id}>
                {w.title}
              </option>
            ))}
          </select>
          <input aria-label="Note sur le temps" value={note} placeholder="Note (facultatif)" onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTime()} />
          <button className="btn btn-sm btn-primary" disabled={timeSaving.saving} onClick={addTime}>
            Noter
          </button>
        </div>
        {timeSaving.error && <div className="notice error">{timeSaving.error}</div>}
        {entries.length > 0 && (
          <ul className="projets-time-list">
            {entries.map((t) => (
              <li key={t.id} className="projets-time-entry">
                <span className="projets-note-day">{shortDate(t.day, today)}</span>
                <b>{formatDuration(t.minutes)}</b>
                <span className="projets-time-what">
                  {[t.workstreamId ? wsTitle.get(t.workstreamId) : null, t.note].filter(Boolean).join(' · ')}
                </span>
                <button type="button" className="btn btn-ghost btn-sm projets-edit-btn" aria-label="Retirer ce temps" onClick={() => void timeSaving.run(() => props.onDeleteTime(t))}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
