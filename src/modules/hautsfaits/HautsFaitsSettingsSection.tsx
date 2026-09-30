import { useEffect, useState } from 'react';
import { dayString } from '../../core/lib/day';
import { hautsFaitsStore } from './data';
import { settingsChanged } from './data/settingsSignal';
import { DEFAULT_HAUTSFAITS_SETTINGS, type HautsFaitsSettings } from './lib/types';

/**
 * La date de naissance, dans le panneau de réglages commun. Facultative :
 * sans elle, la frise ne dit pas l'âge qu'on avait (docs/etude-hauts-faits.md
 * §3). Elle est rangée avec le compte, pas sur l'appareil.
 */
export function HautsFaitsSettingsSection() {
  const [settings, setSettings] = useState<HautsFaitsSettings | null>(null);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    hautsFaitsStore.getSettings().then(setSettings, () => setSettings({ ...DEFAULT_HAUTSFAITS_SETTINGS }));
  }, []);

  async function change(birthDate: string | null) {
    if (!settings) return;
    const next = { ...settings, birthDate };
    setSettings(next);
    setProblem('');
    try {
      await hautsFaitsStore.saveSettings({ birthDate });
      settingsChanged(next);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Enregistrement impossible.');
    }
  }

  if (!settings) return null;

  return (
    <section className="settings-block hautsfaits-settings">
      <h3 className="settings-title">Ta date de naissance</h3>
      <p className="settings-hint">Pour que la frise de tes hauts faits dise l’âge que tu avais. Facultative.</p>
      <label className="settings-time">
        <span>Née ou né le</span>
        <input
          type="date"
          aria-label="Date de naissance"
          max={dayString()}
          value={settings.birthDate ?? ''}
          onChange={(e) => void change(e.target.value || null)}
        />
      </label>
      {problem && <p className="settings-problem">{problem}</p>}
    </section>
  );
}
