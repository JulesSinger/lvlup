import type { ModuleScreenProps } from '../../core/lib/module';

/**
 * Écran racine d'Astra.
 *
 * Étape 1 seulement (docs/etude-astra.md §7) : le stockage existe dans les
 * deux modes, mais aucun écran n'est encore construit. Ce signet permet au
 * module d'exister et de se déclarer au hub sans rien casser ; catégories,
 * saisie, camembert et import arrivent aux étapes suivantes.
 */
export function BudgetScreen({ onBackToHub }: ModuleScreenProps) {
  return (
    <div className="budget-placeholder">
      <span className="budget-placeholder-emoji" aria-hidden="true">
        ✦
      </span>
      <h1 className="budget-placeholder-title">Astra arrive bientôt</h1>
      <p className="budget-placeholder-text">
        Le module budget est en construction — rien à voir pour l'instant.
      </p>
      <button className="btn btn-ghost" onClick={onBackToHub}>
        ← Retour aux modules
      </button>
    </div>
  );
}
