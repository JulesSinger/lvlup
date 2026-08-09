import { useEffect, useRef, useState } from 'react';

const R = 84;
const CIRC = 2 * Math.PI * R;

/**
 * Anneau de l'objectif du jour — le héros visuel de l'accueil.
 * Il répond à la seule question qui compte le matin : « ai-je fini aujourd'hui ? »
 */
export function DailyRing({
  value,
  goal,
  size = 196,
}: {
  value: number;
  goal: number;
  size?: number;
}) {
  const pct = goal > 0 ? Math.min(1, value / goal) : 0;
  const done = value >= goal && goal > 0;
  const [display, setDisplay] = useState(value);
  const previous = useRef(value);

  // Le compteur défile plutôt que de sauter : le gain se voit.
  useEffect(() => {
    const from = previous.current;
    previous.current = value;
    if (from === value) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    function frame(now: number) {
      const t = Math.min(1, (now - start) / 800);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  return (
    <div className={`ring-wrap${done ? ' done' : ''}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 196 196" aria-hidden="true">
        <circle cx="98" cy="98" r={R} fill="none" stroke="var(--border)" strokeWidth="14" />
        <circle
          className="ring-progress"
          cx="98"
          cy="98"
          r={R}
          fill="none"
          stroke="url(#ringGrad)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - pct)}
        />
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#b9812a" />
            <stop offset="1" stopColor="#f2c14e" />
          </linearGradient>
        </defs>
      </svg>
      <div className="ring-center">
        <div>
          <div className="ring-value">{display}</div>
          <div className="ring-goal">/ {goal} PP</div>
          <div className="ring-label">Objectif du jour</div>
        </div>
      </div>
    </div>
  );
}
