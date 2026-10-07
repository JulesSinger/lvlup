import { useState } from 'react';
import { KIND_LABELS } from '../lib/kinds';
import { paceInput, parseKm, parsePace } from '../lib/runForm';
import { SESSION_KINDS, SESSION_TITLE_MAX, type PlanSession, type PlanSessionPatch, type SessionKind } from '../lib/types';
import { ZONE_LABELS } from '../lib/zones';
import { Modal } from './Modal';

/**
 * Modifier une séance du plan : sa sorte, sa distance, son allure, sa zone,
 * sa consigne, un jour si on veut la fixer. Changer une séance ne recalcule
 * pas le reste du plan.
 */
export function SessionEditor({ session, onClose, onSave, onDelete }: {
  session: PlanSession;
  onClose: () => void;
  onSave: (patch: PlanSessionPatch) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [title, setTitle] = useState(session.title);
  const [kind, setKind] = useState<SessionKind>(session.kind);
  const [km, setKm] = useState(session.distanceM === null ? '' : String(session.distanceM / 1000).replace('.', ','));
  const [paceMin, setPaceMin] = useState(paceInput(session.paceMinS));
  const [paceMax, setPaceMax] = useState(paceInput(session.paceMaxS));
  const [zone, setZone] = useState(session.hrZone === null ? '' : String(session.hrZone));
  const [instructions, setInstructions] = useState(session.instructions);
  const [day, setDay] = useState(session.day ?? '');
  const [error, setError] = useState('');

  async function submit() {
    if (!title.trim() || title.trim().length > SESSION_TITLE_MAX) return setError('Donne un nom à la séance.');
    const distanceM = km.trim() ? parseKm(km) : null;
    if (km.trim() && distanceM === null) return setError('La distance se tape en kilomètres (« 8,5 »).');
    const min = paceMin.trim() ? parsePace(paceMin) : null;
    const max = paceMax.trim() ? parsePace(paceMax) : null;
    if ((paceMin.trim() && min === null) || (paceMax.trim() && max === null)) return setError('Une allure se tape « 5:20 ».');
    if (min !== null && max !== null && min > max) return setError('La première allure est la plus rapide (« 5:10 » à « 5:30 »).');
    setError('');
    try {
      await onSave({
        title: title.trim(),
        kind,
        distanceM,
        paceMinS: min ?? max,
        paceMaxS: max ?? min,
        hrZone: zone ? Number(zone) : null,
        instructions: instructions.trim(),
        day: day || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
    }
  }

  return (
    <Modal
      title={`Séance · semaine ${session.week}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost btn-sm btn-danger" onClick={() => window.confirm('Retirer cette séance du plan ?') && void onDelete()}>
            Retirer
          </button>
          <span className="sport-spacer" />
          <button className="btn" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={() => void submit()}>
            Enregistrer
          </button>
        </>
      }
    >
      <div className="sport-field-row">
        <div className="field">
          <label htmlFor="sport-session-title">Séance</label>
          <input id="sport-session-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="sport-session-kind">Sorte</label>
          <select id="sport-session-kind" value={kind} onChange={(e) => setKind(e.target.value as SessionKind)}>
            {SESSION_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="sport-field-row">
        <div className="field">
          <label htmlFor="sport-session-km">Distance (km)</label>
          <input id="sport-session-km" inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="sport-session-pacemin">Allure de</label>
          <input id="sport-session-pacemin" placeholder="5:10" value={paceMin} onChange={(e) => setPaceMin(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="sport-session-pacemax">à</label>
          <input id="sport-session-pacemax" placeholder="5:30" value={paceMax} onChange={(e) => setPaceMax(e.target.value)} />
        </div>
      </div>
      <div className="sport-field-row">
        <div className="field">
          <label htmlFor="sport-session-zone">Zone cardiaque</label>
          <select id="sport-session-zone" value={zone} onChange={(e) => setZone(e.target.value)}>
            <option value="">—</option>
            {ZONE_LABELS.map((l, i) => (
              <option key={l} value={String(i + 1)}>
                Z{i + 1} · {l}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sport-session-day">Jour (facultatif)</label>
          <input id="sport-session-day" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="sport-session-instructions">Consigne</label>
        <textarea id="sport-session-instructions" rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
      </div>
      {error && <p className="sport-error" role="alert">{error}</p>}
    </Modal>
  );
}
