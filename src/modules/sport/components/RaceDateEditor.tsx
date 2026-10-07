import { useState } from 'react';
import type { Plan } from '../lib/types';
import { Modal } from './Modal';

/**
 * Changer la date de la course, ou la dire officielle (docs/etude-sport.md
 * §12) : les semaines passées restent telles qu'elles ont été vécues ; la
 * semaine en cours et les suivantes sont recalculées.
 */
export function RaceDateEditor({ plan, today, onClose, onSave }: {
  plan: Plan;
  today: string;
  onClose: () => void;
  onSave: (raceDay: string, confirmed: boolean) => Promise<void>;
}) {
  const [day, setDay] = useState(plan.raceDay);
  const [confirmed, setConfirmed] = useState(plan.raceDayConfirmed);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const moved = day !== plan.raceDay;

  async function submit() {
    if (day <= today) return setError('La course doit être après aujourd’hui.');
    setSaving(true);
    setError('');
    try {
      await onSave(day, confirmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Date de la course"
      onClose={onClose}
      footer={
        <>
          <span className="sport-spacer" />
          <button className="btn" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primary" disabled={saving} onClick={() => void submit()}>
            {moved ? 'Recaler le plan' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="sport-race-day">Le jour de la course</label>
        <input id="sport-race-day" type="date" value={day} min={today} onChange={(e) => setDay(e.target.value)} />
      </div>
      <label className="sport-check">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        <span>Date officielle</span>
      </label>
      {moved && (
        <p className="sport-hint">
          Les semaines passées restent comme tu les as vécues. La semaine en cours et les suivantes sont recalculées pour la nouvelle date,
          y compris une séance que tu aurais modifiée à la main.
        </p>
      )}
      {error && <p className="sport-error" role="alert">{error}</p>}
    </Modal>
  );
}
