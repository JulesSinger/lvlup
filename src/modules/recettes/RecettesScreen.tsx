import { ModuleBrand } from '../../core/components/ModuleBrand';
import type { ModuleScreenProps } from '../../core/lib/module';

/**
 * Écran racine de Recettes.
 *
 * Étape 1 seulement (docs/etude-recettes.md §12) : le stockage existe dans
 * les deux modes, mais aucun écran n'est encore construit. Ce signet permet
 * au module d'exister et de se déclarer au hub ; les règles (étape 2), puis
 * le carnet et la fiche (étape 3) arrivent ensuite.
 */
export function RecettesScreen({ label, emoji, onSwitchModule }: ModuleScreenProps) {
  return (
    <div className="layout">
      <main className="main">
        <header className="topbar">
          <ModuleBrand label={label} emoji={emoji} onSwitchModule={onSwitchModule} />
        </header>
        <div className="recettes-placeholder">
          <span className="recettes-placeholder-emoji" aria-hidden="true">
            {emoji}
          </span>
          <h1 className="recettes-placeholder-title">{label} arrive bientôt</h1>
          <p className="recettes-placeholder-text">Ton carnet de recettes, le menu de la semaine et la liste de courses — en construction.</p>
        </div>
      </main>
    </div>
  );
}
