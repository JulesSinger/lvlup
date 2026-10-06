import { describe, expect, it } from 'vitest';
import { coverPositions, photosByFeat } from './photos';
import type { FeatPhoto } from './types';

function photo(id: string, position: number, featId = 'f'): FeatPhoto {
  return { id, featId, path: `${id}.jpg`, thumbPath: `${id}-thumb.jpg`, width: 10, height: 10, bytes: 1, takenAt: null, position, createdAt: '2026-09-30T10:00:00Z' };
}

describe('ranger les photos', () => {
  it('par haut fait, dans leur ordre', () => {
    const map = photosByFeat([photo('b', 1), photo('x', 0, 'g'), photo('a', 0)]);
    expect(map.get('f')!.map((p) => p.id)).toEqual(['a', 'b']);
    expect(map.get('g')!.map((p) => p.id)).toEqual(['x']);
  });

  it('faire d’une photo la couverture ne change que les positions qui bougent', () => {
    const list = [photo('a', 0), photo('b', 1), photo('c', 2), photo('d', 3)];
    expect(coverPositions(list, 'c')).toEqual([
      { id: 'c', position: 0 },
      { id: 'a', position: 1 },
      { id: 'b', position: 2 },
    ]);
    expect(coverPositions(list, 'a')).toEqual([]);
  });
});
