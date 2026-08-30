import type { ModuleScreenProps } from '../../core/lib/module';

/**
 * Écran racine d'Orbite.
 *
 * Étape 1 seulement (docs/etude-flashcards.md §9) : le stockage existe dans
 * les deux modes, mais aucun écran n'est encore construit. Ce signet permet
 * au module d'exister et de se déclarer au hub sans rien casser ; paquets,
 * cartes, moteur de révision et statistiques arrivent aux étapes suivantes.
 */
export function FlashcardsScreen({ onBackToHub }: ModuleScreenProps) {
  return (
    <div className="flashcards-placeholder">
      <span className="flashcards-placeholder-emoji" aria-hidden="true">
        🪐
      </span>
      <h1 className="flashcards-placeholder-title">Orbite arrive bientôt</h1>
      <p className="flashcards-placeholder-text">
        Le module de révision par répétition espacée est en construction — rien à voir pour
        l'instant.
      </p>
      <button className="btn btn-ghost" onClick={onBackToHub}>
        ← Retour aux modules
      </button>
    </div>
  );
}
