import { describe, expect, it } from 'vitest';
import { loadCiqual } from './ciqual';
import { buildIndex, searchFoods } from './foodSearch';

/**
 * Vérifie le fichier réellement embarqué, pas un extrait : une régénération
 * ratée de la table (mauvais fichier source, colonne décalée) doit casser
 * ici plutôt que d'afficher des valeurs fausses à l'écran.
 */
describe('la table CIQUAL embarquée', async () => {
  const foods = await loadCiqual();

  it('contient la quasi-totalité des 3 484 aliments de la version 2025', () => {
    expect(foods.length).toBeGreaterThan(3300);
    expect(foods.length).toBeLessThanOrEqual(3484);
  });

  it('chaque code est unique', () => {
    expect(new Set(foods.map((f) => f.code)).size).toBe(foods.length);
  });

  it('toutes les valeurs sont des entiers plausibles pour 100 g', () => {
    for (const f of foods) {
      expect(f.name.length).toBeGreaterThan(0);
      for (const v of [f.kcal, f.proteinDg, f.carbsDg, f.fatDg]) {
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
      }
      expect(f.kcal).toBeLessThanOrEqual(900); // l'huile, 100 % lipides
      expect(f.proteinDg + f.carbsDg + f.fatDg).toBeLessThanOrEqual(1005); // 100 g, arrondis compris
    }
  });

  it('les colonnes sont dans le bon ordre (l’huile d’olive est grasse, pas protéinée)', () => {
    const [oil] = searchFoods(buildIndex(foods, (f) => f.name), 'huile olive vierge extra');
    expect(oil.kcal).toBeGreaterThan(850);
    expect(oil.fatDg).toBeGreaterThan(950);
    expect(oil.proteinDg).toBeLessThan(10);
  });

  it('la recherche trouve un aliment courant', () => {
    const index = buildIndex(foods, (f) => f.name);
    expect(searchFoods(index, 'pomme crue').map((f) => f.name)).toContain('Pomme, chair et peau, crue');
    expect(searchFoods(index, 'riz blanc cuit').length).toBeGreaterThan(0);
  });

  it('se charge une seule fois', async () => {
    expect(await loadCiqual()).toBe(foods);
  });
});
