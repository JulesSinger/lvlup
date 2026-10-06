import { describe, expect, it } from 'vitest';
import { moveItem, positionPatches } from './order';

describe('réordonner', () => {
  it('moveItem déplace un élément, vers le haut ou vers le bas, bornes comprises', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveItem(['a', 'b', 'c'], 1, 9)).toEqual(['a', 'c', 'b']);
    expect(moveItem(['a', 'b'], 5, 0)).toEqual(['a', 'b']);
  });

  it('positionPatches n’écrit que les positions qui changent', () => {
    const tasks = [
      { id: 'a', position: 0 },
      { id: 'b', position: 1 },
      { id: 'c', position: 2 },
    ];
    expect(positionPatches(tasks, ['a', 'c', 'b'])).toEqual([
      { id: 'c', position: 1 },
      { id: 'b', position: 2 },
    ]);
    expect(positionPatches(tasks, ['a', 'b', 'c'])).toEqual([]);
  });
});
