/**
 * Aperçu de Sport sur la page d'accueil publique du hub (socle, voir
 * `core/components/Landing.tsx`) — une semaine d'exemple, jamais celle d'un
 * vrai compte : personne n'est encore connecté à cet écran.
 */
const WEEK = [
  { day: 'L', km: 0 },
  { day: 'M', km: 8 },
  { day: 'M', km: 0 },
  { day: 'J', km: 10 },
  { day: 'V', km: 0 },
  { day: 'S', km: 6 },
  { day: 'D', km: 22 },
];

export function SportLandingPreview() {
  const max = Math.max(...WEEK.map((d) => d.km));
  return (
    <div className="sport-landing-preview">
      <div className="sport-landing-head">
        <span className="sport-landing-km">46 km</span>
        <span className="sport-landing-plan">Semaine 9 / 28 · Marathon</span>
      </div>
      <div className="sport-landing-bars" aria-hidden="true">
        {WEEK.map((d, i) => (
          <span key={i} className="sport-landing-col">
            <span className="sport-landing-bar" style={{ height: `${d.km === 0 ? 0 : 15 + (d.km / max) * 85}%` }} />
            <span className="sport-landing-day">{d.day}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
