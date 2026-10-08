/**
 * Aperçu de Recettes sur la page d'accueil publique du hub (socle, voir
 * `core/components/Landing.tsx`) — un menu d'exemple, jamais celui d'un vrai
 * compte : personne n'est encore connecté à cet écran.
 */
const WEEK = [
  { day: 'Lun', meal: 'Curry de lentilles' },
  { day: 'Mar', meal: 'Restes' },
  { day: 'Mer', meal: 'Lasagnes' },
];

export function RecettesLandingPreview() {
  return (
    <div className="recettes-landing-preview">
      <div className="recettes-landing-head">
        <span className="recettes-landing-count">42 recettes</span>
        <span className="recettes-landing-sub">Menu de la semaine</span>
      </div>
      <ul className="recettes-landing-menu" aria-hidden="true">
        {WEEK.map((d) => (
          <li key={d.day}>
            <span className="recettes-landing-day">{d.day}</span>
            <span className="recettes-landing-meal">{d.meal}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
