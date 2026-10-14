import { useRef } from 'react';
import type { AtlasModule } from '../lib/module';
import AtlasMark from './AtlasMark';
import { useReorderDrag } from './useReorderDrag';

/**
 * La barre d'icônes, à gauche de chaque module sur ordinateur : un clic pour
 * passer d'un module à l'autre (décision de Jules, 30/09/2026). La marque
 * d'Atlas en haut ramène à la liste. Pas de bouton des réglages : chaque
 * module a déjà le sien en haut, un second au même écran ferait doublon.
 * Masquée sur téléphone, où le nom du module en haut ouvre la grille à la
 * place. Un bouton se nomme « Ouvrir Budget » (l'infobulle dit « Budget ») :
 * ce qu'il fait, et pas le même nom que ce que le module montre chez lui.
 *
 * Les modules s'y glissent pour changer leur ordre (13/10/2026), le même que
 * dans la grille ; un clic les ouvre toujours.
 *
 * Le socle ne lit des modules que ce qu'il a le droit de connaître : `id`,
 * `label`, `emoji`, `accent`.
 */
export function ModuleRail({
  modules,
  activeId,
  onSelect,
  onHome,
  onReorder,
  workMode,
  onToggleWorkMode,
}: {
  modules: readonly AtlasModule[];
  activeId: string;
  onSelect: (id: string) => void;
  onHome: () => void;
  /** L'ordre des modules après un glisser. */
  onReorder: (order: string[]) => void;
  /** Le mode « au travail » (14/10/2026), basculé d'un clic. */
  workMode: boolean;
  onToggleWorkMode: () => void;
}) {
  const list = useRef<HTMLUListElement>(null);
  const drag = useReorderDrag(
    modules.map((m) => m.id),
    list,
    onReorder,
  );
  const byId = new Map(modules.map((m) => [m.id, m]));
  return (
    <nav className="atlas-rail" aria-label="Modules">
      <button className="atlas-rail-btn atlas-rail-home" onClick={onHome} aria-label="Tous les modules" data-tip="Tous les modules">
        <AtlasMark className="atlas-rail-mark" />
      </button>
      <button
        className={`atlas-rail-btn atlas-rail-work${workMode ? ' on' : ''}`}
        onClick={onToggleWorkMode}
        aria-pressed={workMode}
        aria-label="Mode travail"
        data-tip={workMode ? 'Mode travail : activé' : 'Mode travail'}
      >
        <span aria-hidden="true">💼</span>
      </button>
      <ul className="atlas-rail-list" ref={list}>
        {drag.order.flatMap((id) => byId.get(id) ?? []).map((m) => (
          <li key={m.id}>
            <button
              {...drag.itemProps(m.id)}
              className={`atlas-rail-btn atlas-rail-module${drag.draggingId === m.id ? ' atlas-dragging' : ''}`}
              onClick={() => onSelect(m.id)}
              aria-label={`Ouvrir ${m.label}`}
              aria-current={m.id === activeId ? 'page' : undefined}
              data-tip={drag.draggingId ? undefined : m.label}
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
