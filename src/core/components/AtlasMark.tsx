import { useId } from 'react';

/**
 * La marque d'Atlas : la sphère céleste qu'il porte, cerclée d'une orbite —
 * le même dessin que `public/favicon.svg`, sans son fond. Elle remplace le ▲,
 * qui était la montagne de Zénith, du temps où l'app portait ce nom.
 *
 * L'or est une couleur d'identité, identique dans les deux thèmes, comme
 * l'icône d'installation ; seuls les méridiens prennent la couleur du texte
 * posé sur l'accent. `useId` parce que la marque peut apparaître plusieurs
 * fois sur une page (en-tête, bouton des réglages) : deux dégradés de même
 * identifiant se confondraient.
 */
export default function AtlasMark({ className = 'brand-mark brand-mark-atlas' }: { className?: string }) {
  const gradient = `atlas-mark-${useId().replace(/:/g, '')}`;
  return (
    <span className={className} aria-hidden="true">
      <svg viewBox="6 4 52 52" width="100%" height="100%">
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffd267" />
            <stop offset="1" stopColor="#b9812a" />
          </linearGradient>
        </defs>
        <ellipse
          cx="32"
          cy="34"
          rx="24"
          ry="7.5"
          transform="rotate(-20 32 34)"
          fill="none"
          stroke="#b9812a"
          strokeWidth="2.4"
          opacity="0.55"
        />
        <circle cx="32" cy="34" r="14" fill={`url(#${gradient})`} />
        <ellipse cx="32" cy="34" rx="5.5" ry="14" fill="none" stroke="currentColor" strokeWidth="1.6" opacity="0.3" />
        <path d="M18 34 H46" stroke="currentColor" strokeWidth="1.6" opacity="0.3" />
        <path
          d="M9.45 42.21 A24 7.5 -20 0 0 54.55 25.79"
          fill="none"
          stroke={`url(#${gradient})`}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle cx="51" cy="12" r="3" fill="#ffd267" />
      </svg>
    </span>
  );
}
