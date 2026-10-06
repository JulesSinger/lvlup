/**
 * La fiche design (docs/etude-projets.md §3.5) — bibliothèque pure.
 */
import type { ProjectDesign } from './types';

export const DESIGN_COLORS_MAX = 8;

/** « E7B7C3 », « #e7b7c3 », « #abc » → « #e7b7c3 » ; autre chose → `null`. */
export function normalizeHex(text: string): string | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text.trim());
  if (!m) return null;
  const hex = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1];
  return `#${hex.toLowerCase()}`;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** La fiche telle qu'on peut s'y fier : couleurs valides, sans doublon, plafonnées. */
export function normalizeDesign(raw: unknown): Required<ProjectDesign> {
  const v = isObject(raw) ? raw : {};
  const colors = Array.isArray(v.colors) ? v.colors.map((c) => (typeof c === 'string' ? normalizeHex(c) : null)).filter((c): c is string => c !== null) : [];
  return {
    colors: [...new Set(colors)].slice(0, DESIGN_COLORS_MAX),
    titleFont: str(v.titleFont),
    bodyFont: str(v.bodyFont),
    mood: str(v.mood),
    references: str(v.references),
  };
}

/** Les sites de référence, un par ligne, lignes vides écartées. */
export function referenceLines(references: string): string[] {
  return references
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

/**
 * Le texte le plus lisible sur une couleur : sombre sur une couleur claire,
 * clair sur une sombre (luminance relative WCAG). Rend un nom, pas une
 * couleur : la feuille de style choisit la teinte.
 */
export function inkOn(hex: string): 'dark' | 'light' {
  const n = normalizeHex(hex);
  if (!n) return 'dark';
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? 'dark' : 'light';
}
