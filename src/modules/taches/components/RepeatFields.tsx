import { weekday } from '../../../core/lib/day';
import { describeRecurrence, FREQUENCIES, type Frequency, type Recurrence } from '../../../core/lib/recurrence';
import type { RepeatFrom } from '../lib/types';

interface Props {
  value: Recurrence | null;
  repeatFrom: RepeatFrom;
  /** Le jour prévu : c'est de lui que part la règle */
  startDay: string;
  onChange: (rule: Recurrence | null, repeatFrom: RepeatFrom) => void;
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

/** Lundi d'abord ; valeurs de `Date.getDay`. */
const WEEKDAYS = [
  { day: 1, short: 'L', name: 'lundi' },
  { day: 2, short: 'M', name: 'mardi' },
  { day: 3, short: 'M', name: 'mercredi' },
  { day: 4, short: 'J', name: 'jeudi' },
  { day: 5, short: 'V', name: 'vendredi' },
  { day: 6, short: 'S', name: 'samedi' },
  { day: 0, short: 'D', name: 'dimanche' },
];

type EndKind = 'never' | 'until' | 'count';

/** « Tous les 10 jours après l'avoir faite » : la règle d'une répétition qui repart du jour où on la coche. */
function describeAfter(rule: Recurrence): string {
  const n = Math.max(1, rule.interval || 1);
  const [one, many] = UNITS[rule.freq];
  return `${n} ${n > 1 ? many : one} après l’avoir faite`;
}

/**
 * La répétition d'une tâche (étude §3) : la fréquence, « tous les N », et
 * surtout **d'où repart la suivante** — de la règle (« tous les lundis »,
 * qu'on l'ait faite à temps ou non) ou du jour où on l'a faite (« 10 jours
 * après » : changer les draps). Même moteur que les séries d'Éclipse
 * (`core/lib/recurrence.ts`), écran propre à Polaris : un module n'importe
 * jamais un autre.
 */
export function RepeatFields({ value, repeatFrom, startDay, onChange }: Props) {
  const endKind: EndKind = value?.until !== undefined ? 'until' : value?.count !== undefined ? 'count' : 'never';
  const update = (patch: Partial<Recurrence>) => value && onChange({ ...value, ...patch }, repeatFrom);

  function setFreq(freq: string) {
    if (freq === 'none') return onChange(null, repeatFrom);
    const next: Recurrence = { freq: freq as Frequency, interval: value?.interval ?? 1 };
    if (freq === 'weekly' && repeatFrom === 'schedule') next.byWeekday = value?.byWeekday?.length ? value.byWeekday : [weekday(startDay)];
    if (value?.until !== undefined) next.until = value.until;
    if (value?.count !== undefined) next.count = value.count;
    onChange(next, repeatFrom);
  }

  function setFrom(from: RepeatFrom) {
    if (!value) return onChange(null, from);
    // Après l'avoir faite, les jours de la semaine n'ont plus de sens : seul l'écart compte.
    const { byWeekday: _days, ...rest } = value;
    onChange(from === 'completion' ? rest : value.freq === 'weekly' ? { ...rest, byWeekday: [weekday(startDay)] } : rest, from);
  }

  function setEnd(kind: EndKind) {
    if (!value) return;
    const { until: _until, count: _count, ...rest } = value;
    if (kind === 'until') onChange({ ...rest, until: value.until ?? startDay }, repeatFrom);
    else if (kind === 'count') onChange({ ...rest, count: value.count ?? 10 }, repeatFrom);
    else onChange(rest, repeatFrom);
  }

  function toggleDay(day: number) {
    if (!value) return;
    const days = value.byWeekday ?? [weekday(startDay)];
    update({ byWeekday: days.includes(day) ? days.filter((d) => d !== day) : [...days, day] });
  }

  const selectedDays = value?.byWeekday ?? (value ? [weekday(startDay)] : []);
  const valid = value && Number.isInteger(value.interval) && value.interval >= 1;

  return (
    <div className="taches-repeat">
      <div className="field">
        <label htmlFor="taches-repeat">Répéter</label>
        <select id="taches-repeat" value={value?.freq ?? 'none'} onChange={(e) => setFreq(e.target.value)}>
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
          <div className="taches-repeat-from" role="radiogroup" aria-label="D’où repart la suivante">
            <button type="button" role="radio" aria-checked={repeatFrom === 'schedule'} className={repeatFrom === 'schedule' ? 'on' : ''} onClick={() => setFrom('schedule')}>
              À date fixe
              <small>tous les lundis, même en retard</small>
            </button>
            <button type="button" role="radio" aria-checked={repeatFrom === 'completion'} className={repeatFrom === 'completion' ? 'on' : ''} onClick={() => setFrom('completion')}>
              Après l’avoir faite
              <small>repart du jour où je la coche</small>
            </button>
          </div>

          <div className="taches-repeat-row">
            <label htmlFor="taches-interval">Tous les</label>
            <input
              id="taches-interval"
              type="number"
              inputMode="numeric"
              min={1}
              max={99}
              value={Number.isNaN(value.interval) ? '' : value.interval}
              onChange={(e) => update({ interval: e.target.value === '' ? Number.NaN : Number(e.target.value) })}
            />
            <span>{UNITS[value.freq][value.interval > 1 ? 1 : 0]}</span>
          </div>

          {value.freq === 'weekly' && repeatFrom === 'schedule' && (
            <div className="taches-weekdays" role="group" aria-label="Jours de la semaine">
              {WEEKDAYS.map((d) => (
                <button
                  key={d.day}
                  type="button"
                  aria-pressed={selectedDays.includes(d.day)}
                  aria-label={d.name}
                  title={d.name}
                  className={`taches-weekday${selectedDays.includes(d.day) ? ' on' : ''}`}
                  onClick={() => toggleDay(d.day)}
                >
                  {d.short}
                </button>
              ))}
            </div>
          )}

          <div className="taches-repeat-row">
            <label htmlFor="taches-end-kind">Fin</label>
            <select id="taches-end-kind" value={endKind} onChange={(e) => setEnd(e.target.value as EndKind)}>
              <option value="never">Jamais</option>
              <option value="until">Le…</option>
              <option value="count">Après…</option>
            </select>
            {endKind === 'until' && (
              <input type="date" aria-label="Dernier jour" value={value.until ?? ''} onChange={(e) => update({ until: e.target.value })} />
            )}
            {endKind === 'count' && (
              <>
                <input
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

          {valid && (
            <p className="taches-hint taches-repeat-summary">
              ↻ {repeatFrom === 'completion' ? `${describeAfter(value)}${value.count ? `, ${value.count} fois` : ''}` : describeRecurrence(value, startDay)}.
            </p>
          )}
        </>
      )}
    </div>
  );
}
