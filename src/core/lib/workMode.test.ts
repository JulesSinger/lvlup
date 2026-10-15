import { describe, expect, it } from 'vitest';
import { hiddenAfterChoice, visibleModules } from './workMode';

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

describe('modules cachés', () => {
  it('les modules cachés disparaissent, l’ordre reste', () => {
    expect(ids(visibleModules(mods, { workMode: false, workModules: [], hiddenModules: ['budget'] }))).toEqual(['objectifs', 'taches', 'calendrier']);
  });

  it('jamais choisi (null) : tout est là', () => {
    expect(visibleModules(mods, { workMode: false, workModules: [], hiddenModules: null })).toHaveLength(4);
  });

  it('tout caché : tout reste, plutôt qu’un écran vide', () => {
    expect(visibleModules(mods, { workMode: false, workModules: [], hiddenModules: ids(mods) })).toHaveLength(4);
  });

  it('au travail, le mode travail s’applique à ce qui reste', () => {
    expect(ids(visibleModules(mods, { workMode: true, workModules: ['taches', 'calendrier'], hiddenModules: ['calendrier'] }))).toEqual(['taches']);
  });

  it('un mode travail fait seulement de modules cachés garde les modules visibles', () => {
    expect(ids(visibleModules(mods, { workMode: true, workModules: ['budget'], hiddenModules: ['budget'] }))).toEqual(['objectifs', 'taches', 'calendrier']);
  });
});

describe('hiddenAfterChoice', () => {
  it('cache tout ce qui n’est pas choisi', () => {
    expect(hiddenAfterChoice(ids(mods), ['taches'])).toEqual(['objectifs', 'budget', 'calendrier']);
  });

  it('un choix vide ou inconnu ne cache rien', () => {
    expect(hiddenAfterChoice(ids(mods), [])).toEqual([]);
    expect(hiddenAfterChoice(ids(mods), ['inconnu'])).toEqual([]);
  });
});
