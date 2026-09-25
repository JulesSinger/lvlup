import type { ModuleScreenProps } from '../../core/lib/module';

/**
 * Écran racine de Comète.
 *
 * Étape 1 seulement (docs/etude-courses.md §12, découpage révisé) : le
 * stockage existe dans les deux modes, mais aucun écran n'est encore
 * construit. Ce signet permet au module d'exister et de se déclarer au hub
 * sans rien casser ; la liste, la clôture d'une course et les statistiques
 * arrivent aux étapes suivantes.
 */
export function CoursesScreen({ onBackToHub }: ModuleScreenProps) {
  return (
    <div className="courses-placeholder">
      <span className="courses-placeholder-emoji" aria-hidden="true">
        ☄️
      </span>
      <h1 className="courses-placeholder-title">Comète arrive bientôt</h1>
      <p className="courses-placeholder-text">
        Le module de liste de courses est en construction — rien à voir pour l'instant.
      </p>
      <button className="btn btn-ghost" onClick={onBackToHub}>
        ← Retour aux modules
      </button>
    </div>
  );
}
