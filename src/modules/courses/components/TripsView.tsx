import { useEffect, useState } from 'react';
import type { ExpenseService } from '../../../core/lib/services';
import { expenseForTrip, tripRef } from '../lib/budgetLink';
import { formatDay } from '../lib/day';
import { formatEuros } from '../lib/money';
import { AISLE_LABELS, type Trip, type TripItem } from '../lib/types';

interface Props {
  trips: Trip[];
  tripItems: TripItem[];
  /** Rejette en cas d'échec. */
  onDelete: (trip: Trip) => Promise<void>;
  /** Le service de dépenses du budget, s'il existe (étape 6). */
  expenses?: ExpenseService;
  onError: (message: string) => void;
}

/**
 * L'historique des courses (étape 4) : la plus récente d'abord, avec le
 * magasin, le total et le nombre d'articles. Toucher une course déplie ce
 * qui y a été acheté, avec les prix — figés, comme au jour de la course.
 */
export function TripsView({ trips, tripItems, onDelete, expenses, onError }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  /** Les courses déjà présentes au budget, par référence. */
  const [inBudget, setInBudget] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState<string | null>(null);

  useEffect(() => {
    if (!expenses) return;
    let cancelled = false;
    expenses
      .recorded(trips.map(tripRef))
      .then((set) => {
        if (!cancelled) setInBudget(set);
      })
      .catch(() => {
        // Sans réponse du budget, on n'affiche simplement pas l'état du lien.
      });
    return () => {
      cancelled = true;
    };
  }, [expenses, trips]);

  /** Envoyer après coup : une course terminée sans, ou dont l'envoi avait échoué. */
  async function send(trip: Trip) {
    if (!expenses) return;
    setSending(trip.id);
    try {
      await expenses.record(expenseForTrip(trip));
      setInBudget((set) => new Set([...set, tripRef(trip)]));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Envoi au budget impossible.');
    } finally {
      setSending(null);
    }
  }

  if (trips.length === 0) {
    return (
      <div className="empty courses-empty">
        <h3>Aucune course pour l’instant</h3>
        <p>Coche ce que tu mets dans le panier, puis « Terminer la course » : elle s’enregistre ici.</p>
      </div>
    );
  }

  return (
    <ul className="courses-trips">
      {trips.map((trip) => {
        const bought = tripItems.filter((ti) => ti.tripId === trip.id);
        const isOpen = open === trip.id;
        return (
          <li key={trip.id} className={`courses-trip${isOpen ? ' open' : ''}`}>
            <button
              type="button"
              className="courses-trip-head"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : trip.id)}
            >
              <span className="courses-trip-when">
                <span className="courses-trip-day">{formatDay(trip.day)}</span>
                <span className="courses-trip-store">
                  {trip.storeName || 'Sans magasin'} · {bought.length} article{bought.length > 1 ? 's' : ''}
                </span>
              </span>
              <span className="courses-trip-total">{formatEuros(trip.totalCents)}</span>
            </button>
            {isOpen && (
              <div className="courses-trip-detail">
                <ul className="courses-trip-items">
                  {bought.map((ti) => (
                    <li key={ti.id} className="courses-trip-item">
                      <span className="courses-trip-item-name">
                        {ti.name}
                        {ti.quantity && <span className="courses-trip-item-qty"> · {ti.quantity}</span>}
                      </span>
                      <span className="courses-trip-item-aisle">{AISLE_LABELS[ti.aisle]}</span>
                      <span className="courses-trip-item-price">
                        {ti.priceCents === null ? '—' : formatEuros(ti.priceCents)}
                      </span>
                    </li>
                  ))}
                </ul>
                {trip.note && <p className="courses-trip-note">{trip.note}</p>}
                <div className="courses-trip-actions">
                  {expenses &&
                    (inBudget.has(tripRef(trip)) ? (
                      <span className="courses-trip-budget">Dans le budget (Astra) ✓</span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => void send(trip)}
                        disabled={sending === trip.id}
                      >
                        {sending === trip.id ? 'Envoi…' : 'Ajouter au budget'}
                      </button>
                    ))}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm btn-danger"
                    onClick={() => {
                      const withBudget = expenses && inBudget.has(tripRef(trip));
                      if (
                        window.confirm(
                          withBudget
                            ? 'Supprimer cette course, et sa dépense dans le budget ? La liste ne change pas.'
                            : 'Supprimer cette course de l’historique ? La liste ne change pas.',
                        )
                      ) {
                        void onDelete(trip);
                      }
                    }}
                  >
                    Supprimer cette course
                  </button>
                </div>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
