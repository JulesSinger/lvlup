/**
 * Aperçu d'Éclipse sur la page d'accueil publique du hub (socle, voir
 * `core/components/Landing.tsx`) — une journée d'exemple, jamais celle d'un
 * vrai compte : personne n'est encore connecté à cet écran.
 */
const EVENTS = [
  { time: '09:00', title: 'Sport', detail: 'tous les mardis', color: 'vert' },
  { time: '14:00', title: 'Dentiste', detail: '30 min', color: 'bleu' },
  { time: '19:30', title: 'Dîner chez Léa', detail: '', color: 'rose' },
];

export function EclipseLandingPreview() {
  return (
    <div className="calendrier-landing-preview">
      <div className="calendrier-landing-day">Mardi 29</div>
      {EVENTS.map((e) => (
        <div key={e.title} className={`calendrier-landing-event ${e.color}`}>
          <span className="calendrier-landing-time">{e.time}</span>
          <span className="calendrier-landing-title">{e.title}</span>
          {e.detail && <span className="calendrier-landing-detail">{e.detail}</span>}
        </div>
      ))}
    </div>
  );
}
