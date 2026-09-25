import { useEffect, useState } from 'react';
import { centsToInput, formatEuros, parseEurosToCents } from '../lib/money';
import { recurrenceLabel } from '../lib/trip';
import type { Item, ListEntry } from '../lib/types';

interface Props {
  entry: ListEntry;
  item: Item;
  /** Dernier prix connu, pour guider la saisie */
  hintCents: number | null;
  onToggle: () => void;
  onPrice: (priceCents: number | null) => void;
  onOpen: () => void;
}

/**
 * Une ligne de la liste. La case se coche d'un pouce ; une fois l'article
 * dans le panier, un petit champ attend son prix (décision du 25/09/2026 :
 * le prix de chaque article). Le dernier prix connu s'y affiche en indice.
 * Toucher le nom ouvre l'article (quantité, rayon, récurrence).
 */
export function ListLine({ entry, item, hintCents, onToggle, onPrice, onOpen }: Props) {
  const [price, setPrice] = useState(entry.priceCents === null ? '' : centsToInput(entry.priceCents));
  const [invalid, setInvalid] = useState(false);

  // Une relecture (ou une annulation après échec) peut changer le prix enregistré.
  useEffect(() => {
    setPrice(entry.priceCents === null ? '' : centsToInput(entry.priceCents));
  }, [entry.priceCents]);

  function commit() {
    if (price.trim() === '') {
      setInvalid(false);
      if (entry.priceCents !== null) onPrice(null);
      return;
    }
    const cents = parseEurosToCents(price);
    if (cents === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (cents !== entry.priceCents) onPrice(cents);
  }

  const meta = [entry.quantity, item.recurrence !== null ? recurrenceLabel(item.recurrence) : null, entry.note]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className={`courses-line${entry.checked ? ' checked' : ''}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={entry.checked}
        aria-label={entry.checked ? `Retirer « ${item.name} » du panier` : `Mettre « ${item.name} » dans le panier`}
        className="courses-check"
        onClick={onToggle}
      >
        {entry.checked ? '✓' : ''}
      </button>
      <button type="button" className="courses-line-main" onClick={onOpen} title="Modifier l’article">
        <span className="courses-line-name">{item.name}</span>
        {meta && <span className="courses-line-meta">{meta}</span>}
      </button>
      {entry.checked && (
        <input
          type="text"
          inputMode="decimal"
          className={`courses-price${invalid ? ' invalid' : ''}`}
          aria-label={`Prix de « ${item.name} »`}
          placeholder={hintCents !== null ? formatEuros(hintCents) : 'prix'}
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
        />
      )}
    </li>
  );
}
