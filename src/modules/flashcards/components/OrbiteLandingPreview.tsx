/**
 * Aperçu d'Orbite sur la page d'accueil publique du hub (socle, voir
 * `core/components/Landing.tsx`) — une carte d'exemple, jamais celle d'un
 * vrai paquet : personne n'est encore connecté à cet écran.
 */
export function OrbiteLandingPreview() {
  return (
    <div className="flashcards-landing-preview">
      <div className="flashcards-landing-card">
        <span className="flashcards-landing-badge">3</span>
        <b>¿Cómo estás?</b>
        Comment ça va ?
      </div>
      <div className="flashcards-landing-caption">Boîte 3 · due dans 4 jours</div>
    </div>
  );
}
