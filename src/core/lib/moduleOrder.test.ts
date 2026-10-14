import { describe, expect, it } from 'vitest';
import { dropIndex, orderModules, reorderSubset } from './moduleOrder';

const mods = ['objectifs', 'budget', 'taches', 'sport'].map((id) => ({ id }));
const ids = (list: { id: string }[]) => list.map((m) => m.id);

describe('orderModules', () => {
  it('sans ordre choisi, garde celui du registre', () => {
    expect(ids(orderModules(mods, []))).toEqual(['objectifs', 'budget', 'taches', 'sport']);
  });

  it('suit l’ordre choisi', () => {
    expect(ids(orderModules(mods, ['sport', 'taches', 'objectifs', 'budget']))).toEqual(['sport', 'taches', 'objectifs', 'budget']);
  });

  it('un module ajouté depuis vient à la fin, un module disparu est ignoré', () => {
    expect(ids(orderModules(mods, ['taches', 'ancien', 'objectifs']))).toEqual(['taches', 'objectifs', 'budget', 'sport']);
  });
});

describe('reorderSubset', () => {
  it('réordonne les modules visibles sans déplacer les autres', () => {
    expect(reorderSubset(['objectifs', 'taches', 'budget', 'calendrier'], ['calendrier', 'taches'])).toEqual(['objectifs', 'calendrier', 'budget', 'taches']);
  });
});

describe('dropIndex', () => {
  // Une colonne de trois boutons de 40 px, espacés de 10.
  const column = [0, 50, 100].map((top) => ({ left: 0, top, width: 40, bottom: top + 40 }));

  it('dans une colonne, compte ceux au-dessus du pointeur', () => {
    expect(dropIndex(column, 20, -5)).toBe(0);
    expect(dropIndex(column, 20, 45)).toBe(1);
    expect(dropIndex(column, 20, 200)).toBe(3);
  });

  it('dans une grille, compte aussi ceux de la rangée à gauche', () => {
    // Deux rangées de trois cases de 100 px.
    const grid = [0, 1].flatMap((row) => [0, 1, 2].map((col) => ({ left: col * 110, top: row * 110, width: 100, bottom: row * 110 + 100 })));
    expect(dropIndex(grid, 5, 50)).toBe(0);
    expect(dropIndex(grid, 170, 50)).toBe(2);
    expect(dropIndex(grid, 60, 160)).toBe(4);
  });
});
