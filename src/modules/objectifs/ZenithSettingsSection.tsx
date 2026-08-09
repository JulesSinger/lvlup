import { ReminderSettings } from '../../core/components/ReminderSettings';
import { DAILY_GOAL_LEVELS } from '../../core/data/coreStore';
import type { ModuleSettingsProps } from '../../core/lib/module';

/**
 * Réglages propres à Zénith : le rythme quotidien et le rappel qui en
 * découle. Ils n'ont de sens que pour ce module — un module sans notion de
 * « jour bouclé » n'a pas à les voir apparaître dans ses réglages.
 */
export function ZenithSettingsSection({ user, settings, onChange }: ModuleSettingsProps) {
  return (
    <>
      <section className="settings-block">
        <h3 className="settings-title">Objectif du jour</h3>
        <p className="settings-hint">
          La cible de PP qui remplit l'anneau. Mieux vaut la placer bas et la dépasser souvent que
          l'inverse.
        </p>
        <div className="goal-levels">
          {DAILY_GOAL_LEVELS.map((level) => (
            <button
              key={level.pp}
              className={`goal-level${settings.dailyGoal === level.pp ? ' active' : ''}`}
              onClick={() => onChange({ dailyGoal: level.pp })}
            >
              <b>{level.label}</b>
              <span>{level.pp} PP</span>
              <i>{level.hint}</i>
            </button>
          ))}
        </div>
      </section>

      {user && !user.isLocal && <ReminderSettings settings={settings} onChange={onChange} />}
    </>
  );
}
