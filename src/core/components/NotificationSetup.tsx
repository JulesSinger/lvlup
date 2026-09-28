import { useCallback, useEffect, useState } from 'react';
import { coreStore } from '../data';
import { isIOS, pushStatus, subscribeToPush, type PushStatus } from '../lib/push';

/**
 * Les notifications sur **cet appareil**, pour la section de réglages d'un
 * module qui envoie des rappels (Polaris le premier, 28/09/2026). Un
 * appareil abonné reçoit les rappels de tous les modules : l'abonnement est
 * au socle, chaque module ne décide que de ce qu'il envoie.
 *
 * Même souci que `ReminderSettings` : dire pourquoi ça ne marche pas plutôt
 * qu'un bouton qui ne fait rien.
 */
export function NotificationSetup() {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [problem, setProblem] = useState('');

  const reload = useCallback(async () => setStatus(await pushStatus()), []);
  useEffect(() => {
    void reload();
  }, [reload]);

  async function run(action: () => Promise<string>) {
    setBusy(true);
    setMessage('');
    setProblem('');
    try {
      setMessage(await action());
      await reload();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Impossible pour l’instant.');
    } finally {
      setBusy(false);
    }
  }

  if (!status) return null;

  return (
    <div className="notification-setup">
      {status.availability === 'needs-install' && (
        <div className="notice info">
          Sur iPhone, les notifications ne marchent que depuis l’app installée : dans Safari, <b>Partager</b> puis{' '}
          <b>Sur l’écran d’accueil</b>, et ouvre Atlas depuis la nouvelle icône.
        </div>
      )}
      {status.availability === 'unsupported' && (
        <div className="notice info">
          Ce navigateur ne gère pas les notifications web
          {isIOS() ? ' : mets à jour iOS (16.4 minimum).' : '.'}
        </div>
      )}
      {(status.availability === 'no-sw' || status.availability === 'no-key') && (
        <div className="notice info">Les notifications ne sont pas disponibles dans cette version de l’app.</div>
      )}
      {status.availability === 'ok' &&
        (status.subscribed ? (
          <div className="settings-row">
            <span className="settings-ok">✓ Cet appareil reçoit les notifications.</span>
            <button
              className="btn btn-sm"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const { sent } = await coreStore.sendTestPush();
                  return `Envoyé sur ${sent} appareil${sent > 1 ? 's' : ''}.`;
                })
              }
            >
              Tester
            </button>
          </div>
        ) : (
          <button
            className="btn btn-sm"
            disabled={busy || status.permission === 'denied'}
            onClick={() =>
              void run(async () => {
                await coreStore.savePushDevice(await subscribeToPush());
                return 'Cet appareil recevra les rappels.';
              })
            }
          >
            Activer les notifications sur cet appareil
          </button>
        ))}
      {status.availability === 'ok' && status.permission === 'denied' && (
        <div className="notice info">Les notifications sont bloquées pour ce site dans les réglages du navigateur.</div>
      )}
      {message && <p className="settings-ok">{message}</p>}
      {problem && <p className="settings-problem">{problem}</p>}
    </div>
  );
}
