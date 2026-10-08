import { useEffect, useState } from 'react';
import type { CheckinService, GoalActionChoice } from '../../../core/lib/services';
import type { LinkResult } from '../data/syncObjectifs';

/**
 * Le lien avec Objectifs (docs/etude-sport.md §6.1, §18) : l'action que coche
 * chaque jour couru. Le choix est rangé dans les réglages de Sport ; Sport
 * tient ensuite les coches à jour à chaque ouverture.
 */
export function ObjectifsLink({ service, actionId, status, onChoose }: {
  service: CheckinService;
  actionId: string | null;
  /** Ce que la dernière mise à jour a fait, ou le message d'erreur. */
  status: LinkResult | string | null;
  onChoose: (actionId: string | null) => Promise<void>;
}) {
  const [choices, setChoices] = useState<GoalActionChoice[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    service.actions().then(setChoices, (err: unknown) => setError(err instanceof Error ? err.message : 'Objectifs ne répond pas.'));
  }, [service, actionId]);

  async function choose(next: string | null) {
    setBusy(true);
    setError('');
    try {
      await onChoose(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }

  const current = choices?.find((c) => c.actionId === actionId) ?? null;

  return (
    <section className="sport-panel sport-objectifs">
      <h2 className="sport-panel-title">Objectifs</h2>
      {choices === null ? (
        <p className="sport-hint">{error || '…'}</p>
      ) : choices.length === 0 ? (
        <p className="sport-hint">Crée dans Objectifs un objectif avec une action (« Sortie course ») : chaque jour couru la cochera, avec ses kilomètres.</p>
      ) : (
        <>
          <p className="sport-hint">
            Chaque jour couru coche une action d’Objectifs, avec la distance du jour : ton palier, ta série et tes PP avancent tout seuls.
          </p>
          <div className="field">
            <label htmlFor="sport-objectifs-action">Action cochée</label>
            <select
              id="sport-objectifs-action"
              value={actionId ?? ''}
              disabled={busy}
              onChange={(e) => void choose(e.target.value || null)}
            >
              <option value="">Aucune</option>
              {choices.map((c) => (
                <option key={c.actionId} value={c.actionId}>
                  {c.goalTitle} — {c.actionTitle}
                  {c.unit ? ` (${c.unit})` : ''}
                </option>
              ))}
            </select>
          </div>
          {actionId && !current && <p className="sport-error">L’action choisie n’existe plus dans Objectifs : choisis-en une autre.</p>}
          {current && (
            <p className="sport-hint">
              Depuis la création de « {current.goalTitle} »{current.unit ? `, en ${current.unit}` : ', sans quantité (unité inconnue)'}.
              {typeof status === 'object' && status !== null && (status.recorded > 0 || status.removed > 0 || status.taken > 0) ? (
                <>
                  {' '}
                  Dernière mise à jour : {status.recorded} jour{status.recorded > 1 ? 's' : ''} coché{status.recorded > 1 ? 's' : ''}
                  {status.removed > 0 ? `, ${status.removed} retiré${status.removed > 1 ? 's' : ''}` : ''}
                  {status.taken > 0 ? `, ${status.taken} déjà coché${status.taken > 1 ? 's' : ''} à la main (laissé${status.taken > 1 ? 's' : ''} tel${status.taken > 1 ? 's' : ''} quel${status.taken > 1 ? 's' : ''})` : ''}.
                </>
              ) : null}
            </p>
          )}
          {typeof status === 'string' && <p className="sport-error">{status}</p>}
        </>
      )}
      {error && choices !== null && (
        <p className="sport-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
