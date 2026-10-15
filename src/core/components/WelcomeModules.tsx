import { useState } from 'react';
import type { AtlasModule } from '../lib/module';
import type { AppUser } from '../lib/types';
import { STARTER_MODULES } from '../lib/workMode';
import AtlasMark from './AtlasMark';

/**
 * Le premier écran d'un compte tout neuf (15/10/2026) : plutôt que onze
 * modules d'un coup, Atlas demande par quoi commencer. Trois sont cochés
 * d'office (`STARTER_MODULES`), et rien n'est définitif — les autres
 * s'ajoutent dans les réglages, « Tout afficher » garde tout.
 */
export function WelcomeModules({
  modules,
  user,
  onChoose,
}: {
  modules: readonly AtlasModule[];
  user: AppUser;
  /** Les modules gardés, en identifiants (tous pour « Tout afficher »). */
  onChoose: (chosen: string[]) => void;
}) {
  const [chosen, setChosen] = useState<string[]>(() =>
    modules.filter((m) => (STARTER_MODULES as readonly string[]).includes(m.id)).map((m) => m.id),
  );
  const toggle = (id: string) => setChosen((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  const count = chosen.length;

  return (
    <div className="hub-picker atlas-welcome">
      <header className="hub-picker-top">
        <div className="brand">
          <AtlasMark />
          <span className="brand-name">Atlas</span>
        </div>
        <div className="hub-picker-actions">
          <span className="account" title={user.email}>
            {user.email}
          </span>
        </div>
      </header>

      <main className="hub-picker-main">
        <h1 className="hub-picker-title">Bienvenue dans Atlas</h1>
        <p className="atlas-welcome-lead">
          Par quoi veux-tu commencer ? Choisis les modules qui te servent : tu pourras en ajouter d’autres quand tu veux, dans
          les réglages.
        </p>
        <div className="hub-picker-grid atlas-welcome-grid" role="group" aria-label="Modules à afficher">
          {modules.map((m) => {
            const on = chosen.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                className={`hub-picker-card atlas-welcome-card${on ? ' on' : ''}`}
                aria-pressed={on}
                onClick={() => toggle(m.id)}
                style={{ ['--accent' as string]: m.accent }}
              >
                <span className="atlas-welcome-check" aria-hidden="true">
                  {on ? '✓' : ''}
                </span>
                <span className="hub-picker-glyph" aria-hidden="true">
                  {m.emoji}
                </span>
                <span className="hub-picker-label">{m.label}</span>
                <span className="hub-picker-description">{m.description}</span>
              </button>
            );
          })}
        </div>
        <div className="atlas-welcome-actions">
          <button type="button" className="btn btn-primary" disabled={count === 0} onClick={() => onChoose(chosen)}>
            {count === 0 ? 'Choisis au moins un module' : `Commencer avec ${count} module${count > 1 ? 's' : ''}`}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => onChoose(modules.map((m) => m.id))}>
            Tout afficher
          </button>
        </div>
      </main>
    </div>
  );
}
