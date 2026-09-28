import { useEffect, useState } from 'react';
import { dayLabel, shortDate } from '../lib/format';
import { lateReason, triageActions, triagePatch, type TriageAction } from '../lib/triage';
import type { Task, TaskPatch } from '../lib/types';

interface Props {
  tasks: readonly Task[];
  today: string;
  onClose: () => void;
  onPatch: (task: Task, patch: TaskPatch) => Promise<void>;
  onDone: (task: Task) => Promise<void>;
  onDelete: (task: Task) => Promise<void>;
}

/**
 * « Faire le point » (étape 4, décision du 27/09/2026) : les tâches en
 * retard, chacune triée d'un geste — aujourd'hui, demain, un autre jour, sans
 * date, faite, supprimer. Le geste agit sur la date qui l'a mise en retard
 * (`lib/triage.ts`). Une tâche triée quitte la liste ; la fenêtre se ferme
 * quand il n'en reste plus.
 */
export function TriageDialog({ tasks, today, onClose, onPatch, onDone, onDelete }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [choosing, setChoosing] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (tasks.length === 0) onClose();
  }, [tasks.length, onClose]);

  async function run(task: Task, action: () => Promise<void>) {
    setBusy(task.id);
    try {
      await action();
    } catch {
      // L'erreur s'affiche en haut de l'écran ; la tâche reste à trier.
    } finally {
      setBusy(null);
      setChoosing(null);
    }
  }

  function apply(task: Task, action: TriageAction) {
    const patch = triagePatch(task, action, today);
    if (patch) void run(task, () => onPatch(task, patch));
  }

  const movable = tasks.filter((t) => triageActions(t, today).includes('today'));

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal taches-triage" role="dialog" aria-modal="true" aria-label="Faire le point" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">Faire le point</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p className="taches-hint">
            {tasks.length} tâche{tasks.length > 1 ? 's' : ''} en retard. Un geste pour chacune : elle quitte la liste.
          </p>
          {movable.length > 1 && (
            <button
              className="btn btn-sm taches-triage-all"
              onClick={() => void Promise.all(movable.map((t) => run(t, () => onPatch(t, triagePatch(t, { kind: 'today' }, today) as TaskPatch))))}
              disabled={busy !== null}
            >
              Tout pour aujourd’hui
            </button>
          )}
          <ul className="taches-triage-list">
            {tasks.map((task) => {
              const reason = lateReason(task, today);
              const actions = triageActions(task, today);
              const next = actions.includes('skip') ? triagePatch(task, { kind: 'skip' }, today)?.plannedDay : null;
              const onDue = reason === 'due';
              return (
                <li key={task.id} className="taches-triage-item">
                  <div className="taches-triage-title">
                    <strong>{task.title}</strong>
                    <span className="taches-late">
                      {onDue ? `échéance dépassée (${shortDate(task.dueDay as string, today)})` : `prévue ${dayLabel(task.plannedDay as string, today).toLowerCase()}`}
                    </span>
                  </div>
                  <div className="taches-triage-actions" aria-label={`Trier « ${task.title} »`}>
                    {actions.includes('today') && (
                      <button className="btn btn-sm" disabled={busy === task.id} onClick={() => apply(task, { kind: 'today' })}>
                        {onDue ? 'Échéance aujourd’hui' : 'Aujourd’hui'}
                      </button>
                    )}
                    {actions.includes('tomorrow') && (
                      <button className="btn btn-sm" disabled={busy === task.id} onClick={() => apply(task, { kind: 'tomorrow' })}>
                        Demain
                      </button>
                    )}
                    {actions.includes('day') &&
                      (choosing === task.id ? (
                        <input
                          type="date"
                          aria-label={`Nouveau jour pour « ${task.title} »`}
                          min={today}
                          autoFocus
                          onChange={(e) => e.target.value && apply(task, { kind: 'day', day: e.target.value })}
                        />
                      ) : (
                        <button className="btn btn-sm" disabled={busy === task.id} onClick={() => setChoosing(task.id)}>
                          Un autre jour…
                        </button>
                      ))}
                    {actions.includes('none') && (
                      <button className="btn btn-sm" disabled={busy === task.id} onClick={() => apply(task, { kind: 'none' })}>
                        {onDue ? 'Sans échéance' : 'Sans date'}
                      </button>
                    )}
                    {next && (
                      <button className="btn btn-sm" disabled={busy === task.id} onClick={() => apply(task, { kind: 'skip' })}>
                        Passer à la prochaine ({dayLabel(next, today).toLowerCase()})
                      </button>
                    )}
                    <button className="btn btn-sm" disabled={busy === task.id} onClick={() => void run(task, () => onDone(task))}>
                      ✓ Faite
                    </button>
                    <button
                      className="btn btn-ghost btn-sm btn-danger"
                      disabled={busy === task.id}
                      aria-label={`Supprimer « ${task.title} »`}
                      onClick={() => window.confirm(`Supprimer « ${task.title} » ?`) && void run(task, () => onDelete(task))}
                    >
                      Supprimer
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
