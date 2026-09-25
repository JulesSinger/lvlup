import { useState } from 'react';
import { dayString, formatDay, formatMonth } from '../lib/day';
import { formatEuros } from '../lib/money';
import { priceHistory, priceSummary, pricedItems } from '../lib/prices';
import { averageBasket, byStore, monthlyTotals } from '../lib/stats';
import type { Item, Trip, TripItem } from '../lib/types';

interface Props {
  trips: Trip[];
  tripItems: TripItem[];
  items: Item[];
}

/** Combien de mois montrer dans le graphique : une année suffit à voir une tendance. */
const MONTHS_SHOWN = 12;
const MONTH_SHORT = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];

/** 4780 → « 48 € » : arrondi à l'euro, pour tenir au-dessus d'une barre étroite. */
const roundEuros = (cents: number) => `${Math.round(cents / 100)} €`;

/**
 * Les chiffres des courses (étape 5, docs/etude-courses.md §12) : ce mois-ci
 * et le panier moyen, la dépense mois par mois, les magasins, et le prix
 * d'un article dans le temps. Tout se recalcule depuis les courses
 * enregistrées (`lib/stats.ts`, `lib/prices.ts`) — rien n'est stocké à part.
 *
 * Graphiques dessinés à la main en SVG, comme ceux d'Astra et de Cérès, sans
 * rien leur emprunter (aucun import entre modules).
 */
