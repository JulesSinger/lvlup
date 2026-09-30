import { getStroke } from 'perfect-freehand';

/**
 * Les dessins d'une carte (demande de Jules, 2026-09-29 : dessin libre, sur
 * ordinateur, seulement regardé pendant la révision).
 *
 * Un dessin n'est pas une image : c'est une liste de traits, rangée dans le
 * HTML du recto ou du verso sous la forme d'un bloc
 * `<div data-drawing="…"></div>`. Quelques Ko par croquis, aucune table ni
 * stockage de fichiers, et la sauvegarde l'emporte sans rien savoir de lui.
 *
 * Le SVG n'est jamais stocké : il est recalculé ici, à l'affichage, depuis
 * des traits **validés** (nombres bornés, couleurs prises dans une liste).
 * Une carte modifiée à la main — une sauvegarde retouchée, par exemple — ne
 * peut donc pas glisser de balise dans la page par un dessin.
 */

/** Le cadre du dessin, en unités du dessin ; l'affichage le met à l'échelle. */
export const DRAWING_WIDTH = 640;
export const DRAWING_HEIGHT = 360;

/**
 * Les couleurs, par nom : c'est le thème qui choisit la teinte. L'encre suit
 * la couleur du texte — noire en clair, claire en sombre.
 */
export const DRAWING_COLORS = ['ink', 'red', 'blue', 'green', 'orange'] as const;
export type DrawingColor = (typeof DRAWING_COLORS)[number];

export const DRAWING_COLOR_VARS: Record<DrawingColor, string> = {
  ink: 'var(--text)',
  red: 'var(--red)',
  blue: 'var(--blue)',
  green: 'var(--green)',
  orange: 'var(--orange)',
};

export const DRAWING_SIZES = [3, 6, 12] as const;
export type DrawingSize = (typeof DRAWING_SIZES)[number];

export type Point = [number, number];

export interface Stroke {
  color: DrawingColor;
  size: DrawingSize;
  points: Point[];
}

export interface Drawing {
  strokes: Stroke[];
}

/** Garde-fou contre un dessin démesuré (un trait tenu des minutes entières). */
export const MAX_DRAWING_POINTS = 20000;

/** Deux points plus proches que ça n'ajoutent rien au trait, seulement du poids. */
const MIN_POINT_DISTANCE = 1.5;

function clamp(value: number, max: number): number {
  return Math.min(max, Math.max(0, Math.round(value)));
}

/**
 * Ajoute un point au trait en cours, arrondi à l'unité et gardé dans le
 * cadre. Un point trop proche du précédent est ignoré.
 */
export function addPoint(points: Point[], x: number, y: number): Point[] {
  const p: Point = [clamp(x, DRAWING_WIDTH), clamp(y, DRAWING_HEIGHT)];
  const last = points[points.length - 1];
  if (last && Math.hypot(last[0] - p[0], last[1] - p[1]) < MIN_POINT_DISTANCE) return points;
  return [...points, p];
}

export function pointCount(drawing: Drawing): number {
  return drawing.strokes.reduce((n, s) => n + s.points.length, 0);
}

/**
 * Forme écrite : `couleur:taille:x,y x,y …`, un trait par segment séparé
 * par `|`. Rien qu'un attribut HTML ait à échapper — ni guillemet, ni `&`,
 * ni `<`.
 */
export function encodeDrawing(drawing: Drawing): string {
  return drawing.strokes
    .filter((s) => s.points.length > 0)
    .map((s) => `${s.color}:${s.size}:${s.points.map(([x, y]) => `${x},${y}`).join(' ')}`)
    .join('|');
}

/**
 * Relit la forme écrite. Tout ce qui n'est pas exactement attendu est
 * écarté (trait entier), jamais « réparé » : un dessin ne se devine pas.
 */
export function decodeDrawing(encoded: string | null | undefined): Drawing {
  const strokes: Stroke[] = [];
  if (!encoded) return { strokes };
  let total = 0;
  for (const part of encoded.split('|')) {
    const [color, size, pointsText] = part.split(':');
    if (!(DRAWING_COLORS as readonly string[]).includes(color)) continue;
    const sizeValue = Number(size);
    if (!(DRAWING_SIZES as readonly number[]).includes(sizeValue)) continue;
    const points: Point[] = [];
    let valid = true;
    for (const pair of (pointsText ?? '').trim().split(' ')) {
      const match = /^(\d{1,4}),(\d{1,4})$/.exec(pair);
      if (!match) {
        valid = false;
        break;
      }
      const x = Number(match[1]);
      const y = Number(match[2]);
      if (x > DRAWING_WIDTH || y > DRAWING_HEIGHT) {
        valid = false;
        break;
      }
      points.push([x, y]);
    }
    if (!valid || points.length === 0) continue;
    total += points.length;
    if (total > MAX_DRAWING_POINTS) break;
    strokes.push({ color: color as DrawingColor, size: sizeValue as DrawingSize, points });
  }
  return { strokes };
}

/** Le contour d'un trait, lissé par perfect-freehand, en chemin SVG. */
export function strokePath(stroke: Stroke): string {
  const outline = getStroke(stroke.points, {
    size: stroke.size,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
    // Un seul point doit rester visible : un point sur un « i », une flèche.
    last: true,
  });
  if (outline.length === 0) return '';
  const fmt = (n: number) => (Math.round(n * 10) / 10).toString();
  const [first, ...rest] = outline;
  return `M${fmt(first[0])} ${fmt(first[1])}${rest.map(([x, y]) => `L${fmt(x)} ${fmt(y)}`).join('')}Z`;
}

/**
 * Le SVG d'un dessin, construit ici et seulement ici — à partir de nombres
 * et de noms de couleur déjà validés par `decodeDrawing`.
 */
export function drawingSvg(drawing: Drawing): string {
  const paths = drawing.strokes
    .map((s) => {
      const d = strokePath(s);
      return d ? `<path d="${d}" fill="${DRAWING_COLOR_VARS[s.color]}"/>` : '';
    })
    .join('');
  return `<svg viewBox="0 0 ${DRAWING_WIDTH} ${DRAWING_HEIGHT}" role="img" aria-label="Dessin">${paths}</svg>`;
}

/**
 * La gomme retire un trait entier dès qu'elle en touche un point — la plus
 * simple à comprendre, et celle de la plupart des applications de notes.
 */
export function eraseAt(drawing: Drawing, x: number, y: number, radius: number): Drawing {
  const touched = (s: Stroke) =>
    s.points.some(([px, py]) => Math.hypot(px - x, py - y) <= radius + s.size / 2);
  const strokes = drawing.strokes.filter((s) => !touched(s));
  return strokes.length === drawing.strokes.length ? drawing : { strokes };
}

const DRAWING_BLOCK_RE = /<div\b[^>]*\sdata-drawing="([^"]*)"[^>]*>\s*<\/div>/g;

/**
 * Remplit chaque bloc de dessin d'un recto ou d'un verso avec son SVG, pour
 * l'affichage. Le reste du HTML n'est pas touché.
 */
export function renderDrawings(html: string): string {
  return html.replace(
    DRAWING_BLOCK_RE,
    (_block, encoded: string) =>
      `<div class="flashcards-drawing">${drawingSvg(decodeDrawing(encoded))}</div>`,
  );
}

/** Le recto ou le verso contient-il au moins un dessin ? */
export function hasDrawing(html: string): boolean {
  return /\sdata-drawing="/.test(html);
}
