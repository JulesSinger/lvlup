/**
 * Aperçu de Comète sur la page d'accueil publique du hub (socle, voir
 * `core/components/Landing.tsx`) — une liste d'exemple, jamais celle d'un
 * vrai compte : personne n'est encore connecté à cet écran.
 */
const LINES = [
  { name: 'Lait', detail: 'à chaque course', done: true },
  { name: 'Café', detail: 'toutes les 3 courses', done: true },
  { name: 'Piles', detail: 'ponctuel', done: false },
];

export function CometeLandingPreview() {
  return (
    <div className="courses-landing-preview">
      {LINES.map((l) => (
        <div key={l.name} className={`courses-landing-line${l.done ? ' done' : ''}`}>
          <span className="courses-landing-check" aria-hidden="true">
            {l.done ? '✓' : ''}
          </span>
          <span className="courses-landing-name">{l.name}</span>
          <span className="courses-landing-detail">{l.detail}</span>
        </div>
      ))}
      <div className="courses-landing-total">Dernière course : 47,80 € · Leclerc</div>
    </div>
  );
}
