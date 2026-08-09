import type { AtlasModule } from '../lib/module';
import type { AppUser } from '../lib/types';

/**
 * Écran d'accueil du hub : la liste des modules.
 *
 * Tant qu'il n'y en a qu'un, cliquer sa carte revient à y entrer directement.
 * Le composant ne suppose rien de leur contenu — il ne lit que `label`,
 * `emoji` et `id`, exactement ce que le socle est autorisé à connaître.
 */
export function ModulePicker({
  modules,
  user,
  onSelect,
  onOpenSettings,
}: {
  modules: readonly AtlasModule[];
  user: AppUser;
  onSelect: (id: string) => void;
  onOpenSettings: () => void;
}) {
  return (
    <div className="hub-picker">
      <header className="hub-picker-top">
        <div className="brand">
          <span className="brand-mark">▲</span>
          <span className="brand-name">Atlas</span>
        </div>
        <div className="hub-picker-actions">
          {user && (
            <span className="account" title={user.email}>
              {user.email}
            </span>
          )}
          <button className="btn btn-ghost btn-sm" onClick={onOpenSettings}>
            ⚙ Réglages
          </button>
        </div>
      </header>

      <main className="hub-picker-main">
        <h1 className="hub-picker-title">Tes modules</h1>
        <div className="hub-picker-grid">
          {modules.map((m) => (
            <button key={m.id} className="hub-picker-card" onClick={() => onSelect(m.id)}>
              <span className="hub-picker-emoji" aria-hidden="true">
                {m.emoji}
              </span>
              <span className="hub-picker-label">{m.label}</span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
