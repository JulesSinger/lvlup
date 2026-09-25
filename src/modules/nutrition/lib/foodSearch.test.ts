import { describe, expect, it } from 'vitest';
import { buildIndex, normalize, searchFoods } from './foodSearch';

const NAMES = [
  'Pomme, pulpe et peau, crue',
  'Pomme, crue',
  'Compote de pomme',
  'Pomme de terre, cuite à l’eau',
  'Poulet, filet, sans peau, rôti',
  'Crème fraîche épaisse',
  'Œuf, dur',
  'Riz basmati, cuit',
  'Noix, séchée',
];
const index = buildIndex(NAMES, (n) => n);
const search = (q: string, opts = {}) => searchFoods(index, q, opts);

describe('normalize', () => {
  it('ignore la casse, les accents, les ligatures et la ponctuation', () => {
    expect(normalize('  Crème  Fraîche, ÉPAISSE ')).toBe('creme fraiche epaisse');
    expect(normalize('Œuf')).toBe('oeuf');
  });
});

describe('searchFoods', () => {
  it('trouve sans les accents', () => {
    expect(search('creme')).toEqual(['Crème fraîche épaisse']);
    expect(search('oeuf')).toEqual(['Œuf, dur']);
  });

  it('chaque mot tapé est le début d’un mot du nom, dans n’importe quel ordre', () => {
    expect(search('poul roti')).toEqual(['Poulet, filet, sans peau, rôti']);
    expect(search('roti poul')).toEqual(['Poulet, filet, sans peau, rôti']);
  });

  it('tous les mots doivent être présents', () => {
    expect(search('pomme cuite')).toEqual(['Pomme de terre, cuite à l’eau']);
  });

  it('un pluriel ne fait pas rater l’aliment', () => {
    expect(search('pommes crues')).toEqual(['Pomme, crue', 'Pomme, pulpe et peau, crue']);
    expect(search('noix')).toEqual(['Noix, séchée']);
  });

  it('les noms qui commencent par le mot tapé passent devant, les plus courts d’abord', () => {
    expect(search('pomme')).toEqual([
      'Pomme, crue',
      'Pomme, pulpe et peau, crue',
      'Pomme de terre, cuite à l’eau',
      'Compote de pomme',
    ]);
  });

  it('la priorité (récents, favoris) l’emporte sur tout le reste', () => {
    const priority = (n: string) => (n === 'Compote de pomme' ? 1 : 0);
    expect(search('pomme', { priority })[0]).toBe('Compote de pomme');
  });

  it('respecte la limite', () => {
    expect(search('pomme', { limit: 2 })).toHaveLength(2);
  });

  it('une recherche vide ou faite de ponctuation ne renvoie rien', () => {
    expect(search('')).toEqual([]);
    expect(search(' , ')).toEqual([]);
  });

  it('ne trouve rien au milieu d’un mot', () => {
    expect(search('asmati')).toEqual([]);
  });
});
