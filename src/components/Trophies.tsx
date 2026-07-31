import type { UnlockedAchievement } from '../data/store';
import { ACHIEVEMENTS } from '../lib/achievements';
import { formatDate } from '../lib/progress';

/**
 * Salle des trophées : les débloqués brillent (avec leur date), les autres
 * restent en silhouette avec leur condition affichée — on sait toujours quoi
 * viser. Un trophée acquis l'est pour toujours.
 */
export function Trophies({ achievements }: { achievements: UnlockedAchievement[] }) {
  const byId = new Map(achievements.map((a) => [a.id, a]));
  const base = ACHIEVEMENTS.filter((a) => a.family === 'base');
  const rare = ACHIEVEMENTS.filter((a) => a.family === 'rare');

  return (
    <div className="trophies">
      <p className="trophies-score">
        {achievements.length}/{ACHIEVEMENTS.length} trophées débloqués
      </p>

      {[
        { title: 'Premiers exploits', items: base },
        { title: 'Hauts faits', items: rare },
      ].map(({ title, items }) => (
        <section key={title} className="trophy-family">
          <h2 className="trophy-family-title">{title}</h2>
          <div className="trophy-grid">
            {items.map((a) => {
              const unlocked = byId.get(a.id);
              return (
                <article
                  key={a.id}
                  className={`trophy${unlocked ? ' unlocked' : ' locked'}`}
                  title={
                    unlocked ? `${a.name} — débloqué le ${formatDate(unlocked.unlockedAt)}` : a.desc
                  }
                >
                  <span className="trophy-icon" aria-hidden="true">
                    {a.icon}
                  </span>
                  <span className="trophy-name">{a.name}</span>
                  <span className="trophy-desc">{a.desc}</span>
                  {unlocked && (
                    <span className="trophy-state">{formatDate(unlocked.unlockedAt)}</span>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
