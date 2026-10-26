import { useEffect, useState } from 'react';
import { COLOR_LABELS, type EventSpan } from '../lib/calendarBridge';
import { daysBetween, shiftDay, weekday } from '../../../core/lib/day';
import { sameRule, type EditInput, type Scope } from '../lib/seriesEdit';
import { effectiveReminders } from '../lib/reminders';
import { ALL_DAY_REMINDERS, EVENT_COLORS, TIMED_REMINDERS, type CalendarSettings, type EventColor, type Recurrence } from '../lib/types';
import type { EventVariant } from '../lib/variants';
import { validateEvent } from '../lib/validation';
import { RecurrenceFields } from './RecurrenceFields';
import { KindSwitch, type Kind } from './KindSwitch';
import { ReminderPicker } from './ReminderPicker';
import { ScopeDialog } from './ScopeDialog';
import { VariantFields } from './VariantFields';

export interface EditorValues extends EventSpan {
  title: string;
  color: EventColor;
  location: string;
  note: string;
  recurrence: Recurrence | null;
  /** `null` : ceux par défaut des réglages, tant qu'on n'y touche pas */
  reminders: number[] | null;
  /** Un événement « travail » (14/10/2026), pour toute la série */
  work: boolean;
  /** Les variantes de la série (26/10/2026) */
  variants: EventVariant[];
  /** La variante du jour touché (`null` : aucune) ; absente hors d'une occurrence */
  variantId?: string | null;
}

interface Props {
  /** `null` : un nouvel événement */
  eventId: string | null;
  /** Une occurrence d'une série déjà enregistrée : enregistrer ou supprimer demande « laquelle ? » */
  inSeries: boolean;
  /** Le jour de l'occurrence touchée dans sa série, pour choisir sa variante */
  occurrenceDay?: string | null;
  initial: EditorValues;
  /** Les rappels par défaut, pour montrer ceux que l'événement prendra */
  defaults: CalendarSettings;
  /** Sans compte, aucun rappel ne part : la fenêtre le dit */
  local: boolean;
  onCancel: () => void;
  /** Rejette en cas d'échec : la fenêtre reste ouverte et remplie. `scope` : seulement pour une série. */
  onSave: (input: EditInput, scope?: Scope) => Promise<void>;
  onDelete?: (scope?: Scope) => Promise<void>;
  /**
   * À la création, ce qu'on peut créer d'autre sur le créneau (« Tâche »,
   * 06/10/2026) : la bascule s'affiche, et `onSwitchKind` reçoit ce qui est
   * déjà rempli pour que l'autre fenêtre reparte du même créneau.
   */
  kinds?: readonly Kind[];
  onSwitchKind?: (id: string, values: EditorValues) => void;
}

/**
 * Créer ou modifier un événement : titre, journée entière ou horaire, un
 * ou plusieurs jours, couleur, lieu, note. Les règles sont celles de la
 * base, dites en français (`lib/validation.ts`).
 *
 * Étape 4 : la répétition se règle ici (`RecurrenceFields`). Pour une
 * occurrence d'une série, enregistrer ou supprimer demande d'abord si c'est
 * cet événement, les suivants ou tous (`ScopeDialog`).
 */
