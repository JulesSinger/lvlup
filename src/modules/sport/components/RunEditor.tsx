import { useState } from 'react';
import { KIND_LABELS } from '../lib/kinds';
import { emptyRunForm, formToRun, runToForm, type RunForm } from '../lib/runForm';
import { RUN_KINDS, type Run, type RunInput } from '../lib/types';
import { validateRun } from '../lib/validation';
import { Modal } from './Modal';

interface Props {
  /** `null` : une sortie notée à la main. */
  run: Run | null;
  onClose: () => void;
  onSave: (input: RunInput) => Promise<void>;
}

/**
 * Noter une sortie à la main, ou corriger une sortie importée (sa sorte, son
 * ressenti, sa note…). Ce qui est tapé reste dans la fenêtre si
 * l'enregistrement échoue.
 */
export function RunEditor({ run, onClose, onSave }: Props) {
  const [form, setForm] = useState<RunForm>(() => (run ? runToForm(run) : emptyRunForm()));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (patch: Partial<RunForm>) => setForm((f) => ({ ...f, ...patch }));

  async function submit() {
    const result = formToRun(form);
    if ('error' in result) return setError(result.error);
    const problem = validateRun(result.input);
    if (problem) return setError(problem);
    setSaving(true);
    setError('');
    try {
      await onSave(result.input);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={run ? 'Modifier la sortie' : 'Nouvelle sortie'}
      onClose={onClose}
      footer={
        <>
          <span className="sport-spacer" />
          <button className="btn" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={() => void submit()} disabled={saving}>
            {run ? 'Enregistrer' : 'Ajouter'}
          </button>
        </>
      }
    >
      <div className="sport-field-row">
        <div className="field">
          <label htmlFor="sport-run-day">Jour</label>
          <input id="sport-run-day" type="date" value={form.day} onChange={(e) => set({ day: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="sport-run-time">Départ</label>
          <input id="sport-run-time" type="time" value={form.time} onChange={(e) => set({ time: e.target.value })} />
        </div>
      </div>
      <div className="sport-field-row">
        <div className="field">
          <label htmlFor="sport-run-km">Distance (km)</label>
          <input id="sport-run-km" inputMode="decimal" placeholder="10,2" value={form.km} onChange={(e) => set({ km: e.target.value })} autoFocus={!run} />
        </div>
        <div className="field">
          <label htmlFor="sport-run-duration">Durée</label>
          <input id="sport-run-duration" placeholder="52:30" value={form.duration} onChange={(e) => set({ duration: e.target.value })} />
        </div>
      </div>
      <div className="sport-field-row">
        <div className="field">
          <label htmlFor="sport-run-kind">Sorte</label>
          <select id="sport-run-kind" value={form.kind} onChange={(e) => set({ kind: e.target.value as RunForm['kind'] })}>
            {RUN_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sport-run-effort">Ressenti</label>
          <select id="sport-run-effort" value={form.effort} onChange={(e) => set({ effort: e.target.value })}>
            <option value="">—</option>
            {Array.from({ length: 10 }, (_, i) => (
              <option key={i + 1} value={String(i + 1)}>
                {i + 1} / 10
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="sport-field-row">
        <div className="field">
          <label htmlFor="sport-run-avghr">FC moyenne</label>
          <input id="sport-run-avghr" inputMode="numeric" placeholder="148" value={form.avgHr} onChange={(e) => set({ avgHr: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="sport-run-maxhr">FC max</label>
          <input id="sport-run-maxhr" inputMode="numeric" placeholder="172" value={form.maxHr} onChange={(e) => set({ maxHr: e.target.value })} />
        </div>
        <div className="field">
          <label htmlFor="sport-run-elevation">Dénivelé (m)</label>
          <input id="sport-run-elevation" inputMode="numeric" placeholder="85" value={form.elevation} onChange={(e) => set({ elevation: e.target.value })} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="sport-run-title">Titre</label>
        <input id="sport-run-title" placeholder="Footing au bord du lac" value={form.title} onChange={(e) => set({ title: e.target.value })} />
      </div>
      <div className="field">
        <label htmlFor="sport-run-note">Note</label>
        <textarea id="sport-run-note" rows={2} value={form.note} onChange={(e) => set({ note: e.target.value })} />
      </div>
      {error && <p className="sport-error" role="alert">{error}</p>}
    </Modal>
  );
}
