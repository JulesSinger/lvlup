import { ACHIEVEMENTS, unlockedAchievements } from '../lib/achievements';
import type { Checkin, Goal } from '../lib/types';

/**
 * Salle des trophées : les débloqués brillent, les autres restent en silhouette
 * avec leur condition affichée — on sait toujours quoi viser.
 */
export function Trophies({ goals, checkins }: { goals: Goal[]; checkins: Checkin[] }) {
  const unlocked = unlockedAchievements({ goals, checkins });
  const base = ACHIEVEMENTS.filter((a) => a.family === 'base');
  const rare = ACHIEVEMENTS.filter((a) => a.family === 'rare');

  return (
    <div className="trophies">
      <p className="trophies-score">
        {unlocked.size}/{ACHIEVEMENTS.length} trophées débloqués
      </p>

      {[
        { title: 'Premiers exploits', items: base },
        { title: 'Hauts faits', items: rare },
      ].map(({ title, items }) => (
        <section key={title} className="trophy-family">
          <h2 className="trophy-family-title">{title}</h2>
          <div className="trophy-grid">
            {items.map((a) => {
              const isUnlocked = unlocked.has(a.id);
              return (
                <article
                  key={a.id}
                  className={`trophy${isUnlocked ? ' unlocked' : ' locked'}`}
                  title={isUnlocked ? `${a.name} — débloqué` : a.desc}
                >
                  <span className="trophy-icon" aria-hidden="true">
                    {a.icon}
                  </span>
                  <span className="trophy-name">{a.name}</span>
                  <span className="trophy-desc">{a.desc}</span>
                  {isUnlocked && <span className="trophy-state">Débloqué</span>}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
