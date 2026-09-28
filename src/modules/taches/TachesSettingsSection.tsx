import { useEffect, useState } from 'react';
import { NotificationSetup } from '../../core/components/NotificationSetup';
import type { ModuleSettingsProps } from '../../core/lib/module';
import { tachesStore } from './data';
import { syncReminders } from './data/syncReminders';
import { DEFAULT_TACHES_SETTINGS, type TachesSettings } from './lib/types';

/**
 * Les rappels de Polaris (étape 5), dans le panneau de réglages commun : à
 * l'heure des tâches qui en ont une, et le résumé du matin. Les réglages
 * sont les mêmes sur tous les appareils ; les notifications, elles,
 * s'activent appareil par appareil (`NotificationSetup`, au socle).
 */
export function TachesSettingsSection({ user }: ModuleSettingsProps) {
  const [settings, setSettings] = useState<TachesSettings | null>(null);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    tachesStore.getSettings().then(setSettings, () => setSettings({ ...DEFAULT_TACHES_SETTINGS }));
  }, []);

  async function change(patch: Partial<TachesSettings>) {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    setProblem('');
    try {
      await tachesStore.saveSettings(patch);
      await syncReminders(undefined, next);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Enregistrement impossible.');
    }
  }

  if (!settings) return null;
  const local = !user || user.isLocal;

  return (
    <section className="settings-block taches-settings">
      <h3 className="settings-title">Rappels des tâches</h3>
      <p className="settings-hint">
        Une notification à l’heure d’une tâche qui en a une, et un résumé le matin — seulement les jours où il y a
        quelque chose à faire.
      </p>
      {local ? (
        // Comme le rappel de Zénith : sans serveur, rien ne peut partir — pas d'interrupteur qui ne ferait rien.
        <div className="notice info">Les rappels demandent un compte : sans serveur, rien ne peut partir.</div>
      ) : (
        <>
          <label className="switch">
            <input type="checkbox" checked={settings.taskReminders} onChange={(e) => void change({ taskReminders: e.target.checked })} />
            <span>À l’heure des tâches</span>
          </label>

          <div className="settings-row">
            <label className="switch">
              <input type="checkbox" checked={settings.morningEnabled} onChange={(e) => void change({ morningEnabled: e.target.checked })} />
              <span>Le résumé du matin</span>
            </label>
            <label className="settings-time">
              <span>À</span>
              <input
                type="time"
                aria-label="Heure du résumé du matin"
                value={settings.morningTime}
                disabled={!settings.morningEnabled}
                onChange={(e) => e.target.value && void change({ morningTime: e.target.value })}
              />
            </label>
          </div>

          <NotificationSetup />
        </>
      )}
      {problem && <p className="settings-problem">{problem}</p>}
    </section>
  );
}
