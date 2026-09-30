/**
 * Aperçu de Hauts faits sur la page d'accueil publique du hub (socle, voir
 * `core/components/Landing.tsx`) — une frise d'exemple, jamais celle d'un
 * vrai compte : personne n'est encore connecté à cet écran.
 */
const FEATS = [
  { year: '2025', title: 'Semi-marathon', detail: '1 h 52' },
  { year: '2022', title: 'Diplôme d’ingénieur', detail: '' },
  { year: '2017', title: 'Baccalauréat', detail: 'mention Bien' },
];

export function HautsFaitsLandingPreview() {
  return (
    <div className="hautsfaits-landing-preview">
      {FEATS.map((f) => (
        <div key={f.title} className="hautsfaits-landing-feat">
          <span className="hautsfaits-landing-year">{f.year}</span>
          <span className="hautsfaits-landing-dot" aria-hidden="true" />
          <span className="hautsfaits-landing-title">{f.title}</span>
          {f.detail && <span className="hautsfaits-landing-detail">{f.detail}</span>}
        </div>
      ))}
    </div>
  );
}
