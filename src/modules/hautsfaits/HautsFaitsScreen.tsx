import type { ModuleScreenProps } from '../../core/lib/module';

/**
 * Écran racine de Hauts faits.
 *
 * Étape 1 seulement (docs/etude-hauts-faits.md §11) : le stockage existe
 * dans les deux modes, mais aucun écran n'est encore construit. Ce signet
 * permet au module d'exister et de se déclarer au hub ; les règles (étape 2)
 * puis la frise (étape 3) arrivent ensuite.
 */
export function HautsFaitsScreen({ label, emoji, onBackToHub }: ModuleScreenProps) {
  return (
    <div className="hautsfaits-placeholder">
      <span className="hautsfaits-placeholder-emoji" aria-hidden="true">
        {emoji}
      </span>
      <h1 className="hautsfaits-placeholder-title">{label} arrive bientôt</h1>
      <p className="hautsfaits-placeholder-text">La frise de tes grands moments est en construction — rien à voir pour l’instant.</p>
      <button className="btn btn-ghost" onClick={onBackToHub}>
        ← Retour aux modules
      </button>
    </div>
  );
}
