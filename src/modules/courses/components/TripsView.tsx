import { useState } from 'react';
import { formatDay } from '../lib/day';
import { formatEuros } from '../lib/money';
import { AISLE_LABELS, type Trip, type TripItem } from '../lib/types';

interface Props {
  trips: Trip[];
  tripItems: TripItem[];
  /** Rejette en cas d'échec. */
  onDelete: (trip: Trip) => Promise<void>;
}

/**
 * L'historique des courses (étape 4) : la plus récente d'abord, avec le
 * magasin, le total et le nombre d'articles. Toucher une course déplie ce
 * qui y a été acheté, avec les prix — figés, comme au jour de la course.
 */
export function TripsView({ trips, tripItems, onDelete }: Props) {
  const [open, setOpen] = useState<string | null>(null);

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
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-danger"
                  onClick={() => {
                    if (window.confirm('Supprimer cette course de l’historique ? La liste ne change pas.')) {
                      void onDelete(trip);
                    }
                  }}
                >
                  Supprimer cette course
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
