/**
 * Aperçu de Cérès sur la page d'accueil publique du hub (socle, voir
 * `core/components/Landing.tsx`) — une journée d'exemple, jamais celle d'un
 * vrai compte : personne n'est encore connecté à cet écran.
 */
const MACROS = [
  { label: 'Protéines', grams: 96, target: 140, className: 'protein' },
  { label: 'Glucides', grams: 180, target: 250, className: 'carbs' },
  { label: 'Lipides', grams: 48, target: 70, className: 'fat' },
];

export function CeresLandingPreview() {
  return (
    <div className="nutrition-landing-preview">
      <div className="nutrition-landing-total">
        <b>1 536</b> / 2 190 kcal
      </div>
      {MACROS.map((m) => (
        <div key={m.label} className="nutrition-landing-row">
          <span className="nutrition-landing-label">{m.label}</span>
          <span className="nutrition-landing-bar">
            <span
              className={`nutrition-landing-fill ${m.className}`}
              style={{ width: `${Math.round((m.grams / m.target) * 100)}%` }}
            />
          </span>
          <span className="nutrition-landing-grams">{m.grams} g</span>
        </div>
      ))}
    </div>
  );
}
