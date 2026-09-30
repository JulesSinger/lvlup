import { MONTHS } from '../lib/dates';
import { withPrecision, type DateDraft } from '../lib/editorDraft';
import type { DatePrecision } from '../lib/types';

const PRECISIONS: { value: DatePrecision; label: string }[] = [
  { value: 'day', label: 'Jour' },
  { value: 'month', label: 'Mois' },
  { value: 'year', label: 'Année' },
];

/**
 * Une date, saisie aussi précisément qu'on la connaît : le jour du semi, le
 * mois d'un départ, l'année du brevet. Le mois se choisit dans une liste
 * plutôt qu'avec `<input type="month">`, que Safari sur ordinateur ne
 * connaît pas.
 */
export function DateField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: DateDraft;
  onChange: (next: DateDraft) => void;
}) {
  return (
    <div className="field hautsfaits-date-field">
      <label htmlFor={`${id}-${value.precision}`}>{label}</label>
      <div className="hautsfaits-date-row">
        <div className="hautsfaits-segmented" role="group" aria-label={`Précision : ${label.toLowerCase()}`}>
          {PRECISIONS.map((p) => (
            <button
              key={p.value}
              type="button"
              className={`hautsfaits-segment${value.precision === p.value ? ' on' : ''}`}
              aria-pressed={value.precision === p.value}
              onClick={() => onChange(withPrecision(value, p.value))}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="hautsfaits-date-inputs">
          {value.precision === 'day' && (
            <input id={`${id}-day`} type="date" value={value.day} onChange={(e) => onChange({ ...value, day: e.target.value })} />
          )}
          {value.precision === 'month' && (
            <select
              id={`${id}-month`}
              aria-label={`${label} : mois`}
              value={value.month}
              onChange={(e) => onChange({ ...value, month: Number(e.target.value) })}
            >
              {MONTHS.map((name, i) => (
                <option key={name} value={i + 1}>
                  {name}
                </option>
              ))}
            </select>
          )}
          {value.precision !== 'day' && (
            <input
              id={`${id}-year`}
              className="hautsfaits-year-input"
              aria-label={`${label} : année`}
              inputMode="numeric"
              maxLength={4}
              placeholder="2014"
              value={value.year}
              onChange={(e) => onChange({ ...value, year: e.target.value.replace(/\D/g, '') })}
            />
          )}
        </div>
      </div>
    </div>
  );
}
