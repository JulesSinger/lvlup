import { useEffect, useMemo, useRef, useState } from 'react';
import type { ShoppingSpendService, ShoppingSpendTrip } from '../../../core/lib/services';
import { centsToInputValue } from '../lib/amount';
import { moduleRefs, shoppingContent } from '../lib/shoppingContent';
import type { BudgetEntry } from '../lib/types';

const euros = (cents: number) => `${centsToInputValue(cents)} €`;
const shortDay = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

interface Props {
  /** Les écritures de la part sélectionnée, pour le mois affiché */
  entries: BudgetEntry[];
  service: ShoppingSpendService;
  onError(message: string): void;
}

/**
 * « Le contenu de tes courses » (docs/etude-courses-typologies.md §4) : sous la
 * part du camembert qui contient des courses détaillées par Courses, en quoi
 * part l'argent — par typologie, l'alimentation en essentiel, plaisir et
 * alcool — et ce qui reste sans ticket. Chaque course se déplie sur ses
 * lignes, qu'on reclasse d'un geste (l'article du catalogue suit, ses
 * courses passées comprises).
 */
export function ShoppingContent({ entries, service, onError }: Props) {
  // Une clé texte : la liste des écritures est recréée à chaque rendu du parent,
  // la lecture ne doit repartir que si les courses concernées changent.
  const refsKey = moduleRefs(entries).sort().join('|');
  const refs = useMemo(() => (refsKey ? refsKey.split('|') : []), [refsKey]);
  const [trips, setTrips] = useState<ShoppingSpendTrip[] | null>(null);
  const [version, setVersion] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  // Le parent peut recréer `onError` à chaque rendu : on le lit sans en dépendre.
  const report = useRef(onError);
  report.current = onError;

  useEffect(() => {
    let alive = true;
    service
      .trips(refs)
      .then((t) => alive && setTrips(t))
      .catch((err) => alive && report.current(err instanceof Error ? err.message : 'Contenu des courses illisible.'));
    return () => {
      alive = false;
    };
  }, [refs, service, version]);

  if (!trips || trips.length === 0) return null;
  const content = shoppingContent(entries, trips, service);
  const max = Math.max(...content.rows.map((r) => r.cents), 1);
  const typologyLabel = (id: string) => service.typologies.find((t) => t.id === id);

  async function reclass(lineId: string, value: string) {
    const [typology, foodKind] = value.split(':');
    try {
      await service.classify(lineId, typology || null, foodKind || null);
      setVersion((v) => v + 1);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Reclassement impossible.');
    }
  }

  const choices = service.typologies.flatMap((t) =>
    t.id === service.foodTypology
      ? service.foodKinds.map((k) => ({ value: `${t.id}:${k.id}`, label: `${t.emoji} ${t.label} · ${k.label}` }))
      : [{ value: t.id, label: `${t.emoji} ${t.label}` }],
  );

  return (
    <section className="budget-shopping" aria-label="Le contenu de tes courses">
      <h3 className="budget-shopping-title">Le contenu de tes courses</h3>
      <ul className="budget-shopping-rows">
        {content.rows.map((r) => (
          <li key={r.id}>
            <div className="budget-shopping-row">
              <span className="budget-shopping-label">
                {r.emoji} {r.label}
              </span>
              <span className="budget-shopping-bar" aria-hidden="true">
                <span style={{ width: `${(r.cents / max) * 100}%` }} />
              </span>
              <span className="budget-shopping-amount">{euros(r.cents)}</span>
            </div>
            {r.kinds.length > 0 && (
              <ul className="budget-shopping-kinds">
                {r.kinds.map((k) => (
                  <li key={k.id} className="budget-shopping-row budget-shopping-kind">
                    <span className="budget-shopping-label">{k.label}</span>
                    <span className="budget-shopping-bar" aria-hidden="true">
                      <span style={{ width: `${(k.cents / max) * 100}%` }} />
                    </span>
                    <span className="budget-shopping-amount">{euros(k.cents)}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      <ul className="budget-shopping-notes">
        {content.adjustmentCents !== 0 && (
          <li>
            {content.adjustmentCents < 0 ? 'Remises' : 'Écart avec le ticket'} : {content.adjustmentCents < 0 ? '−' : '+'}
            {euros(content.adjustmentCents)}
          </li>
        )}
        {content.unpricedCents > 0 && <li>Lignes sans prix : {euros(content.unpricedCents)}</li>}
        {content.withoutTicketCents > 0 && <li>Sans ticket (relevé, saisie à la main) : {euros(content.withoutTicketCents)}</li>}
      </ul>

      <details className="budget-shopping-trips">
        <summary>
          {trips.length} course{trips.length > 1 ? 's' : ''} détaillée{trips.length > 1 ? 's' : ''}
        </summary>
        <ul>
          {[...trips]
            .sort((a, b) => b.day.localeCompare(a.day))
            .map((t) => (
              <li key={t.ref}>
                <button type="button" className="budget-shopping-trip" aria-expanded={open === t.ref} onClick={() => setOpen(open === t.ref ? null : t.ref)}>
                  <span>
                    {t.store || 'Course'} · {shortDay(t.day)}
                  </span>
                  <span>{t.totalCents !== null ? euros(t.totalCents) : ''}</span>
                </button>
                {open === t.ref && (
                  <ul className="budget-shopping-lines">
                    {t.lines.map((l) => (
                      <li key={l.id}>
                        <span className="budget-shopping-line-name">
                          {l.name}
                          {l.quantity && <small> × {l.quantity}</small>}
                        </span>
                        <span className="budget-shopping-amount">{l.cents !== null ? euros(l.cents) : '—'}</span>
                        <select
                          aria-label={`Classer « ${l.name} »`}
                          value={l.foodKind ? `${l.typology}:${l.foodKind}` : l.typology}
                          onChange={(e) => void reclass(l.id, e.target.value)}
                          title={typologyLabel(l.typology)?.label}
                        >
                          {choices.map((c) => (
                            <option key={c.value} value={c.value}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
        </ul>
        <p className="budget-shopping-hint">Reclasser une ligne reclasse l’article : ses autres courses, passées comprises, le suivent.</p>
      </details>
    </section>
  );
}
