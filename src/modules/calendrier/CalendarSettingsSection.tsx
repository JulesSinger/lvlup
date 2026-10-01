import { useEffect, useState } from 'react';
import { NotificationSetup } from '../../core/components/NotificationSetup';
import type { ModuleSettingsProps } from '../../core/lib/module';
import { ReminderPicker } from './components/ReminderPicker';
import { calendarStore } from './data';
import { syncReminders } from './data/syncReminders';
import { ALL_DAY_REMINDERS, DEFAULT_CALENDAR_SETTINGS, TIMED_REMINDERS, type CalendarSettings } from './lib/types';

/**
 * Les rappels par défaut d'Éclipse, dans le panneau de réglages commun :
 * ceux que prend un événement tant qu'on ne lui en a pas choisi d'autres
 * (01/10/2026). Les mêmes sur tous les appareils ; les notifications, elles,
 * s'activent appareil par appareil (`NotificationSetup`, au socle).
 */
export function CalendarSettingsSection({ user }: ModuleSettingsProps) {
  const [settings, setSettings] = useState<CalendarSettings | null>(null);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    calendarStore.getSettings().then(setSettings, () => setSettings({ ...DEFAULT_CALENDAR_SETTINGS }));
  }, []);

  async function change(patch: Partial<CalendarSettings>) {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    setProblem('');
    try {
      await calendarStore.saveSettings(patch);
      await syncReminders(undefined, undefined, next);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Enregistrement impossible.');
    }
  }

  if (!settings) return null;
  const local = !user || user.isLocal;

  return (
    <section className="settings-block calendrier-settings">
      <h3 className="settings-title">Rappels du calendrier</h3>
      <p className="settings-hint">
        Ceux que prend un événement tant que tu ne lui en choisis pas d’autres. Deux au plus.
      </p>
      {local ? (
        // Comme Tâches : sans serveur, rien ne peut partir — pas de réglage qui ne ferait rien.
        <div className="notice info">Les rappels demandent un compte : sans serveur, rien ne peut partir.</div>
      ) : (
        <>
          <ReminderPicker
            label="Avec une heure"
            idPrefix="calendrier-default-timed"
            options={TIMED_REMINDERS}
            value={settings.timedReminders}
            onChange={(timedReminders) => void change({ timedReminders })}
          />
          <ReminderPicker
            label="Toute la journée"
            idPrefix="calendrier-default-allday"
            options={ALL_DAY_REMINDERS}
            value={settings.allDayReminders}
            onChange={(allDayReminders) => void change({ allDayReminders })}
          />
          <NotificationSetup />
        </>
      )}
      {problem && <p className="settings-problem">{problem}</p>}
    </section>
  );
}
