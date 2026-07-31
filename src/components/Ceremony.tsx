import { useCallback, useEffect, useRef, useState } from 'react';
import { burst, prefersReducedMotion } from '../lib/confetti';
import type { Rank } from '../lib/ranks';
import { isMuted, playRankUpFanfare, playTierChime, setMuted, vibrate } from '../lib/sound';

/**
 * Un événement à célébrer. Les cérémonies s'enchaînent : valider un palier qui
 * fait aussi monter le rang du profil affiche deux écrans successifs.
 */
export type Celebration =
  | {
      kind: 'tier';
      rank: Rank;
      tierTitle: string;
      goalTitle: string;
      pp: number;
      goalComplete: boolean;
    }
  | { kind: 'profile'; rank: Rank; previous: Rank | null };

const AUTO_ADVANCE_MS = 5200;

/**
 * Écran de célébration plein écran : emblème du rang, confettis aux couleurs
 * du rang, son bref et vibration mobile. Cliquer n'importe où (ou attendre)
 * passe à la cérémonie suivante puis rend la main.
 */
export function Ceremony({
  items,
  onFinish,
}: {
  items: Celebration[];
  onFinish: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [muted, setMutedState] = useState(isMuted);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const item = items[index];

  const advance = useCallback(() => {
    setIndex((current) => {
      if (current + 1 < items.length) return current + 1;
      onFinish();
      return current;
    });
  }, [items.length, onFinish]);

  useEffect(() => {
    if (!item) return;
    if (item.kind === 'profile') {
      playRankUpFanfare();
      vibrate([40, 60, 40, 60, 120]);
    } else {
      playTierChime();
      vibrate(item.goalComplete ? [40, 60, 120] : 40);
    }
    let cancelBurst = () => {};
    if (canvasRef.current) {
      cancelBurst = burst(canvasRef.current, [item.rank.color, item.rank.color2]);
    }
    const timer = window.setTimeout(advance, AUTO_ADVANCE_MS);
    return () => {
      cancelBurst();
      window.clearTimeout(timer);
    };
  }, [index, item, advance]);

  // Échap ferme tout, Entrée/Espace avance.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onFinish();
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        advance();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [advance, onFinish]);

  if (!item) return null;

  const rank = item.rank;
  const eyebrow =
    item.kind === 'profile'
      ? 'Montée de rang'
      : item.goalComplete
        ? 'Objectif accompli'
        : 'Palier validé';
  const subtitle =
    item.kind === 'profile'
      ? item.previous
        ? `${item.previous.label} → ${rank.label}. Ton profil vient de monter.`
        : 'Ton profil décroche son premier rang.'
      : `${item.tierTitle} — ${item.goalTitle}`;

  return (
    <div
      className={`ceremony${prefersReducedMotion() ? ' still' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={eyebrow}
      onClick={advance}
    >
      <canvas ref={canvasRef} className="ceremony-canvas" aria-hidden="true" />
      <div
        className="ceremony-glow"
        style={{
          background: `radial-gradient(560px 420px at 50% 40%, ${rank.color}59, transparent 70%)`,
        }}
        aria-hidden="true"
      />

      {/* key={index} force le remontage : les animations d'entrée rejouent à chaque écran */}
      <div className="ceremony-content" key={index}>
        <div className="ceremony-eyebrow">{eyebrow}</div>
        <div className="ceremony-crest-wrap">
          <span className="ceremony-ring" style={{ borderColor: `${rank.color2}88` }} />
          <span className="ceremony-ring late" style={{ borderColor: `${rank.color}66` }} />
          <div
            className="ceremony-crest"
            style={{
              background: `linear-gradient(150deg, ${rank.color2}, ${rank.color})`,
              color: rank.ink,
              boxShadow: `0 0 60px ${rank.color}66, inset 0 0 0 2px rgba(255,255,255,0.3)`,
            }}
          >
            {rank.label.charAt(0).toUpperCase()}
          </div>
        </div>
        <div className="ceremony-rank" style={{ color: rank.color2 }}>
          {item.kind === 'profile' ? `Rang ${rank.label}` : rank.label}
        </div>
        <div className="ceremony-sub">{subtitle}</div>
        {item.kind === 'tier' && <div className="ceremony-pp">+{item.pp} PP</div>}
        <button
          className="btn btn-primary"
          onClick={(e) => {
            e.stopPropagation();
            advance();
          }}
        >
          Continuer
        </button>
        {items.length > 1 && (
          <div className="ceremony-steps">
            {items.map((_, i) => (
              <span key={i} className={`ceremony-step${i === index ? ' active' : ''}`} />
            ))}
          </div>
        )}
      </div>

      <button
        className="ceremony-mute"
        onClick={(e) => {
          e.stopPropagation();
          const next = !muted;
          setMuted(next);
          setMutedState(next);
        }}
        title={muted ? 'Réactiver le son' : 'Couper le son'}
        aria-label={muted ? 'Réactiver le son' : 'Couper le son'}
      >
        {muted ? '🔇' : '🔊'}
      </button>
    </div>
  );
}
