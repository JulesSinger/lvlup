import { getRank } from '../lib/ranks';

/**
 * Aperçu de Zénith sur la page d'accueil publique du hub (socle, voir
 * `core/components/Landing.tsx`) — des valeurs d'exemple, jamais celles
 * d'un vrai compte : personne n'est encore connecté à cet écran.
 */
export function ZenithLandingPreview() {
  const rank = getRank('or');
  return (
    <div className="objectifs-landing-preview">
      <div className="objectifs-landing-ring">
        <svg viewBox="0 0 62 62">
          <circle cx="31" cy="31" r="26" fill="none" stroke="#262e40" strokeWidth="7" />
          <circle
            cx="31"
            cy="31"
            r="26"
            fill="none"
            stroke="url(#objectifsLandingGrad)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray="163.4"
            strokeDashoffset="41"
            transform="rotate(-90 31 31)"
          />
          <defs>
            <linearGradient id="objectifsLandingGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor={rank.color2} />
              <stop offset="1" stopColor={rank.color} />
            </linearGradient>
          </defs>
        </svg>
        <div className="objectifs-landing-ring-center">
          <b>30</b>/40 PP
        </div>
      </div>
      <div className="objectifs-landing-side">
        <div className="objectifs-landing-flame">
          🔥 <b>12</b> jours d'affilée
        </div>
        <div className="objectifs-landing-label">Semi-marathon — {rank.label}</div>
      </div>
    </div>
  );
}
