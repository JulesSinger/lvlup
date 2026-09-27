import type { ModuleScreenProps } from '../../core/lib/module';

/**
 * Écran racine d'Éclipse.
 *
 * Étape 1 seulement (docs/etude-calendrier.md §12, découpage révisé) : le
 * stockage existe dans les deux modes, mais aucun écran n'est encore
 * construit. Ce signet permet au module d'exister et de se déclarer au hub ;
 * la récurrence (étape 2) puis les quatre vues (étape 3) arrivent ensuite.
 */
export function CalendarScreen({ onBackToHub }: ModuleScreenProps) {
  return (
    <div className="calendrier-placeholder">
      <span className="calendrier-placeholder-emoji" aria-hidden="true">
        🌒
      </span>
      <h1 className="calendrier-placeholder-title">Éclipse arrive bientôt</h1>
      <p className="calendrier-placeholder-text">
        Le calendrier est en construction — rien à voir pour l'instant.
      </p>
      <button className="btn btn-ghost" onClick={onBackToHub}>
        ← Retour aux modules
      </button>
    </div>
  );
}
