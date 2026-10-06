import { describe, expect, it } from 'vitest';
import { DESIGN_COLORS_MAX, inkOn, normalizeDesign, normalizeHex, referenceLines } from './design';

describe('la fiche design', () => {
  it('lit un code couleur sous toutes ses formes', () => {
    expect(normalizeHex('E7B7C3')).toBe('#e7b7c3');
    expect(normalizeHex(' #ABC ')).toBe('#aabbcc');
    expect(normalizeHex('#12345')).toBeNull();
    expect(normalizeHex('rose')).toBeNull();
  });

  it('écarte les couleurs invalides et les doublons, et plafonne', () => {
    const many = Array.from({ length: 12 }, (_, i) => `#0000${String(i).padStart(2, '0')}`);
    expect(normalizeDesign({ colors: ['#ABC', 'aabbcc', 'rouge', 4] }).colors).toEqual(['#aabbcc']);
    expect(normalizeDesign({ colors: many }).colors).toHaveLength(DESIGN_COLORS_MAX);
    expect(normalizeDesign(null)).toEqual({ colors: [], titleFont: '', bodyFont: '', mood: '', references: '' });
  });

  it('les références, une par ligne', () => {
    expect(referenceLines('a.fr\n\n  b.fr  \n')).toEqual(['a.fr', 'b.fr']);
  });

  it('un texte lisible sur chaque pastille', () => {
    expect(inkOn('#f8f3ec')).toBe('dark');
    expect(inkOn('#2b2522')).toBe('light');
    expect(inkOn('#4e6b4a')).toBe('light');
  });
});