export function EventEditor({ eventId, inSeries, occurrenceDay = null, initial, defaults, local, onCancel, onSave, onDelete, kinds = [], onSwitchKind }: Props) {
  const [v, setV] = useState<EditorValues>(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [asking, setAsking] = useState<null | { action: 'edit'; input: EditInput } | { action: 'delete' }>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const set = <K extends keyof EditorValues>(key: K, value: EditorValues[K]) => setV((prev) => ({ ...prev, [key]: value }));

  function toggleAllDay(allDay: boolean) {
    // Des rappels choisis pour l'autre sorte (« 15 min avant » n'a pas de sens
    // en journée entière) : on revient au défaut de la nouvelle sorte.
    const fits = (r: number[] | null) =>
      r === null || r.every((x) => (allDay ? (ALL_DAY_REMINDERS as readonly number[]) : (TIMED_REMINDERS as readonly number[])).includes(x));
    setV((prev) => {
      const reminders = fits(prev.reminders) ? prev.reminders : null;
      return allDay
        ? { ...prev, allDay, startTime: null, endTime: null, reminders }
        : { ...prev, allDay, startTime: prev.startTime ?? '09:00', endTime: prev.endTime ?? '10:00', reminders };
    });
  }

  function changeStartDay(day: string) {
    // Déplacer le début garde la durée en jours : un séjour de trois jours le reste.
    setV((prev) => {
      if (!day) return { ...prev, startDay: day };
      const length = Math.max(0, daysBetween(prev.startDay, prev.endDay));
      let recurrence = prev.recurrence;
      // « Chaque mardi » posé d'après le jour de début suit ce jour s'il change.
      const days = recurrence?.byWeekday;
      if (recurrence && days?.length === 1 && days[0] === weekday(prev.startDay)) {
        recurrence = { ...recurrence, byWeekday: [weekday(day)] };
      }
      return { ...prev, startDay: day, endDay: shiftDay(day, length), recurrence };
    });
  }

  async function run(action: () => Promise<void>) {
    setAsking(null);
    setSaving(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  }

  function submit() {
    const { variantId, ...rest } = v;
    const variants = v.recurrence ? v.variants.map((x) => ({ ...x, name: x.name.trim() })) : [];
    const input: EditInput = { ...rest, variants, title: v.title.trim(), location: v.location.trim(), note: v.note.trim() };
    // La variante du jour ne part que si on l'a changée : sinon, celle des jours décide.
    const dayChanged = variantId !== undefined && variantId !== initial.variantId;
    if (dayChanged) input.variantId = variantId;
    const problem = validateEvent(input);
    if (problem) {
      setError(problem);
      return;
    }
    // Seule la variante du jour a changé : elle ne vaut que pour ce jour, rien à demander.
    const strip = ({ variantId: _d, ...x }: EditorValues) => JSON.stringify(x);
    if (inSeries && dayChanged && strip(v) === strip(initial)) void run(() => onSave(input, 'this'));
    else if (inSeries) setAsking({ action: 'edit', input });
    else void run(() => onSave(input));
  }

  function remove() {
    if (!onDelete) return;
    if (inSeries) setAsking({ action: 'delete' });
    else if (window.confirm('Supprimer cet événement ?')) void run(() => onDelete());
  }

  function choose(scope: Scope) {
    if (!asking) return;
    if (asking.action === 'edit') {
      const input = asking.input;
      void run(() => onSave(input, scope));
    } else if (onDelete) {
      void run(() => onDelete(scope));
    }
  }

  return (
    <>
    <div className="overlay" onClick={onCancel}>
      <div
        className="modal calendrier-editor"
        role="dialog"
        aria-modal="true"
        aria-label={eventId ? 'Modifier l’événement' : 'Nouvel événement'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <span className="modal-title">{eventId ? 'Modifier l’événement' : 'Nouvel événement'}</span>
          <button className="btn btn-ghost btn-sm" onClick={onCancel} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {eventId === null && kinds.length > 1 && onSwitchKind && (
            <KindSwitch kinds={kinds} current="event" onChange={(id) => onSwitchKind(id, v)} />
          )}
          <div className="field">
            <label htmlFor="calendrier-title">Titre</label>
            <input
              id="calendrier-title"
              type="text"
              value={v.title}
              onChange={(e) => set('title', e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
              placeholder="Dentiste, dîner chez Léa, vacances…"
              autoFocus
            />
          </div>

          <label className="calendrier-allday">
            <input type="checkbox" checked={v.allDay} onChange={(e) => toggleAllDay(e.target.checked)} /> Toute la journée
          </label>

          <div className="calendrier-editor-grid">
            <div className="field">
              <label htmlFor="calendrier-start-day">Début</label>
              <input id="calendrier-start-day" type="date" value={v.startDay} onChange={(e) => changeStartDay(e.target.value)} />
            </div>
            {!v.allDay && (
              <div className="field">
                <label htmlFor="calendrier-start-time">à</label>
                <input
                  id="calendrier-start-time"
                  type="time"
                  value={v.startTime ?? ''}
                  onChange={(e) => set('startTime', e.target.value)}
                />
              </div>
            )}
            <div className="field">
              <label htmlFor="calendrier-end-day">Fin</label>
              <input id="calendrier-end-day" type="date" value={v.endDay} onChange={(e) => set('endDay', e.target.value)} />
            </div>
            {!v.allDay && (
              <div className="field">
                <label htmlFor="calendrier-end-time">à</label>
                <input id="calendrier-end-time" type="time" value={v.endTime ?? ''} onChange={(e) => set('endTime', e.target.value)} />
              </div>
            )}
          </div>

          <RecurrenceFields value={v.recurrence} startDay={v.startDay} onChange={(rule) => set('recurrence', rule)} />

          {v.recurrence && (
            <VariantFields
              variants={v.variants}
              onChange={(variants) => set('variants', variants)}
              occurrenceDay={inSeries ? occurrenceDay : null}
              variantId={v.variantId ?? null}
              onChooseVariant={(id) => set('variantId', id)}
            />
          )}

          <ReminderPicker
            label="Rappels"
            idPrefix="calendrier-reminder"
            options={v.allDay ? ALL_DAY_REMINDERS : TIMED_REMINDERS}
            value={effectiveReminders(v.reminders, v.allDay, defaults)}
            onChange={(reminders) => set('reminders', reminders)}
          />
          {(v.reminders === null || local) && (
            <p className="field-hint calendrier-reminders-hint">
              {local
                ? 'Sans compte, les rappels ne partent pas.'
                : 'Ceux par défaut, réglables dans les réglages d’Atlas.'}
            </p>
          )}

          <div className="field">
            <label>Couleur</label>
            <div className="calendrier-colors" role="radiogroup" aria-label="Couleur">
              {EVENT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={v.color === c}
                  aria-label={COLOR_LABELS[c]}
                  title={COLOR_LABELS[c]}
                  className={`calendrier-color calendrier-color-${c}${v.color === c ? ' on' : ''}`}
                  onClick={() => set('color', c)}
                />
              ))}
            </div>
          </div>

          <div className="field">
            <label htmlFor="calendrier-location">Lieu (facultatif)</label>
            <input id="calendrier-location" type="text" value={v.location} onChange={(e) => set('location', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="calendrier-note">Note (facultatif)</label>
            <textarea id="calendrier-note" rows={2} value={v.note} onChange={(e) => set('note', e.target.value)} />
          </div>
          <label className="calendrier-work-field">
            <input type="checkbox" checked={v.work} onChange={(e) => set('work', e.target.checked)} />
            <span>💼 Travail — visible en mode travail{inSeries || v.recurrence ? ' (pour toute la série)' : ''} ; sinon, un bloc « Occupé »</span>
          </label>


          {error && <div className="notice error">{error}</div>}
        </div>

        <div className="modal-foot calendrier-editor-foot">
          {onDelete && (
            <button
              className="btn btn-ghost btn-sm btn-danger"
              onClick={remove}
              disabled={saving}
            >
              Supprimer
            </button>
          )}
          <span className="calendrier-editor-spacer" />
          <button className="btn" onClick={onCancel}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
    {asking && (
      <ScopeDialog
        action={asking.action}
        allowThis={asking.action === 'delete' || sameRule(asking.input.recurrence, initial.recurrence)}
        onChoose={choose}
        onCancel={() => setAsking(null)}
      />
    )}
    </>
  );
}
