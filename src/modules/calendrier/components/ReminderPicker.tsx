import { reminderLabel } from '../lib/reminders';

interface Props {
  label: string;
  /** Préfixe des `id` des deux listes, pour leurs étiquettes */
  idPrefix: string;
  options: readonly number[];
  /** Zéro, un ou deux rappels */
  value: readonly number[];
  onChange: (value: number[]) => void;
}

/**
 * Deux listes : le premier rappel, puis un second une fois le premier
 * choisi. « Aucun » dans la première retire les deux ; le second ne propose
 * pas ce que le premier a déjà pris.
 */
export function ReminderPicker({ label, idPrefix, options, value, onChange }: Props) {
  const [first, second] = value;
  const set = (a: number | undefined, b: number | undefined) =>
    onChange([a, b].filter((x, i, all): x is number => x !== undefined && all.indexOf(x) === i));
  const parse = (raw: string) => (raw === '' ? undefined : Number(raw));

  return (
    <div className="field calendrier-reminders">
      <label htmlFor={`${idPrefix}-1`}>{label}</label>
      <div className="calendrier-reminders-row">
        <select
          id={`${idPrefix}-1`}
          aria-label={`${label} — premier rappel`}
          value={first ?? ''}
          onChange={(e) => {
            const next = parse(e.target.value);
            set(next, next === undefined ? undefined : second);
          }}
        >
          <option value="">Aucun rappel</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {reminderLabel(o)}
            </option>
          ))}
        </select>
        {first !== undefined && (
          <select
            id={`${idPrefix}-2`}
            aria-label={`${label} — second rappel`}
            value={second ?? ''}
            onChange={(e) => set(first, parse(e.target.value))}
          >
            <option value="">Pas de second rappel</option>
            {options
              .filter((o) => o !== first)
              .map((o) => (
                <option key={o} value={o}>
                  {reminderLabel(o)}
                </option>
              ))}
          </select>
        )}
      </div>
    </div>
  );
}
