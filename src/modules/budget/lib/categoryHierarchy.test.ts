import { describe, expect, it } from 'vitest';
import { hasChildren, isValidParent, reindexPositions } from './categoryHierarchy';
import type { BudgetCategory } from './types';

function category(patch: Partial<BudgetCategory>): BudgetCategory {
  return {
    id: 'c1',
    name: 'Catégorie',
    emoji: '💶',
    color: '#000000',
    kind: 'variable',
    position: 0,
    parentId: null,
    ...patch,
  };
}

describe('isValidParent', () => {
  it('une catégorie normale est un parent valide', () => {
    const loisirs = category({ id: 'loisirs' });
    expect(isValidParent([loisirs], 'loisirs')).toBe(true);
  });

  it('une sous-catégorie ne peut pas elle-même être parente', () => {
    const loisirs = category({ id: 'loisirs' });
    const onePiece = category({ id: 'one-piece', parentId: 'loisirs' });
    expect(isValidParent([loisirs, onePiece], 'one-piece')).toBe(false);
  });

  it('un id inexistant n’est pas un parent valide', () => {
    expect(isValidParent([], 'fantome')).toBe(false);
  });
});

describe('hasChildren', () => {
  it('détecte une catégorie qui a des sous-catégories', () => {
    const loisirs = category({ id: 'loisirs' });
    const onePiece = category({ id: 'one-piece', parentId: 'loisirs' });
    expect(hasChildren([loisirs, onePiece], 'loisirs')).toBe(true);
  });

  it('une sous-catégorie n’a jamais d’enfants', () => {
    const loisirs = category({ id: 'loisirs' });
    const onePiece = category({ id: 'one-piece', parentId: 'loisirs' });
    expect(hasChildren([loisirs, onePiece], 'one-piece')).toBe(false);
  });
});

describe('reindexPositions', () => {
  it('renumérote chaque groupe de sœurs indépendamment, ordre conservé', () => {
    const loisirs = category({ id: 'loisirs', position: 5 });
    const courses = category({ id: 'courses', position: 9 });
    const onePiece = category({ id: 'one-piece', parentId: 'loisirs', position: 3 });
    const cinema = category({ id: 'cinema', parentId: 'loisirs', position: 7 });
    const categories = [loisirs, courses, onePiece, cinema];
    reindexPositions(categories);
    expect(loisirs.position).toBe(0);
    expect(courses.position).toBe(1);
    expect(onePiece.position).toBe(0);
    expect(cinema.position).toBe(1);
  });
});
