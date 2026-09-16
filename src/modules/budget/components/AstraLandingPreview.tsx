import { centsToInputValue, formatCents } from '../lib/amount';

/**
 * Aperçu d'Astra sur la page d'accueil publique du hub (socle, voir
 * `core/components/Landing.tsx`) — des montants d'exemple, jamais ceux
 * d'un vrai compte : personne n'est encore connecté à cet écran.
 */
export function AstraLandingPreview() {
  const heights = [60, 88, 40, 70];
  return (
    <div className="budget-landing-preview">
      <div className="budget-landing-bars" aria-hidden="true">
        {heights.map((h, i) => (
          <span key={i} className="budget-landing-bar" style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="budget-landing-figures">
        <b>{centsToInputValue(124000)} €</b>
        <span>{formatCents(-6000)} vs mois dernier</span>
      </div>
    </div>
  );
}
