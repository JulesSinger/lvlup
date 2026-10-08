import { useCallback, useEffect, useRef, useState } from 'react';
import { pause, remaining, resume, stepIngredients, type RunningTimer } from '../lib/cooking';
import { isSectionHeading, scaleIngredient } from '../lib/ingredients';
import { findTimers, formatClock } from '../lib/timers';
import type { Recipe } from '../lib/types';

/** L'écran qui reste allumé : `navigator.wakeLock` (iPhone : iOS 18.4 et plus dans l'app installée). */
type WakeState = 'on' | 'off' | 'unsupported';

interface WakeLockSentinelLike {
  release(): Promise<void>;
  addEventListener(type: 'release', cb: () => void): void;
}

/** Un petit « bip » quand un minuteur sonne, sans fichier son. */
function beep() {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    for (const at of [0, 0.35, 0.7]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.2, ctx.currentTime + at);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + at + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + at);
      osc.stop(ctx.currentTime + at + 0.3);
    }
    window.setTimeout(() => void ctx.close(), 1500);
  } catch {
    // Pas de son : le minuteur s'affiche quand même « terminé ».
  }
  navigator.vibrate?.([300, 150, 300]);
}

/**
 * Le mode cuisine (docs/etude-recettes.md §5, §19) — facultatif, ouvert
 * depuis une fiche. D'abord les ingrédients à réunir (à cocher), puis une
 * étape par écran, en grand ; les ingrédients de l'étape rappelés, aux
 * quantités de la fiche ; des minuteurs tirés du texte, plusieurs à la fois,
 * qui comptent contre l'horloge ; l'écran gardé allumé quand le téléphone le
 * permet. Flèches du clavier, glisser du doigt, Échap pour sortir.
 */
