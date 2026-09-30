import type { AtlasModule } from '../lib/module';
import AtlasMark from './AtlasMark';

/**
 * La barre d'icônes, à gauche de chaque module sur ordinateur : un clic pour
 * passer d'un module à l'autre (décision de Jules, 30/09/2026). La marque
 * d'Atlas en haut ramène à la liste. Pas de bouton des réglages : chaque
 * module a déjà le sien en haut, un second au même écran ferait doublon.
 * Masquée sur téléphone, où le nom du module en haut ouvre la grille à la
 * place. Un bouton se nomme « Ouvrir Budget » (l'infobulle dit « Budget ») :
 * ce qu'il fait, et pas le même nom que ce que le module montre chez lui.
 *
 * Le socle ne lit des modules que ce qu'il a le droit de connaître : `id`,
 * `label`, `emoji`, `accent`.
 */
export function ModuleRail({
  modules,
  activeId,
  onSelect,
  onHome,
}: {
  modules: readonly AtlasModule[];
  activeId: string;
  onSelect: (id: string) => void;
  onHome: () => void;
}) {
  return (
    <nav className="atlas-rail" aria-label="Modules">
      <button className="atlas-rail-btn atlas-rail-home" onClick={onHome} aria-label="Tous les modules" data-tip="Tous les modules">
        <AtlasMark className="atlas-rail-mark" />
      </button>
      <ul className="atlas-rail-list">
        {modules.map((m) => (
          <li key={m.id}>
            <button
              className="atlas-rail-btn atlas-rail-module"
              onClick={() => onSelect(m.id)}
              aria-label={`Ouvrir ${m.label}`}
              aria-current={m.id === activeId ? 'page' : undefined}
              data-tip={m.label}
              style={{ ['--atlas-module-accent' as string]: m.accent }}
            >
              <span aria-hidden="true">{m.emoji}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
