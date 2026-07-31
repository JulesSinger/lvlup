/**
 * Burst de particules maison sur canvas — zéro dépendance.
 * Utilisé par les cérémonies de validation et de montée de rang.
 */

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rotation: number;
  vr: number;
  color: string;
  life: number;
  ttl: number;
  shape: 'rect' | 'circle';
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Lance une explosion de confettis sur le canvas fourni.
 * Renvoie une fonction d'annulation (à appeler au démontage du composant).
 */
export function burst(canvas: HTMLCanvasElement, colors: string[]): () => void {
  if (prefersReducedMotion()) return () => {};
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = canvas.clientWidth || window.innerWidth;
  const height = canvas.clientHeight || window.innerHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.scale(dpr, dpr);

  const palette = [...colors, '#ffffff', '#f2c14e'];
  const particles: Particle[] = [];
  const cx = width / 2;
  const cy = height * 0.42;

  for (let i = 0; i < 110; i++) {
    const angle = Math.random() * Math.PI * 2;
    // Cône orienté vers le haut : les confettis jaillissent puis retombent.
    const speed = 4 + Math.random() * 9;
    particles.push({
      x: cx + (Math.random() - 0.5) * 40,
      y: cy + (Math.random() - 0.5) * 20,
      vx: Math.cos(angle) * speed * 0.9,
      vy: Math.sin(angle) * speed * 0.55 - 7,
      size: 4 + Math.random() * 6,
      rotation: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: palette[Math.floor(Math.random() * palette.length)],
      life: 0,
      ttl: 70 + Math.random() * 60,
      shape: Math.random() < 0.75 ? 'rect' : 'circle',
    });
  }

  let raf = 0;
  let cancelled = false;

  function frame() {
    if (cancelled || !ctx) return;
    ctx.clearRect(0, 0, width, height);
    let alive = 0;
    for (const p of particles) {
      p.life += 1;
      if (p.life > p.ttl) continue;
      alive += 1;
      p.vy += 0.22; // gravité
      p.vx *= 0.985; // frottement
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.vr;
      const fade = 1 - p.life / p.ttl;
      ctx.globalAlpha = Math.max(0, fade);
      ctx.fillStyle = p.color;
      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size / 2, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        // La hauteur oscille : effet « feuille qui tournoie »
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * (0.4 + Math.abs(Math.sin(p.life / 8)) * 0.6));
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    if (alive > 0) raf = requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, width, height);
  }

  raf = requestAnimationFrame(frame);
  return () => {
    cancelled = true;
    cancelAnimationFrame(raf);
  };
}
