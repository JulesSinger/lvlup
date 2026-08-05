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
  | { kind: 'profile'; rank: Rank; previous: Rank | null }
  | { kind: 'trophy'; icon: string; name: string; desc: string }
  | { kind: 'day'; earned: number; goal: number; streak: number }
  | { kind: 'plan'; emoji: string; goalTitle: string; tiers: { title: string; rank: Rank }[] };

/** Couleurs des cérémonies de trophée (or Zénith). */
const TROPHY_COLORS = { color: '#b9812a', color2: '#f2c14e' };

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
    } else if (item.kind === 'trophy' || item.kind === 'day' || item.kind === 'plan') {
      playRankUpFanfare();
      vibrate([40, 60, 120]);
    } else {
      playTierChime();
      vibrate(item.goalComplete ? [40, 60, 120] : 40);
    }
    const colors =
      item.kind === 'plan'
        ? [item.tiers[item.tiers.length - 1]?.rank.color ?? TROPHY_COLORS.color,
           item.tiers[item.tiers.length - 1]?.rank.color2 ?? TROPHY_COLORS.color2]
        : item.kind === 'trophy' || item.kind === 'day'
          ? [TROPHY_COLORS.color, TROPHY_COLORS.color2]
          : [item.rank.color, item.rank.color2];
    let cancelBurst = () => {};
    if (canvasRef.current) {
      cancelBurst = burst(canvasRef.current, colors);
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

  const colors =
    item.kind === 'plan'
      ? (item.tiers[item.tiers.length - 1]?.rank ?? TROPHY_COLORS)
      : item.kind === 'trophy' || item.kind === 'day'
        ? TROPHY_COLORS
        : item.rank;
  const eyebrow =
    item.kind === 'plan'
      ? 'Ascension tracée'
      : item.kind === 'day'
        ? 'Journée bouclée'
      : item.kind === 'trophy'
        ? 'Trophée débloqué'
        : item.kind === 'profile'
          ? 'Montée de rang'
          : item.goalComplete
            ? 'Objectif accompli'
            : 'Palier validé';
  const subtitle =
    item.kind === 'plan'
      ? `${item.tiers.length} étape${item.tiers.length > 1 ? 's' : ''} jusqu'au sommet. Le chemin est posé — il ne reste qu'à monter.`
      : item.kind === 'day'
      ? `${item.earned} PP sur les ${item.goal} visés${item.earned > item.goal ? ` — ${item.earned - item.goal} de plus que demandé` : ''}.`
      : item.kind === 'trophy'
        ? item.desc
        : item.kind === 'profile'
          ? item.previous
            ? `${item.previous.label} → ${item.rank.label}. Ton profil vient de monter.`
            : 'Ton profil décroche son premier rang.'
          : `${item.tierTitle} — ${item.goalTitle}`;
  const headline =
    item.kind === 'plan'
      ? item.goalTitle
      : item.kind === 'day'
        ? 'Objectif atteint'
      : item.kind === 'trophy'
        ? item.name
        : item.kind === 'profile'
          ? `Rang ${item.rank.label}`
          : item.rank.label;

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
          background: `radial-gradient(560px 420px at 50% 40%, ${colors.color}59, transparent 70%)`,
        }}
        aria-hidden="true"
      />

      {/* key={index} force le remontage : les animations d'entrée rejouent à chaque écran */}
      <div className="ceremony-content" key={index}>
        <div className="ceremony-eyebrow">{eyebrow}</div>
        <div className="ceremony-crest-wrap">
          <span className="ceremony-ring" style={{ borderColor: `${colors.color2}88` }} />
          <span className="ceremony-ring late" style={{ borderColor: `${colors.color}66` }} />
          <div
            className="ceremony-crest"
            style={{
              background: `linear-gradient(150deg, ${colors.color2}, ${colors.color})`,
              color:
                item.kind === 'trophy' || item.kind === 'day' || item.kind === 'plan'
                  ? '#2b2000'
                  : item.rank.ink,
              boxShadow: `0 0 60px ${colors.color}66, inset 0 0 0 2px rgba(255,255,255,0.3)`,
              fontSize:
                item.kind === 'trophy' || item.kind === 'day' || item.kind === 'plan'
                  ? 52
                  : undefined,
            }}
          >
            {item.kind === 'plan'
              ? item.emoji
              : item.kind === 'day'
                ? '✓'
                : item.kind === 'trophy'
                  ? item.icon
                  : item.rank.label.charAt(0).toUpperCase()}
          </div>
        </div>
        <div className="ceremony-rank" style={{ color: colors.color2 }}>
          {headline}
        </div>
        <div className="ceremony-sub">{subtitle}</div>
        {item.kind === 'tier' && <div className="ceremony-pp">+{item.pp} PP</div>}
        {item.kind === 'plan' && (
          <ul className="ceremony-ladder">
            {item.tiers.map((t, i) => (
              <li
                key={t.title}
                className="ceremony-step-row"
                style={{ animationDelay: `${0.45 + i * 0.14}s` }}
              >
                <span
                  className="ceremony-step-crest"
                  style={{ background: `linear-gradient(150deg, ${t.rank.color2}, ${t.rank.color})` }}
                  aria-hidden="true"
                />
                <span className="ceremony-step-title">{t.title}</span>
                <span className="ceremony-step-rank" style={{ color: t.rank.color2 }}>
                  {t.rank.label}
                </span>
              </li>
            ))}
          </ul>
        )}
        {item.kind === 'day' && (
          <div className="ceremony-streak">
            <span className="flame lit" aria-hidden="true">
              🔥
            </span>
            <b>{item.streak}</b>
            <span>jour{item.streak > 1 ? 's' : ''} d'affilée</span>
          </div>
        )}
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
