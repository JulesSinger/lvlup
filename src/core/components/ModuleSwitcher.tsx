import { useEffect, useRef } from 'react';
import type { AtlasModule } from '../lib/module';
import AtlasMark from './AtlasMark';

/**
 * La grille des modules : ouverte en touchant le nom du module en haut de son
 * écran, ou par ⌘K / Ctrl+K. Sur téléphone elle monte du bas, à portée de
 * pouce ; sur ordinateur, un panneau au centre. Toucher un module y va ;
 * Échap, la croix ou un toucher à côté ferment — il n'y a rien à perdre ici.
 */
export function ModuleSwitcher({
  modules,
  activeId,
  onSelect,
  onHome,
  onClose,
}: {
  modules: readonly AtlasModule[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onHome: () => void;
  onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Le module ouvert reçoit le focus : Entrée ou Échap le laissent où il est.
    panel.current?.querySelector<HTMLButtonElement>('[aria-current="page"], .atlas-switcher-module')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div className="atlas-switcher-overlay" onClick={onClose}>
      <div
        ref={panel}
        className="atlas-switcher"
        role="dialog"
        aria-modal="true"
        aria-labelledby="atlas-switcher-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="atlas-switcher-head">
          <h2 id="atlas-switcher-title" className="atlas-switcher-title">
            Changer de module
          </h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <ul className="atlas-switcher-grid">
          {modules.map((m) => (
            <li key={m.id}>
              <button
                className="atlas-switcher-module"
                onClick={() => onSelect(m.id)}
                aria-current={m.id === activeId ? 'page' : undefined}
                style={{ ['--atlas-module-accent' as string]: m.accent }}
              >
                <span className="atlas-switcher-glyph" aria-hidden="true">
                  {m.emoji}
                </span>
                <span className="atlas-switcher-label">{m.label}</span>
              </button>
            </li>
          ))}
        </ul>
        <button className="atlas-switcher-home" onClick={onHome}>
          <AtlasMark className="atlas-mark-inline" /> Tous les modules
        </button>
      </div>
    </div>
  );
}