export function CookMode({ recipe, factor, servings, onClose }: { recipe: Recipe; factor: number; servings: number | null; onClose: () => void }) {
  const steps = recipe.steps;
  const ingredients = recipe.ingredients.filter((i) => !isSectionHeading(i.text));
  /** -1 : les ingrédients ; puis les étapes. */
  const [index, setIndex] = useState(-1);
  const [gathered, setGathered] = useState<Set<number>>(new Set());
  const [timers, setTimers] = useState<RunningTimer[]>([]);
  const [rang, setRang] = useState<Set<number>>(new Set());
  const [now, setNow] = useState(() => Date.now());
  const [wake, setWake] = useState<WakeState>('off');
  const sentinel = useRef<WakeLockSentinelLike | null>(null);
  const nextId = useRef(1);
  const touchX = useRef<number | null>(null);

  const go = useCallback((delta: number) => setIndex((i) => Math.max(-1, Math.min(steps.length - 1, i + delta))), [steps.length]);

  // L'écran allumé : demandé à l'ouverture, redemandé au retour sur l'app (le système le relâche en veille).
  useEffect(() => {
    const api = (navigator as unknown as { wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> } }).wakeLock;
    if (!api) {
      setWake('unsupported');
      return;
    }
    let alive = true;
    const request = async () => {
      try {
        const s = await api.request('screen');
        if (!alive) return void s.release();
        sentinel.current = s;
        setWake('on');
        s.addEventListener('release', () => alive && setWake('off'));
      } catch {
        setWake('off');
      }
    };
    void request();
    const onVisible = () => document.visibilityState === 'visible' && void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel.current?.release().catch(() => undefined);
    };
  }, []);

  // Le temps qui passe, pour les minuteurs ; un minuteur qui arrive à zéro sonne une fois.
  useEffect(() => {
    if (timers.length === 0) return;
    const tick = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(tick);
  }, [timers.length]);
  useEffect(() => {
    for (const t of timers) {
      if (t.pausedLeft === null && remaining(t, now) === 0 && !rang.has(t.id)) {
        setRang((prev) => new Set(prev).add(t.id));
        beep();
      }
    }
  }, [now, timers, rang]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  function start(label: string, seconds: number) {
    const id = nextId.current++;
    setNow(Date.now());
    setTimers((list) => [...list, { id, label, endsAt: Date.now() + seconds * 1000, pausedLeft: null }]);
  }

  const step = index >= 0 ? steps[index] : null;
  const used = step ? stepIngredients(step.text, ingredients) : [];
  const stepTimers = step ? findTimers(step.text) : [];

  return (
    <div
      className="recettes-cook"
      role="dialog"
      aria-modal="true"
      aria-label={`Cuisiner — ${recipe.title}`}
      onTouchStart={(e) => (touchX.current = e.touches[0]?.clientX ?? null)}
      onTouchEnd={(e) => {
        const start = touchX.current;
        const end = e.changedTouches[0]?.clientX;
        touchX.current = null;
        if (start === null || end === undefined || Math.abs(end - start) < 60) return;
        go(end < start ? 1 : -1);
      }}
    >
      <header className="recettes-cook-head">
        <div className="recettes-cook-title">
          <span className="recettes-cook-name">{recipe.title}</span>
          <span className="recettes-cook-sub">
            {servings ? `Pour ${servings} ${recipe.yieldLabel} · ` : ''}
            {wake === 'on' ? '🔆 L’écran reste allumé' : 'L’écran peut se mettre en veille'}
          </span>
        </div>
        <button type="button" className="btn btn-sm" onClick={onClose} aria-label="Quitter le mode cuisine">
          ✕
        </button>
      </header>

      <div className="recettes-cook-progress" aria-hidden="true">
        {[-1, ...steps.map((_, i) => i)].map((i) => (
          <span key={i} className={`recettes-cook-dot${i === index ? ' on' : i < index ? ' done' : ''}`} />
        ))}
      </div>

      <main className="recettes-cook-body">
        {index === -1 ? (
          <>
            <p className="recettes-cook-label">Réunir les ingrédients</p>
            {ingredients.length === 0 ? (
              <p className="recettes-cook-step">Aucun ingrédient noté.</p>
            ) : (
              <ul className="recettes-cook-gather">
                {ingredients.map((ing, i) => (
                  <li key={i}>
                    <label className={gathered.has(i) ? 'done' : ''}>
                      <input
                        type="checkbox"
                        checked={gathered.has(i)}
                        onChange={() =>
                          setGathered((prev) => {
                            const next = new Set(prev);
                            if (next.has(i)) next.delete(i);
                            else next.add(i);
                            return next;
                          })
                        }
                      />
                      <span>{scaleIngredient(ing.text, factor)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {wake !== 'on' && (
              <p className="recettes-hint">
                Pour que l’écran ne s’éteigne pas : Réglages de l’iPhone → Luminosité et affichage → Verrouillage automatique → Jamais, le temps de
                cuisiner.
              </p>
            )}
          </>
        ) : (
          <>
            <p className="recettes-cook-label">
              Étape {index + 1} / {steps.length}
            </p>
            <p className="recettes-cook-step">{step!.text}</p>
            {stepTimers.length > 0 && (
              <div className="recettes-cook-timers-start">
                {stepTimers.map((t, i) => (
                  <button key={i} type="button" className="btn recettes-cook-timer-btn" onClick={() => start(t.label, t.seconds)}>
                    ⏱ Lancer {formatClock(t.seconds)}
                  </button>
                ))}
              </div>
            )}
            {used.length > 0 && (
              <ul className="recettes-cook-used" aria-label="Ingrédients de cette étape">
                {used.map((u, i) => (
                  <li key={i}>{scaleIngredient(u.text, factor)}</li>
                ))}
              </ul>
            )}
          </>
        )}
      </main>

      {timers.length > 0 && (
        <ul className="recettes-cook-running" aria-label="Minuteurs">
          {timers.map((t) => {
            const left = remaining(t, now);
            return (
              <li key={t.id} className={left === 0 ? 'rang' : t.pausedLeft !== null ? 'paused' : ''}>
                <span className="recettes-cook-clock">{left === 0 ? 'Terminé !' : formatClock(left)}</span>
                <span className="recettes-cook-timer-label">{t.label}</span>
                {left > 0 && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setTimers((list) => list.map((x) => (x.id === t.id ? (x.pausedLeft === null ? pause(x, Date.now()) : resume(x, Date.now())) : x)))}
                  >
                    {t.pausedLeft === null ? 'Pause' : 'Reprendre'}
                  </button>
                )}
                <button type="button" className="btn btn-sm" aria-label={`Arrêter le minuteur ${t.label}`} onClick={() => setTimers((list) => list.filter((x) => x.id !== t.id))}>
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <footer className="recettes-cook-nav">
        <button type="button" className="btn" onClick={() => go(-1)} disabled={index === -1}>
          ‹ Précédente
        </button>
        {index < steps.length - 1 ? (
          <button type="button" className="btn btn-primary" onClick={() => go(1)}>
            {index === -1 ? 'Commencer ›' : 'Suivante ›'}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Terminé
          </button>
        )}
      </footer>
    </div>
  );
}
