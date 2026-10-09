import { useEffect, useState } from 'react';
import { connectStrava, disconnectStrava, stravaAvailable, stravaStatus, syncStrava, type StravaStatus } from '../data/strava';
import { Modal } from './Modal';

const since = (iso: string) => {
  const minutes = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  return new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

/**
 * Relier Strava (docs/etude-sport.md §21) : une autorisation donnée une fois
 * chez Strava, ensuite les nouvelles courses arrivent à chaque ouverture de
 * Sport. Le raccourci de l'Apple Watch reste accessible d'ici, en second.
 */
export function StravaLink({ onClose, onSynced, onOpenShortcut }: { onClose: () => void; onSynced: () => void; onOpenShortcut: () => void }) {
  const [status, setStatus] = useState<StravaStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!stravaAvailable) return;
    stravaStatus().then(setStatus, (err: unknown) => setError(err instanceof Error ? err.message : 'Strava ne répond pas.'));
  }, []);

  async function act(task: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNote('');
    try {
      await task();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Échec.');
    }
    setBusy(false);
  }

  return (
    <Modal title="Relier Strava" onClose={onClose}>
      <p className="sport-hint sport-strava-intro">
        Tes courses enregistrées sur Strava arrivent dans Sport toutes seules, à chaque ouverture : distance, durée, dénivelé, fréquence
        cardiaque et temps au kilomètre. Atlas ne fait que lire ; il n’écrit jamais rien chez Strava.
      </p>

      {!stravaAvailable ? (
        <p className="sport-strava-local" role="note">
          Relier Strava demande d’être connecté avec un compte : c’est le serveur d’Atlas qui parle à Strava. Sur cet appareil, Atlas fonctionne
          sans compte ; tu peux toujours reprendre l’archive Strava ou noter une sortie à la main.
        </p>
      ) : !status ? (
        !error && <p className="sport-hint">…</p>
      ) : !status.configured ? (
        <p className="sport-strava-local" role="note">
          Le serveur n’a pas encore les clés de l’application Strava. Une fois l’application déclarée sur strava.com/settings/api, il faut les
          poser avec <code>supabase secrets set STRAVA_CLIENT_ID=… STRAVA_CLIENT_SECRET=…</code>.
        </p>
      ) : status.connected ? (
        <div className="sport-strava-on">
          <p className="sport-strava-state">
            <span className="sport-strava-dot" aria-hidden="true" /> Relié{status.athleteName ? ` au compte de ${status.athleteName}` : ''}
          </p>
          <p className="sport-hint">Dernière synchronisation : {status.lastSyncAt ? since(status.lastSyncAt) : 'jamais'}.</p>
          <div className="sport-strava-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={busy}
              onClick={() =>
                void act(async () => {
                  const result = await syncStrava(true);
                  setNote(result.message);
                  setStatus(await stravaStatus());
                  if (result.added > 0) onSynced();
                })
              }
            >
              {busy ? 'Synchronisation…' : 'Synchroniser maintenant'}
            </button>
            {leaving ? (
              <>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  disabled={busy}
                  onClick={() =>
                    void act(async () => {
                      await disconnectStrava();
                      setLeaving(false);
                      setStatus(await stravaStatus());
                    })
                  }
                >
                  Déconnecter pour de bon
                </button>
                <button type="button" className="btn btn-sm" onClick={() => setLeaving(false)}>
                  Garder
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLeaving(true)}>
                Déconnecter
              </button>
            )}
          </div>
          {leaving && <p className="sport-hint">Les sorties déjà reçues restent dans Sport.</p>}
        </div>
      ) : (
        <div className="sport-strava-off">
          <button type="button" className="btn sport-strava-connect" disabled={busy} onClick={() => void act(connectStrava)}>
            Se connecter avec Strava
          </button>
          <p className="sport-hint">
            Strava te demande d’autoriser Atlas à lire tes activités, puis te ramène ici. Les sorties déjà reprises de l’archive ne sont pas
            ajoutées deux fois.
          </p>
        </div>
      )}

      {note && (
        <p className="sport-strava-note" role="status">
          {note}
        </p>
      )}
      {error && <p className="settings-problem">{error}</p>}

      <p className="sport-hint sport-strava-other">
        Sans Strava ?{' '}
        <button type="button" className="sport-link" onClick={onOpenShortcut}>
          Relier l’Apple Watch par un raccourci
        </button>
      </p>
    </Modal>
  );
}
