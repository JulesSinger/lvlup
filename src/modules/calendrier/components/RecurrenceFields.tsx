import { describeRecurrence, FREQUENCIES, type Frequency, type Recurrence } from '../../../core/lib/recurrence';
import { weekday } from '../../../core/lib/day';

interface Props {
  value: Recurrence | null;
  startDay: string;
  onChange: (rule: Recurrence | null) => void;
}

const REPEAT_LABELS: Record<Frequency, string> = {
  daily: 'Tous les jours',
  weekly: 'Toutes les semaines',
  monthly: 'Tous les mois',
  yearly: 'Tous les ans',
};

const UNITS: Record<Frequency, [string, string]> = {
  daily: ['jour', 'jours'],
  weekly: ['semaine', 'semaines'],
  monthly: ['mois', 'mois'],
  yearly: ['an', 'ans'],
};

/** Lundi d'abord, comme le calendrier ; valeurs de `Date.getDay`. */
const WEEKDAYS: { day: number; short: string; name: string }[] = [
  { day: 1, short: 'L', name: 'lundi' },
  { day: 2, short: 'M', name: 'mardi' },
  { day: 3, short: 'M', name: 'mercredi' },
  { day: 4, short: 'J', name: 'jeudi' },
  { day: 5, short: 'V', name: 'vendredi' },
  { day: 6, short: 'S', name: 'samedi' },
  { day: 0, short: 'D', name: 'dimanche' },
];

type EndKind = 'never' | 'until' | 'count';

/**
 * La répétition d'un événement : fréquence, « tous les N », jours de la
 * semaine, et fin (jamais, à une date, après N fois). La règle se relit en
 * toutes lettres sous les champs (`describeRecurrence`), pour qu'une
 * erreur se voie avant d'enregistrer.
 */
export function RecurrenceFields({ value, startDay, onChange }: Props) {
  const endKind: EndKind = value?.until !== undefined ? 'until' : value?.count !== undefined ? 'count' : 'never';

  function setFreq(freq: string) {
    if (freq === 'none') return onChange(null);
    const next: Recurrence = { freq: freq as Frequency, interval: value?.interval ?? 1 };
    if (freq === 'weekly') next.byWeekday = value?.byWeekday?.length ? value.byWeekday : [weekday(startDay)];
    if (value?.until !== undefined) next.until = value.until;
    if (value?.count !== undefined) next.count = value.count;
    onChange(next);
  }

  function update(patch: Partial<Recurrence>) {
    if (value) onChange({ ...value, ...patch });
  }

  function setEnd(kind: EndKind) {
    if (!value) return;
    const { until: _until, count: _count, ...rest } = value;
    if (kind === 'until') onChange({ ...rest, until: value.until ?? startDay });
    else if (kind === 'count') onChange({ ...rest, count: value.count ?? 10 });
    else onChange(rest);
  }

  function toggleDay(day: number) {
    if (!value) return;
    const days = value.byWeekday ?? [weekday(startDay)];
    update({ byWeekday: days.includes(day) ? days.filter((d) => d !== day) : [...days, day] });
  }

  const unit = value ? UNITS[value.freq][value.interval > 1 ? 1 : 0] : '';
  const selectedDays = value?.byWeekday ?? (value ? [weekday(startDay)] : []);

  return (
    <div className="calendrier-recurrence">
      <div className="field">
        <label htmlFor="calendrier-repeat">Répéter</label>
        <select id="calendrier-repeat" value={value?.freq ?? 'none'} onChange={(e) => setFreq(e.target.value)}>
          <option value="none">Ne se répète pas</option>
          {FREQUENCIES.map((f) => (
            <option key={f} value={f}>
              {REPEAT_LABELS[f]}
            </option>
          ))}
        </select>
      </div>

      {value && (
        <>
          <div className="calendrier-recurrence-row">
            <label htmlFor="calendrier-interval">Tous les</label>
            <input
              id="calendrier-interval"
              type="number"
              inputMode="numeric"
              min={1}
              max={99}
              value={Number.isNaN(value.interval) ? '' : value.interval}
              onChange={(e) => update({ interval: e.target.value === '' ? Number.NaN : Number(e.target.value) })}
            />
            <span>{unit}</span>
          </div>

          {value.freq === 'weekly' && (
            <div className="calendrier-weekdays" role="group" aria-label="Jours de la semaine">
              {WEEKDAYS.map((d) => (
                <button
                  key={d.day}
                  type="button"
                  aria-pressed={selectedDays.includes(d.day)}
                  aria-label={d.name}
                  title={d.name}
                  className={`calendrier-weekday${selectedDays.includes(d.day) ? ' on' : ''}`}
                  onClick={() => toggleDay(d.day)}
                >
                  {d.short}
                </button>
              ))}
            </div>
          )}

          <div className="calendrier-recurrence-row">
            <label htmlFor="calendrier-end-kind">Fin</label>
            <select id="calendrier-end-kind" value={endKind} onChange={(e) => setEnd(e.target.value as EndKind)}>
              <option value="never">Jamais</option>
              <option value="until">Le…</option>
              <option value="count">Après…</option>
            </select>
            {endKind === 'until' && (
              <input
                id="calendrier-until"
                type="date"
                aria-label="Dernier jour de la série"
                value={value.until ?? ''}
                onChange={(e) => update({ until: e.target.value })}
              />
            )}
            {endKind === 'count' && (
              <>
                <input
                  id="calendrier-count"
                  type="number"
                  inputMode="numeric"
                  aria-label="Nombre de fois"
                  min={1}
                  max={999}
                  value={Number.isNaN(value.count) ? '' : value.count}
                  onChange={(e) => update({ count: e.target.value === '' ? Number.NaN : Number(e.target.value) })}
                />
                <span>fois</span>
              </>
            )}
          </div>

          {Number.isInteger(value.interval) && value.interval >= 1 && (
            <p className="calendrier-series-note calendrier-recurrence-summary">{describeRecurrence(value, startDay)}.</p>
          )}
        </>
      )}
    </div>
  );
}
