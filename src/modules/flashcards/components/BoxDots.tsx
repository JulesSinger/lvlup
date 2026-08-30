import { BOX_COUNT } from '../lib/types';

/**
 * La boîte d'une carte, en points — ●●●○○ pour une carte en boîte 3 sur 5.
 * Répond à la question « laquelle est bientôt finie » d'un coup d'œil, sans
 * légende à apprendre : plus de points pleins, plus proche de la maîtrise.
 */
export function BoxDots({ box }: { box: number }) {
  return (
    <span className="flashcards-box-dots" title={`Boîte ${box} sur ${BOX_COUNT}`} aria-label={`Boîte ${box} sur ${BOX_COUNT}`}>
      {Array.from({ length: BOX_COUNT }, (_, i) => (
        <span key={i} className={`flashcards-box-dot${i < box ? ' filled' : ''}`} aria-hidden="true" />
      ))}
    </span>
  );
}
