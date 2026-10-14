import { useRef } from 'react';
import type { AtlasModule } from '../lib/module';
import type { AppUser } from '../lib/types';
import AtlasMark from './AtlasMark';
import { useReorderDrag } from './useReorderDrag';

/**
 * Écran d'accueil du hub : la liste des modules.
 *
 * Tant qu'il n'y en a qu'un, cliquer sa carte revient à y entrer directement.
 * Le composant ne suppose rien de leur contenu — il ne lit que `label`,
 * `description`, `emoji` et `id`, exactement ce que le socle est autorisé à
 * connaître. Les cartes s'y glissent pour changer l'ordre des modules
 * (13/10/2026), le même que dans la barre de gauche et la grille.
 */
export function ModulePicker({
  modules,
  user,
  onSelect,
  onOpenSettings,
  onReorder,
  workMode,
  onToggleWorkMode,
}: {
  modules: readonly AtlasModule[];
  user: AppUser;
  onSelect: (id: string) => void;
  onOpenSettings: () => void;
  /** L'ordre des modules après un glisser. */
  onReorder: (order: string[]) => void;
  /** Le mode « au travail » (14/10/2026). */
  workMode: boolean;
  onToggleWorkMode: () => void;
}) {
  const grid = useRef<HTMLDivElement>(null);
  const drag = useReorderDrag(
    modules.map((m) => m.id),
    grid,
    onReorder,
  );
  const byId = new Map(modules.map((m) => [m.id, m]));
  return (
    <div className="hub-picker">
      <header className="hub-picker-top">
        <div className="brand">
          <AtlasMark />
          <span className="brand-name">Atlas</span>
        </div>
        <div className="hub-picker-actions">
          {user && (
            <span className="account" title={user.email}>
              {user.email}
            </span>
          )}
          <button className={`btn btn-ghost btn-sm atlas-work-toggle${workMode ? ' on' : ''}`} onClick={onToggleWorkMode} aria-pressed={workMode}>
            💼 Mode travail
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onOpenSettings}>
            ⚙ Réglages
          </button>
        </div>
      </header>

      <main className="hub-picker-main">
        <h1 className="hub-picker-title">Tes modules</h1>
        {workMode && (
          <p className="atlas-work-banner" role="status">
            💼 Mode travail : seuls les modules du travail sont visibles, et seulement ce qui est marqué « travail ».
          </p>
        )}
        <div className="hub-picker-grid" ref={grid}>
          {drag.order.flatMap((id) => byId.get(id) ?? []).map((m) => (
            <button
              key={m.id}
              {...drag.itemProps(m.id)}
              className={`hub-picker-card${drag.draggingId === m.id ? ' atlas-dragging' : ''}`}
              onClick={() => onSelect(m.id)}
              style={{ ['--accent' as string]: m.accent }}
            >
              <span className="hub-picker-glyph" aria-hidden="true">
                {m.emoji}
              </span>
              <span className="hub-picker-label">{m.label}</span>
              <span className="hub-picker-description">{m.description}</span>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
