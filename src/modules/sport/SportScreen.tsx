import { ModuleBrand } from '../../core/components/ModuleBrand';
import type { ModuleScreenProps } from '../../core/lib/module';

/**
 * Écran racine de Sport.
 *
 * Étape 1 seulement (docs/etude-sport.md §12) : le stockage existe dans les
 * deux modes, mais aucun écran n'est encore construit. Ce signet permet au
 * module d'exister et de se déclarer au hub ; les règles (étape 2), puis
 * l'historique et le journal (étape 3) et le plan marathon (étape 4) arrivent
 * ensuite.
 */
export function SportScreen({ label, emoji, onSwitchModule }: ModuleScreenProps) {
  return (
    <div className="layout">
      <main className="main">
        <header className="topbar">
          <ModuleBrand label={label} emoji={emoji} onSwitchModule={onSwitchModule} />
        </header>
        <div className="sport-placeholder">
          <span className="sport-placeholder-emoji" aria-hidden="true">
            {emoji}
          </span>
          <h1 className="sport-placeholder-title">{label} arrive bientôt</h1>
          <p className="sport-placeholder-text">Tes sorties de course, ta progression et ton plan marathon — en construction.</p>
        </div>
      </main>
    </div>
  );
}
