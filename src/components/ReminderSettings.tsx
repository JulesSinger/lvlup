import { useCallback, useEffect, useState } from 'react';
import { store } from '../data';
import type { PushDevice, Settings } from '../data/store';
import {
  VAPID_PUBLIC_KEY,
  isIOS,
  pushStatus,
  subscribeToPush,
  timezoneOffsetMinutes,
  unsubscribeFromPush,
  type PushStatus,
} from '../lib/push';

/**
 * Réglage du rappel quotidien.
 *
 * Le composant est bavard à dessein : les notifications sont l'endroit où tout
 * peut silencieusement ne pas marcher (app pas installée, autorisation
 * refusée, abonnement expiré). Plutôt qu'un interrupteur qui ne fait rien, on
 * dit toujours *pourquoi* et *comment réparer*, et on offre un envoi de test
 * pour vérifier la chaîne complète sans attendre l'heure dite.
 */
export function ReminderSettings({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}) {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [devices, setDevices] = useState<PushDevice[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [problem, setProblem] = useState('');

  const reload = useCallback(async () => {
    setStatus(await pushStatus());
    try {
      setDevices(await store.listPushDevices());
    } catch {
      setDevices([]);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function enable() {
    setBusy(true);
    setProblem('');
    setMessage('');
    try {
      const subscription = await subscribeToPush();
      await store.savePushDevice(subscription);
      onChange({
        reminderEnabled: true,
        reminderTime: settings.reminderTime,
        tzOffset: timezoneOffsetMinutes(),
      });
      setMessage('Cet appareil recevra le rappel.');
      await reload();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Activation impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setProblem('');
    setMessage('');
    try {
      const endpoint = await unsubscribeFromPush();
      if (endpoint) await store.removePushDevice(endpoint);
      onChange({ reminderEnabled: false });
      await reload();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Désactivation impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setProblem('');
    setMessage('');
    try {
      const { sent } = await store.sendTestPush();
      setMessage(
        `Envoyé sur ${sent} appareil${sent > 1 ? 's' : ''} — la notification arrive dans quelques secondes.`,
      );
    } catch (err) {
      const raison = err instanceof Error ? err.message : 'Test impossible.';
      // Un échec sans explication fait perdre une soirée. On interroge la
      // fonction dans la foulée pour dire ce qui manque, précisément.
      try {
        const d = await store.pingPushFunction();
        const manquants = [
          !d.vapidPublic && 'VAPID_PUBLIC_KEY',
          !d.vapidPrivate && 'VAPID_PRIVATE_KEY',
          !d.vapidSubject && 'VAPID_SUBJECT',
        ].filter(Boolean);
        if (manquants.length > 0) {
          setProblem(
            `La fonction répond (version ${d.version}) mais il lui manque ${manquants.join(', ')}. ` +
              'À définir dans Supabase → Edge Functions → Secrets.',
          );
        } else if (VAPID_PUBLIC_KEY && !VAPID_PUBLIC_KEY.startsWith(d.serverKeyPrefix)) {
          setProblem(
            "La clé publique du build ne correspond pas à celle du serveur : réabonne cet appareil après avoir aligné VITE_VAPID_PUBLIC_KEY sur la clé VAPID du serveur.",
          );
        } else {
          setProblem(`${raison} (fonction joignable, version ${d.version})`);
        }
      } catch {
        setProblem(raison);
      }
    } finally {
      setBusy(false);
    }
  }

  async function forget(device: PushDevice) {
    setBusy(true);
    try {
      await store.removePushDevice(device.endpoint);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  if (!status) return null;

  const enabled = settings.reminderEnabled && status.subscribed;

  return (
    <section className="settings-block">
      <h3 className="settings-title">Rappel quotidien</h3>
      <p className="settings-hint">
        Une notification à l'heure que tu choisis — et rien du tout les jours où tu as déjà
        agi. Un rappel inutile est la meilleure façon de se faire couper le son.
      </p>

      {status.availability === 'needs-install' && (
        <div className="notice info install-guide">
          <strong>Une étape avant, sur iPhone.</strong> Apple n'autorise les notifications que
          depuis une app installée sur l'écran d'accueil.
          <ol className="install-steps">
            <li>
              Dans Safari, touche <b>Partager</b> en bas de l'écran — le carré avec une flèche
              qui sort.
            </li>
            <li>
              Choisis <b>Sur l'écran d'accueil</b>, puis <b>Ajouter</b>.
            </li>
            <li>Ouvre Zénith depuis la nouvelle icône, et reviens ici.</li>
          </ol>
          <span className="install-note">
            iOS 16.4 ou plus. Depuis l'icône, tout le reste fonctionne exactement pareil.
          </span>
        </div>
      )}

      {status.availability === 'unsupported' && (
        <div className="notice info">
          Ce navigateur ne gère pas les notifications web.
          {isIOS()
            ? " Mets à jour iOS (16.4 minimum) puis réinstalle l'app depuis Safari."
            : ' Chrome, Firefox et Safari récents les prennent en charge.'}
        </div>
      )}

      {status.availability === 'no-key' && (
        <div className="notice info">
          La clé publique des notifications manque dans ce build (
          <code>VITE_VAPID_PUBLIC_KEY</code>). Ajoute-la aux variables de build, puis redéploie.
        </div>
      )}

      {status.availability === 'ok' && (
        <>
          <div className="settings-row">
            <label className="switch">
              <input
                type="checkbox"
                checked={enabled}
                disabled={busy}
                onChange={(e) => void (e.target.checked ? enable() : disable())}
              />
              <span>{enabled ? 'Activé sur cet appareil' : 'Désactivé'}</span>
            </label>

            <label className="settings-time">
              <span>À</span>
              <input
                type="time"
                value={settings.reminderTime}
                disabled={busy}
                onChange={(e) =>
                  onChange({ reminderTime: e.target.value, tzOffset: timezoneOffsetMinutes() })
                }
                aria-label="Heure du rappel"
              />
            </label>
          </div>

          {status.permission === 'denied' && (
            <div className="notice info">
              Les notifications sont bloquées pour ce site dans les réglages du navigateur. Il
              faut les réautoriser là-bas avant que l'interrupteur puisse fonctionner.
            </div>
          )}

          {devices.length > 0 && (
            <ul className="device-list">
              {devices.map((device) => (
                <li key={device.id}>
                  <span className="device-name">{device.label}</span>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => void forget(device)}
                    disabled={busy}
                    aria-label={`Retirer ${device.label}`}
                  >
                    Retirer
                  </button>
                </li>
              ))}
            </ul>
          )}

          {devices.length > 0 && (
            <button className="btn btn-sm" onClick={() => void test()} disabled={busy}>
              Envoyer une notification de test
            </button>
          )}
        </>
      )}

      {message && <p className="settings-ok">{message}</p>}
      {problem && <p className="settings-problem">{problem}</p>}
    </section>
  );
}
