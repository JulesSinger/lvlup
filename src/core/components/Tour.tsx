import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react';
import type { TourStep } from '../lib/module';

/** Le temps d'attendre qu'un élément montré apparaisse (un écran qui se charge). */
const WAIT_MS = 2500;
/** Sous cette largeur, la bulle monte du bas de l'écran, comme la grille des modules. */
const PHONE = 640;
const GAP = 12;

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * La visite guidée d'un module (15/10/2026) : une bulle par étape, et ce
 * qu'elle montre surligné — l'écran reste utilisable dessous, on peut
 * essayer pour de vrai. Un élément introuvable n'arrête rien : la bulle
 * s'affiche au centre, et le dit à la suite e2e (`data-target-missing`),
 * pour qu'une visite qui vieillit se voie.
 */
export function Tour({ steps, onClose }: { steps: readonly TourStep[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [missing, setMissing] = useState(false);
  const [viewport, setViewport] = useState({ width: window.innerWidth, height: window.innerHeight });
  const step = steps[index];
  const last = index === steps.length - 1;

  // Trouver l'élément de l'étape (il peut mettre un instant à apparaître), l'amener à l'écran, puis le suivre.
  useEffect(() => {
    setBox(null);
    setMissing(false);
    if (!step?.target) return;
    const started = Date.now();
    let scrolled = false;
    const measure = () => {
      const el = document.querySelector(step.target!);
      if (!el) {
        if (Date.now() - started > WAIT_MS) setMissing(true);
        return;
      }
      if (!scrolled) {
        scrolled = true;
        el.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      }
      const r = el.getBoundingClientRect();
      setMissing(false);
      setBox((prev) =>
        prev && Math.abs(prev.top - r.top) < 1 && Math.abs(prev.left - r.left) < 1 && Math.abs(prev.width - r.width) < 1 && Math.abs(prev.height - r.height) < 1
          ? prev
          : { top: r.top, left: r.left, width: r.width, height: r.height },
      );
    };
    measure();
    const timer = window.setInterval(measure, 150);
    return () => window.clearInterval(timer);
  }, [step]);

  useLayoutEffect(() => {
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      } else if (e.key === 'ArrowRight' && !last) setIndex((i) => i + 1);
      else if (e.key === 'ArrowLeft' && index > 0) setIndex((i) => i - 1);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [index, last, onClose]);

  if (!step) return null;
  const phone = viewport.width < PHONE;
  const pad = 6;
  const spot = box && { top: box.top - pad, left: box.left - pad, width: box.width + pad * 2, height: box.height + pad * 2 };

  // La bulle : sous l'élément s'il y a la place, sinon au-dessus ; au centre sans élément ; en bas sur téléphone.
  let bubble: CSSProperties = {};
  if (!phone && spot) {
    const width = Math.min(360, viewport.width - 2 * GAP);
    const left = Math.min(Math.max(GAP, spot.left), viewport.width - width - GAP);
    const below = spot.top + spot.height + GAP;
    bubble = below + 200 < viewport.height ? { top: below, left, width } : { bottom: viewport.height - spot.top + GAP, left, width };
  }

  return (
    <div className="atlas-tour-layer" data-tour-step={index + 1}>
      {spot ? <div className="atlas-tour-spot" style={spot} /> : <div className="atlas-tour-dim" />}
      <div
        className={`atlas-tour${phone ? ' phone' : ''}${!spot && !phone ? ' centered' : ''}`}
        style={bubble}
        role="dialog"
        aria-modal="false"
        aria-label={`Visite : ${step.title}`}
        data-target-missing={missing ? 'true' : undefined}
      >
        <p className="atlas-tour-count">
          {index + 1} / {steps.length}
        </p>
        <h3 className="atlas-tour-title">{step.title}</h3>
        <p className="atlas-tour-body">{step.body}</p>
        <div className="atlas-tour-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Passer
          </button>
          <span className="atlas-tour-spacer" />
          {index > 0 && (
            <button type="button" className="btn btn-sm" onClick={() => setIndex((i) => i - 1)}>
              ‹ Précédent
            </button>
          )}
          <button type="button" className="btn btn-sm btn-primary" onClick={() => (last ? onClose() : setIndex((i) => i + 1))}>
            {last ? 'Terminer' : 'Suivant ›'}
          </button>
        </div>
      </div>
    </div>
  );
}
