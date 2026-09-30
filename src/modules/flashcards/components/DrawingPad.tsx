import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  DRAWING_COLORS,
  DRAWING_COLOR_VARS,
  DRAWING_HEIGHT,
  DRAWING_SIZES,
  DRAWING_WIDTH,
  MAX_DRAWING_POINTS,
  addPoint,
  decodeDrawing,
  encodeDrawing,
  eraseAt,
  pointCount,
  strokePath,
} from '../lib/drawing';
import type { Drawing, DrawingColor, DrawingSize, Stroke } from '../lib/drawing';

interface Props {
  /** Le dessin à reprendre, sous sa forme écrite ; vide pour un nouveau. */
  initial: string;
  onCancel: () => void;
  onSave: (encoded: string) => void;
}

const COLOR_NAMES: Record<DrawingColor, string> = {
  ink: 'Encre',
  red: 'Rouge',
  blue: 'Bleu',
  green: 'Vert',
  orange: 'Orange',
};

const SIZE_NAMES: Record<DrawingSize, string> = { 3: 'Fin', 6: 'Moyen', 12: 'Épais' };

/** Rayon de la gomme, en unités du dessin. */
const ERASER_RADIUS = 8;

/**
 * La fenêtre de dessin d'une carte — pensée pour la souris (Jules dessine
 * sur ordinateur), mais les événements de pointeur la rendent aussi utilisable
 * au doigt ou au stylet.
 *
 * Rendue dans `document.body` par un portail : ouverte depuis l'intérieur de
 * l'éditeur Tiptap, elle y recevrait sinon les gestes que l'éditeur
 * interprète lui-même (sélection, glisser). Échap ne ferme qu'elle — écoute
 * en capture, pour que la fenêtre de la carte, dessous, ne se ferme pas avec.
 * Un clic à côté ne ferme rien, comme les autres formulaires du module.
 */
export function DrawingPad({ initial, onCancel, onSave }: Props) {
  const [drawing, setDrawing] = useState<Drawing>(() => decodeDrawing(initial));
  /** Les états précédents, pour « Défaire ». */
  const [history, setHistory] = useState<Drawing[]>([]);
  const [current, setCurrent] = useState<Stroke | null>(null);
  const [color, setColor] = useState<DrawingColor>('ink');
  const [size, setSize] = useState<DrawingSize>(6);
  const [eraser, setEraser] = useState(false);
  const surface = useRef<SVGSVGElement>(null);
  /** Le dessin avant le geste en cours de gomme, pour l'annuler d'un coup. */
  const erasingFrom = useRef<Drawing | null>(null);

  const total = pointCount(drawing) + (current?.points.length ?? 0);
  const full = total >= MAX_DRAWING_POINTS;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.stopPropagation();
        undo();
      }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  function toDrawing(e: ReactPointerEvent): [number, number] {
    const rect = surface.current!.getBoundingClientRect();
    return [
      ((e.clientX - rect.left) / rect.width) * DRAWING_WIDTH,
      ((e.clientY - rect.top) / rect.height) * DRAWING_HEIGHT,
    ];
  }

  function onPointerDown(e: ReactPointerEvent<SVGSVGElement>) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const [x, y] = toDrawing(e);
    if (eraser) {
      erasingFrom.current = drawing;
      setDrawing((d) => eraseAt(d, x, y, ERASER_RADIUS));
      return;
    }
    if (full) return;
    setCurrent({ color, size, points: addPoint([], x, y) });
  }

  function onPointerMove(e: ReactPointerEvent<SVGSVGElement>) {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    const [x, y] = toDrawing(e);
    if (eraser) {
      setDrawing((d) => eraseAt(d, x, y, ERASER_RADIUS));
      return;
    }
    if (full) return;
    setCurrent((s) => (s ? { ...s, points: addPoint(s.points, x, y) } : s));
  }

  function onPointerUp() {
    if (eraser) {
      const before = erasingFrom.current;
      erasingFrom.current = null;
      if (before && before !== drawing) setHistory((h) => [...h, before]);
      return;
    }
    if (!current) return;
    setHistory((h) => [...h, drawing]);
    setDrawing((d) => ({ strokes: [...d.strokes, current] }));
    setCurrent(null);
  }

  function undo() {
    if (history.length === 0) return;
    setDrawing(history[history.length - 1]);
    setHistory(history.slice(0, -1));
  }

  function clearAll() {
    if (drawing.strokes.length === 0) return;
    setHistory((h) => [...h, drawing]);
    setDrawing({ strokes: [] });
  }

  const strokes = current ? [...drawing.strokes, current] : drawing.strokes;

  return createPortal(
    <div className="overlay flashcards-drawing-overlay">
      <div className="modal flashcards-drawing-pad" role="dialog" aria-modal="true" aria-label="Dessin">
        <div className="modal-head">
          <span className="modal-title">Dessin</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="flashcards-drawing-tools" role="toolbar" aria-label="Outils de dessin">
            <div className="flashcards-drawing-group" role="group" aria-label="Couleur">
              {DRAWING_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className="flashcards-drawing-swatch"
                  style={{ background: DRAWING_COLOR_VARS[c] }}
                  aria-label={COLOR_NAMES[c]}
                  title={COLOR_NAMES[c]}
                  aria-pressed={!eraser && color === c}
                  onClick={() => {
                    setColor(c);
                    setEraser(false);
                  }}
                />
              ))}
            </div>
            <div className="flashcards-drawing-group" role="group" aria-label="Épaisseur">
              {DRAWING_SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="flashcards-drawing-size"
                  aria-label={SIZE_NAMES[s]}
                  title={SIZE_NAMES[s]}
                  aria-pressed={!eraser && size === s}
                  onClick={() => {
                    setSize(s);
                    setEraser(false);
                  }}
                >
                  <span style={{ width: s + 2, height: s + 2 }} aria-hidden="true" />
                </button>
              ))}
            </div>
            <div className="flashcards-drawing-group">
              <button
                type="button"
                className="btn btn-sm"
                aria-pressed={eraser}
                onClick={() => setEraser((v) => !v)}
                title="Gomme : retire un trait entier"
              >
                Gomme
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={undo}
                disabled={history.length === 0}
                title="Défaire le dernier geste (Ctrl+Z)"
              >
                ↶ Défaire
              </button>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={clearAll}
                disabled={drawing.strokes.length === 0}
              >
                Tout effacer
              </button>
            </div>
          </div>

          <svg
            ref={surface}
            className={`flashcards-drawing-surface${eraser ? ' erasing' : ''}`}
            viewBox={`0 0 ${DRAWING_WIDTH} ${DRAWING_HEIGHT}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            aria-label="Zone de dessin"
            role="img"
          >
            {strokes.map((s, i) => (
              <path key={i} d={strokePath(s)} fill={DRAWING_COLOR_VARS[s.color]} />
            ))}
          </svg>
          {full && (
            <p className="field-hint">Le dessin a atteint sa taille maximale : efface un trait pour continuer.</p>
          )}
        </div>

        <div className="modal-foot">
          <button type="button" className="btn" onClick={onCancel}>
            Annuler
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={drawing.strokes.length === 0}
            onClick={() => onSave(encodeDrawing(drawing))}
          >
            Enregistrer le dessin
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
