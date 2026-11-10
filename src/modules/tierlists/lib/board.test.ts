import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TIERS,
  applyMoves,
  dropIndex,
  endPosition,
  evacuatePlan,
  itemsIn,
  labelFromFileName,
  movePlan,
  nextTierColor,
  placeOrphans,
  resetPlan,
  tierMovePlan,
} from './board';
import type { Tier, TierItem } from './types';

const tier = (id: string, position: number, color: Tier['color'] = 'red'): Tier => ({ id, listId: 'l', label: id, color, position });
const item = (id: string, tierId: string | null, position: number): TierItem => ({
  id,
  listId: 'l',
  tierId,
  label: id,
  image: null,
  position,
  createdAt: '2026-11-10T10:00:00Z',
});

const ids = (items: TierItem[]) => items.map((i) => i.id);

describe('le plateau', () => {
  const tiers = [tier('S', 0), tier('A', 1), tier('B', 2)];
  const items = [item('a', 'S', 0), item('b', 'S', 1), item('c', 'S', 2), item('x', null, 0), item('y', null, 1)];

  it('part de S à D, du rouge au bleu', () => {
    expect(DEFAULT_TIERS.map((t) => t.label)).toEqual(['S', 'A', 'B', 'C', 'D']);
    expect(DEFAULT_TIERS[0].color).toBe('red');
  });

  it('range les éléments par place, la réserve à part', () => {
    expect(ids(itemsIn(items, 'S'))).toEqual(['a', 'b', 'c']);
    expect(ids(itemsIn(items, null))).toEqual(['x', 'y']);
    expect(endPosition(items, 'A')).toBe(0);
    expect(endPosition(items, null)).toBe(2);
  });

  it('déplace un élément de la réserve au milieu d’une rangée', () => {
    const moves = movePlan(items, 'x', 'S', 1);
    expect(moves).toEqual([
      { id: 'x', tierId: 'S', position: 1 },
      { id: 'b', tierId: 'S', position: 2 },
      { id: 'c', tierId: 'S', position: 3 },
    ]);
    expect(ids(itemsIn(applyMoves(items, moves), 'S'))).toEqual(['a', 'x', 'b', 'c']);
  });

  it('réordonne dans la même rangée, sans toucher au reste', () => {
    const moves = movePlan(items, 'a', 'S', 2);
    expect(ids(itemsIn(applyMoves(items, moves), 'S'))).toEqual(['b', 'c', 'a']);
    expect(moves.every((m) => m.tierId === 'S')).toBe(true);
  });

  it('ne change rien quand on relâche à sa place', () => {
    expect(movePlan(items, 'b', 'S', 1)).toEqual([]);
  });

  it('borne la place visée', () => {
    expect(ids(itemsIn(applyMoves(items, movePlan(items, 'x', 'A', 99)), 'A'))).toEqual(['x']);
    expect(ids(itemsIn(applyMoves(items, movePlan(items, 'c', 'S', -3)), 'S'))).toEqual(['c', 'a', 'b']);
    expect(movePlan(items, 'inconnu', 'S', 0)).toEqual([]);
  });

  it('remet tout dans la réserve, S d’abord', () => {
    const moved = applyMoves(items, resetPlan(items, tiers));
    expect(ids(itemsIn(moved, null))).toEqual(['a', 'b', 'c', 'x', 'y']);
    expect(resetPlan(moved, tiers)).toEqual([]);
  });

  it('vide une rangée supprimée au bout de la réserve', () => {
    expect(evacuatePlan(items, 'S')).toEqual([
      { id: 'a', tierId: null, position: 2 },
      { id: 'b', tierId: null, position: 3 },
      { id: 'c', tierId: null, position: 4 },
    ]);
  });

  it('lit un élément d’une rangée disparue comme en réserve', () => {
    expect(placeOrphans([item('z', 'perdue', 0)], tiers)[0].tierId).toBeNull();
  });

  it('monte et descend une rangée', () => {
    expect(tierMovePlan(tiers, 'A', -1)).toEqual([
      { id: 'A', position: 0 },
      { id: 'S', position: 1 },
    ]);
    expect(tierMovePlan(tiers, 'S', -1)).toEqual([]);
    expect(tierMovePlan(tiers, 'B', 1)).toEqual([]);
  });

  it('propose la couleur suivante pour une rangée ajoutée', () => {
    expect(nextTierColor([tier('S', 0, 'red'), tier('D', 1, 'blue')])).toBe('violet');
    expect(nextTierColor([])).toBe('red');
  });
});

describe('où tombe un élément lâché', () => {
  // Deux lignes de tuiles de 50 × 50 : [0, 1, 2] puis [3].
  const rects = [
    { left: 0, top: 0, width: 50, height: 50 },
    { left: 60, top: 0, width: 50, height: 50 },
    { left: 120, top: 0, width: 50, height: 50 },
    { left: 0, top: 60, width: 50, height: 50 },
  ];

  it('avant la tuile dont on est à gauche du milieu', () => {
    expect(dropIndex(rects, 10, 20)).toBe(0);
    expect(dropIndex(rects, 70, 20)).toBe(1);
    expect(dropIndex(rects, 100, 20)).toBe(2);
  });

  it('au bout d’une ligne, puis sur la suivante', () => {
    expect(dropIndex(rects, 160, 20)).toBe(3);
    expect(dropIndex(rects, 10, 80)).toBe(3);
    expect(dropIndex(rects, 40, 80)).toBe(4);
    expect(dropIndex(rects, 300, 80)).toBe(4);
  });

  it('dans une rangée vide', () => {
    expect(dropIndex([], 10, 10)).toBe(0);
  });
});

describe('le nom d’une image ajoutée', () => {
  it('reprend le nom du fichier quand il dit quelque chose', () => {
    expect(labelFromFileName('Ahri.png')).toBe('Ahri');
    expect(labelFromFileName('Lee_Sin.webp')).toBe('Lee Sin');
  });
  it('laisse vide un nom d’appareil photo ou de capture', () => {
    for (const name of ['IMG_1234.JPG', 'PXL_20261110_101010.jpg', 'Screenshot 2026-11-10 at 10.00.00.png', '20261110.jpg', 'image.png'.replace('image', 'image-1')]) {
      expect(labelFromFileName(name)).toBe('');
    }
  });
});
