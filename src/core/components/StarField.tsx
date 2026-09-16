import { useEffect, useRef } from 'react';

/**
 * Champ d'étoiles derrière le héros de la page d'accueil (§22 de l'étude —
 * Jules a demandé un « effet wow » lié à l'espace, comparé à une sphère
 * armillaire en 3D CSS via une maquette, et choisi celui-ci). Canvas pur,
 * aucune librairie : dérive très lente, scintillement discret — l'idée
 * n'est pas d'attirer l'œil sur l'animation, mais de donner de la
 * profondeur sans jamais concurrencer le titre posé par-dessus.
 *
 * `aria-hidden` : purement décoratif, rien à annoncer à un lecteur d'écran.
 */

const TINTS = ['255,255,255', '242,193,78', '156,140,246', '82,214,200'];

interface Star {
  x: number;
  y: number;
  r: number;
  tint: string;
  baseAlpha: number;
  phase: number;
  speed: number;
  vx: number;
  vy: number;
}

export function StarField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = 0;
    let height = 0;
    let stars: Star[] = [];
    let frameId = 0;

    function resize() {
      const rect = canvas!.parentElement!.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function seed() {
      const count = Math.round((width * height) / 9000);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: 0.5 + Math.random() * 1.3,
        tint: TINTS[Math.random() < 0.7 ? 0 : 1 + Math.floor(Math.random() * 3)],
        baseAlpha: 0.25 + Math.random() * 0.45,
        phase: Math.random() * Math.PI * 2,
        speed: 0.3 + Math.random() * 0.5,
        vx: (Math.random() - 0.5) * 0.05,
        vy: 0.015 + Math.random() * 0.02,
      }));
    }

    function frame(time: number) {
      ctx!.clearRect(0, 0, width, height);
      for (const star of stars) {
        if (!reduceMotion) {
          star.x += star.vx;
          star.y += star.vy;
          if (star.y > height) {
            star.y = -2;
            star.x = Math.random() * width;
          }
          if (star.x > width) star.x = 0;
          if (star.x < 0) star.x = width;
        }
        const twinkle = reduceMotion
          ? star.baseAlpha
          : star.baseAlpha * (0.55 + 0.45 * Math.sin(time * 0.001 * star.speed + star.phase));
        ctx!.beginPath();
        ctx!.fillStyle = `rgba(${star.tint},${twinkle.toFixed(3)})`;
        ctx!.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx!.fill();
      }
      frameId = requestAnimationFrame(frame);
    }

    resize();
    seed();
    frameId = requestAnimationFrame(frame);

    function onResize() {
      resize();
      seed();
    }
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <div className="lp-starfield" aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
