import { useEffect, useState } from 'react';
import { COLOR_LABELS, type EventSpan } from '../lib/calendarBridge';
import { daysBetween, shiftDay } from '../lib/day';
import { describeRecurrence } from '../lib/describe';
import { EVENT_COLORS, type EventColor, type EventInput, type Recurrence } from '../lib/types';
import { validateEvent } from '../lib/validation';

export interface EditorValues extends EventSpan {
  title: string;
  color: EventColor;
  location: string;
  note: string;
  recurrence: Recurrence | null;
}

interface Props {
  /** `null` : un nouvel événement */
  eventId: string | null;
  initial: EditorValues;
  onCancel: () => void;
  /** Rejette en cas d'échec : la fenêtre reste ouverte et remplie. */
  onSave: (input: EventInput) => Promise<void>;
  onDelete?: () => Promise<void>;
}

/**
 * Créer ou modifier un événement : titre, journée entière ou horaire, un
 * ou plusieurs jours, couleur, lieu, note. Les règles sont celles de la
 * base, dites en français (`lib/validation.ts`).
 *
 * Étape 3 : pas encore de répétition à créer ici (étape 4). Une série déjà
 * existante est modifiée en entier, et la fenêtre le dit.
 */
export function EventEditor({ eventId, initial, onCancel, onSave, onDelete }: Props) {
  const [v, setV] = useState<EditorValues>(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const set = <K extends keyof EditorValues>(key: K, value: EditorValues[K]) => setV((prev) => ({ ...prev, [key]: value }));

  function toggleAllDay(allDay: boolean) {
    setV((prev) =>
      allDay
        ? { ...prev, allDay, startTime: null, endTime: null }
        : { ...prev, allDay, startTime: prev.startTime ?? '09:00', endTime: prev.endTime ?? '10:00' },
    );
  }

  function changeStartDay(day: string) {
    // Déplacer le début garde la durée en jours : un séjour de trois jours le reste.
    setV((prev) => {
      if (!day) return { ...prev, startDay: day };
      const length = Math.max(0, daysBetween(prev.startDay, prev.endDay));
      return { ...prev, startDay: day, endDay: shiftDay(day, length) };
    });
  }

  async function run(action: () => Promise<void>) {
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
    const input: EventInput = { ...v, title: v.title.trim(), location: v.location.trim(), note: v.note.trim() };
    const problem = validateEvent(input);
    if (problem) {
      setError(problem);
      return;
    }
    void run(() => onSave(input));
  }

  return (
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

          {v.recurrence && (
            <p className="calendrier-series-note">
              {describeRecurrence(v.recurrence, v.startDay)}. Les modifications s’appliquent à toute la série.
            </p>
          )}

          {error && <div className="notice error">{error}</div>}
        </div>

        <div className="modal-foot calendrier-editor-foot">
          {onDelete && (
            <button
              className="btn btn-ghost btn-sm btn-danger"
              onClick={() => {
                if (window.confirm(v.recurrence ? 'Supprimer toute la série ?' : 'Supprimer cet événement ?')) {
                  void run(onDelete);
                }
              }}
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
  );
}
