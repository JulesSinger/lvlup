import { reminderLabel } from '../lib/reminders';
import { TASK_REMINDERS } from '../lib/types';

interface Props {
  /** Zéro, un ou deux rappels */
  value: readonly number[];
  onChange: (value: number[]) => void;
}

/**
 * Les rappels d'une tâche (06/10/2026) : le premier, puis un second une fois
 * le premier choisi. « Aucun » retire les deux ; le second ne propose pas ce
 * que le premier a déjà pris. Même geste que la fenêtre d'un événement du
 * calendrier, recopié plutôt qu'importé (un module n'importe pas d'un autre).
 */
export function ReminderPicker({ value, onChange }: Props) {
  const [first, second] = value;
  const set = (a: number | undefined, b: number | undefined) =>
    onChange([a, b].filter((x, i, all): x is number => x !== undefined && all.indexOf(x) === i));
  const parse = (raw: string) => (raw === '' ? undefined : Number(raw));

  return (
    <div className="field">
      <label htmlFor="taches-reminder-1">Rappels</label>
      <div className="taches-reminders-row">
        <select
          id="taches-reminder-1"
          aria-label="Rappels — premier rappel"
          value={first ?? ''}
          onChange={(e) => {
            const next = parse(e.target.value);
            set(next, next === undefined ? undefined : second);
          }}
        >
          <option value="">Aucun rappel</option>
          {TASK_REMINDERS.map((o) => (
            <option key={o} value={o}>
              {reminderLabel(o)}
            </option>
          ))}
        </select>
        {first !== undefined && (
          <select id="taches-reminder-2" aria-label="Rappels — second rappel" value={second ?? ''} onChange={(e) => set(first, parse(e.target.value))}>
            <option value="">Pas de second rappel</option>
            {TASK_REMINDERS.filter((o) => o !== first).map((o) => (
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