export function StatsView({ trips, tripItems, items }: Props) {
  const tracked = pricedItems(items, tripItems);
  const [itemId, setItemId] = useState<string>(tracked[0]?.id ?? '');

  if (trips.length === 0) {
    return (
      <div className="empty courses-empty">
        <h3>Pas encore de chiffres</h3>
        <p>Ils apparaîtront après ta première course terminée.</p>
      </div>
    );
  }

  const month = dayString().slice(0, 7);
  const months = monthlyTotals(trips).slice(-MONTHS_SHOWN);
  const thisMonth = months.find((m) => m.month === month);
  const basket = averageBasket(trips);
  const stores = byStore(trips);
  const selected = tracked.find((i) => i.id === itemId) ?? tracked[0];
  const points = selected ? priceHistory(selected.id, tripItems, trips) : [];
  const summary = priceSummary(points);

  return (
    <div className="courses-stats">
      <section className="courses-stats-keys" aria-label="Chiffres clés">
        <div className="courses-stats-key">
          <span className="courses-stats-key-label">Ce mois-ci</span>
          <b className="courses-stats-key-value">{formatEuros(thisMonth?.totalCents ?? 0)}</b>
          <span className="courses-stats-key-detail">
            {thisMonth?.trips ?? 0} course{(thisMonth?.trips ?? 0) > 1 ? 's' : ''}
          </span>
        </div>
        <div className="courses-stats-key">
          <span className="courses-stats-key-label">Panier moyen</span>
          <b className="courses-stats-key-value">{formatEuros(basket ?? 0)}</b>
          <span className="courses-stats-key-detail">
            sur {trips.length} course{trips.length > 1 ? 's' : ''}
          </span>
        </div>
      </section>

      <section className="courses-stats-block" aria-label="Dépense par mois">
        <h2 className="courses-stats-title">Par mois</h2>
        <MonthChart months={months} current={month} />
      </section>

      <section className="courses-stats-block" aria-label="Par magasin">
        <h2 className="courses-stats-title">Par magasin</h2>
        <table className="courses-stats-table">
          <thead>
            <tr>
              <th>Magasin</th>
              <th>Courses</th>
              <th>Total</th>
              <th>Panier moyen</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((s) => (
              <tr key={s.storeName}>
                <td>{s.storeName}</td>
                <td>{s.trips}</td>
                <td>{formatEuros(s.totalCents)}</td>
                <td>{formatEuros(s.averageCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="courses-stats-block" aria-label="Prix d’un article">
        <h2 className="courses-stats-title">Prix d’un article</h2>
        {tracked.length === 0 ? (
          <p className="courses-stats-hint">
            Note le prix des articles que tu mets dans le panier : leur évolution s’affichera ici.
          </p>
        ) : (
          <>
            <select
              aria-label="Article à suivre"
              className="courses-stats-select"
              value={selected?.id}
              onChange={(e) => setItemId(e.target.value)}
            >
              {tracked.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
            {summary && (
              <p className="courses-price-summary">
                Dernier prix <b>{formatEuros(summary.last.priceCents)}</b>
                {summary.last.storeName && ` chez ${summary.last.storeName}`}
                {points.length > 1 && (
                  <>
                    {' '}
                    · de {formatEuros(summary.minCents)} à {formatEuros(summary.maxCents)}
                    {summary.changePercent !== null && summary.changePercent !== 0 && (
                      <>
                        {' '}
                        · {summary.changePercent > 0 ? '+' : ''}
                        {summary.changePercent} % depuis le premier prix
                      </>
                    )}
                  </>
                )}
              </p>
            )}
            {points.length > 1 && <PriceChart cents={points.map((p) => p.priceCents)} />}
            <ul className="courses-price-points">
              {points
                .slice()
                .reverse()
                .map((p) => (
                  <li key={p.tripNumber} className="courses-price-point">
                    <span>{formatDay(p.day)}</span>
                    <span className="courses-price-point-store">
                      {p.storeName || 'Sans magasin'}
                      {p.quantity && ` · ${p.quantity}`}
                    </span>
                    <b>{formatEuros(p.priceCents)}</b>
                  </li>
                ))}
            </ul>
            <p className="courses-stats-hint">
              Le prix d’une ligne, pour la quantité achetée ce jour-là — pas un prix au kilo.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

const W = 700;
const H = 200;
const TOP = 24;
const BOTTOM = 28;
const SIDE = 10;

function MonthChart({ months, current }: { months: { month: string; totalCents: number }[]; current: string }) {
  const max = Math.max(1, ...months.map((m) => m.totalCents)) * 1.1;
  const slot = (W - SIDE * 2) / Math.max(months.length, 1);
  const bar = Math.min(slot * 0.6, 56);
  const y = (cents: number) => H - BOTTOM - (cents / max) * (H - TOP - BOTTOM);
  return (
    <svg className="courses-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Dépense de courses par mois">
      <line x1={SIDE} x2={W - SIDE} y1={H - BOTTOM} y2={H - BOTTOM} className="courses-chart-axis" />
      {months.map((m, i) => {
        const cx = SIDE + slot * i + slot / 2;
        const [year, mo] = m.month.split('-').map(Number);
        return (
          <g key={m.month} className={`courses-chart-month${m.month === current ? ' current' : ''}`}>
            <title>{`${formatMonth(m.month)} : ${formatEuros(m.totalCents)}`}</title>
            {m.totalCents > 0 && (
              <rect x={cx - bar / 2} y={y(m.totalCents)} width={bar} height={H - BOTTOM - y(m.totalCents)} rx={5} className="courses-chart-bar" />
            )}
            <text x={cx} y={y(m.totalCents) - 6} className="courses-chart-value">
              {roundEuros(m.totalCents)}
            </text>
            <text x={cx} y={H - 9} className="courses-chart-label">
              {MONTH_SHORT[mo - 1]}
              {mo === 1 ? ` ${String(year).slice(2)}` : ''}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function PriceChart({ cents }: { cents: number[] }) {
  const min = Math.min(...cents);
  const max = Math.max(...cents);
  const span = Math.max(1, max - min);
  const h = 120;
  const x = (i: number) => SIDE + (i * (W - SIDE * 2)) / Math.max(cents.length - 1, 1);
  const y = (c: number) => 16 + ((max - c) / span) * (h - 32);
  const path = cents.map((c, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(c)}`).join(' ');
  return (
    <svg className="courses-chart courses-price-chart" viewBox={`0 0 ${W} ${h}`} role="img" aria-label="Évolution du prix">
      <path d={path} className="courses-price-line" />
      {cents.map((c, i) => (
        <circle key={i} cx={x(i)} cy={y(c)} r={5} className="courses-price-dot" />
      ))}
    </svg>
  );
}
