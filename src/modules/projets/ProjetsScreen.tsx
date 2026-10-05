import { ModuleBrand } from '../../core/components/ModuleBrand';
import type { ModuleScreenProps } from '../../core/lib/module';

/**
 * Écran racine de Projets.
 *
 * Étape 1 seulement (docs/etude-projets.md §10) : le stockage existe dans
 * les deux modes, mais aucun écran n'est encore construit. Ce signet permet
 * au module d'exister et de se déclarer au hub ; les règles (étape 2) puis
 * le tableau de bord et la fiche projet (étape 3) arrivent ensuite.
 */
export function ProjetsScreen({ label, emoji, onSwitchModule }: ModuleScreenProps) {
  return (
    <div className="layout">
      <main className="main">
        <header className="topbar">
          <ModuleBrand label={label} emoji={emoji} onSwitchModule={onSwitchModule} />
        </header>
        <div className="projets-placeholder">
          <span className="projets-placeholder-emoji" aria-hidden="true">
            {emoji}
          </span>
          <h1 className="projets-placeholder-title">{label} arrive bientôt</h1>
          <p className="projets-placeholder-text">Tes projets clients, leurs chantiers et leurs échéances — en construction.</p>
        </div>
      </main>
    </div>
  );
}
