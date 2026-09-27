import type { ModuleScreenProps } from '../../core/lib/module';

/**
 * Écran racine de Polaris.
 *
 * Étape 1 seulement (docs/etude-taches.md §12, découpage révisé) : le
 * stockage existe dans les deux modes, mais aucun écran n'est encore
 * construit. Ce signet permet au module d'exister et de se déclarer au hub ;
 * les règles (étape 2) puis la V1 (étape 3) arrivent ensuite.
 */
export function TachesScreen({ onBackToHub }: ModuleScreenProps) {
  return (
    <div className="taches-placeholder">
      <span className="taches-placeholder-emoji" aria-hidden="true">
        ⭐
      </span>
      <h1 className="taches-placeholder-title">Polaris arrive bientôt</h1>
      <p className="taches-placeholder-text">La liste de tâches est en construction — rien à voir pour l'instant.</p>
      <button className="btn btn-ghost" onClick={onBackToHub}>
        ← Retour aux modules
      </button>
    </div>
  );
}
