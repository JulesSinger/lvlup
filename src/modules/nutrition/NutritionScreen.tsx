import type { ModuleScreenProps } from '../../core/lib/module';

/**
 * Écran racine de Cérès.
 *
 * Étape 1 seulement (docs/etude-nutrition.md §10) : le stockage existe dans
 * les deux modes, mais aucun écran n'est encore construit. Ce signet permet
 * au module d'exister et de se déclarer au hub sans rien casser ; base
 * d'aliments, journal du jour et objectifs arrivent aux étapes suivantes.
 */
export function NutritionScreen({ onBackToHub }: ModuleScreenProps) {
  return (
    <div className="nutrition-placeholder">
      <span className="nutrition-placeholder-emoji" aria-hidden="true">
        🌾
      </span>
      <h1 className="nutrition-placeholder-title">Cérès arrive bientôt</h1>
      <p className="nutrition-placeholder-text">
        Le module de suivi des calories et des macronutriments est en construction — rien à voir
        pour l'instant.
      </p>
      <button className="btn btn-ghost" onClick={onBackToHub}>
        ← Retour aux modules
      </button>
    </div>
  );
}
