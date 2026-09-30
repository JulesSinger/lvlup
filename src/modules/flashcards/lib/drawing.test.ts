import { describe, expect, it } from 'vitest';
import {
  DRAWING_HEIGHT,
  DRAWING_WIDTH,
  MAX_DRAWING_POINTS,
  addPoint,
  decodeDrawing,
  drawingSvg,
  encodeDrawing,
  eraseAt,
  hasDrawing,
  renderDrawings,
} from './drawing';
import type { Drawing } from './drawing';

const sample: Drawing = {
  strokes: [
    { color: 'ink', size: 3, points: [[10, 10], [20, 15], [30, 30]] },
    { color: 'red', size: 12, points: [[100, 200]] },
  ],
};

describe('encodeDrawing / decodeDrawing', () => {
  it('fait l’aller-retour sans rien perdre', () => {
    expect(decodeDrawing(encodeDrawing(sample))).toEqual(sample);
  });

  it('écrit une forme qu’un attribut HTML n’a pas à échapper', () => {
    expect(encodeDrawing(sample)).toMatch(/^[a-z0-9:, |]+$/);
  });

  it('rend un dessin vide pour une valeur absente', () => {
    expect(decodeDrawing(null)).toEqual({ strokes: [] });
    expect(decodeDrawing('')).toEqual({ strokes: [] });
  });

  it('écarte un trait mal formé, sans toucher aux autres', () => {
    const decoded = decodeDrawing('ink:3:10,10 20,20|purple:3:1,1|red:5:1,1|blue:6:1,1 x,2|green:6:900,10|orange:6:5,5');
    expect(decoded.strokes.map((s) => s.color)).toEqual(['ink', 'orange']);
  });

  it('refuse tout ce qui ressemblerait à du code', () => {
    const decoded = decodeDrawing('ink:3:1,1"/><script>alert(1)</script>');
    expect(decoded.strokes).toEqual([]);
  });

  it('s’arrête au-delà du nombre de points permis', () => {
    const big = Array.from({ length: MAX_DRAWING_POINTS + 10 }, () => '1,1').join(' ');
    expect(decodeDrawing(`ink:3:${big}`).strokes).toEqual([]);
  });
});

describe('addPoint', () => {
  it('arrondit et garde le point dans le cadre', () => {
    expect(addPoint([], -5.4, 9999)).toEqual([[0, DRAWING_HEIGHT]]);
    expect(addPoint([], 12.6, 3.2)).toEqual([[13, 3]]);
    expect(addPoint([], DRAWING_WIDTH + 1, 0)).toEqual([[DRAWING_WIDTH, 0]]);
  });

  it('ignore un point collé au précédent', () => {
    const points = addPoint([], 10, 10);
    expect(addPoint(points, 10.4, 10.4)).toBe(points);
    expect(addPoint(points, 14, 10)).toHaveLength(2);
  });
});

describe('drawingSvg', () => {
  it('dessine un chemin par trait, aux couleurs du thème', () => {
    const svg = drawingSvg(sample);
    expect(svg.match(/<path /g)).toHaveLength(2);
    expect(svg).toContain('fill="var(--text)"');
    expect(svg).toContain('fill="var(--red)"');
    expect(svg).toContain(`viewBox="0 0 ${DRAWING_WIDTH} ${DRAWING_HEIGHT}"`);
  });

  it('garde visible un trait d’un seul point', () => {
    expect(drawingSvg({ strokes: [sample.strokes[1]] })).toMatch(/<path d="M[\d.]+ [\d.]+L/);
  });
});

describe('eraseAt', () => {
  it('retire le trait touché, et lui seul', () => {
    expect(eraseAt(sample, 21, 15, 4).strokes.map((s) => s.color)).toEqual(['red']);
  });

  it('rend le même dessin quand rien n’est touché', () => {
    expect(eraseAt(sample, 400, 50, 4)).toBe(sample);
  });
});

describe('renderDrawings', () => {
  it('remplit un bloc de dessin avec son SVG, sans toucher au texte', () => {
    const html = `<p>Le cœur</p><div data-drawing="${encodeDrawing(sample)}" class="flashcards-drawing"></div><p>fin</p>`;
    const out = renderDrawings(html);
    expect(out.startsWith('<p>Le cœur</p><div class="flashcards-drawing"><svg')).toBe(true);
    expect(out.endsWith('</svg></div><p>fin</p>')).toBe(true);
    expect(hasDrawing(html)).toBe(true);
    expect(hasDrawing('<p>Hola</p>')).toBe(false);
  });
});
