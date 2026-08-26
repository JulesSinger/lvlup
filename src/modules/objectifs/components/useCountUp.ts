import { useEffect, useRef, useState } from 'react';

/**
 * Anime un nombre de sa valeur précédente vers la nouvelle (easing doux).
 * Rend les gains de PP visibles : le compteur défile au lieu de sauter.
 *
 * Il vit ici depuis que les PP ont quitté le bandeau de profil pour la carte
 * « Cette semaine » : l'animation suit le nombre.
 */
export function useCountUp(target: number, duration = 900): number {
  const [display, setDisplay] = useState(target);
  const previous = useRef(target);

  useEffect(() => {
    const from = previous.current;
    previous.current = target;
    if (from === target) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    function frame(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return display;
}
