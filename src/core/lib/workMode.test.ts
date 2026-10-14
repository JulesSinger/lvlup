import { describe, expect, it } from 'vitest';
import { visibleModules } from './workMode';

const mods = ['objectifs', 'budget', 'taches', 'calendrier'].map((id) => ({ id }));
const ids = (list: { id: string }[]) => list.map((m) => m.id);

describe('visibleModules', () => {
  it('hors mode travail, tous les modules', () => {
    expect(ids(visibleModules(mods, { workMode: false, workModules: ['taches'] }))).toEqual(['objectifs', 'budget', 'taches', 'calendrier']);
  });

  it('au travail, seulement ceux choisis, dans leur ordre', () => {
    expect(ids(visibleModules(mods, { workMode: true, workModules: ['calendrier', 'taches'] }))).toEqual(['taches', 'calendrier']);
  });

  it('un mode travail sans module connu garde tout, plutôt qu’un écran vide', () => {
    expect(ids(visibleModules(mods, { workMode: true, workModules: ['inconnu'] }))).toHaveLength(4);
  });
});
