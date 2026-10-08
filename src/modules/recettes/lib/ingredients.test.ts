import { describe, expect, it } from 'vitest';
import { REAL_INGREDIENT_LINES } from './ingredients.corpus';
import { agreeName, formatQuantity, ingredientKey, isSectionHeading, parseIngredient, scaleIngredient } from './ingredients';

const read = (t: string) => {
  const p = parseIngredient(t);
  return [p.quantity, p.quantityMax, p.unit, p.name, p.extra];
};

describe('lire une ligne d’ingrédient', () => {
  it.each([
    ['600 g de boeuf haché', [600, null, 'g', 'boeuf haché', '']],
    ["2 gousses d'ail", [2, null, 'gousse', 'ail', '']],
    ['15 cl d’eau', [15, null, 'cl', 'eau', '']],
    ['1 l de lait', [1, null, 'l', 'lait', '']],
    ['3 pincées de muscade râpée', [3, null, 'pincee', 'muscade râpée', '']],
    ["6 cuillères à soupe d'huile d'olive", [6, null, 'cas', "huile d'olive", '']],
    ["2 c. à s. d'huile", [2, null, 'cas', 'huile', '']],
    ['1 c.à.c de cannelle', [1, null, 'cac', 'cannelle', '']],
    ['250g de farine', [250, null, 'g', 'farine', '']],
    ['1,5 l d’eau', [1.5, null, 'l', 'eau', '']],
    ['½ citron', [0.5, null, null, 'citron', '']],
    ['1 1/2 cuillère à café de sel', [1.5, null, 'cac', 'sel', '']],
    ['2 à 3 tomates', [2, 3, null, 'tomates', '']],
    ['une pincée de sel', [1, null, 'pincee', 'sel', '']],
    ['un peu de sel', [null, null, null, 'un peu de sel', '']],
    ['- 3 oeufs', [3, null, null, 'oeufs', '']],
    ['4 tranche(s) Jambon cru', [4, null, 'tranche', 'Jambon cru', '']],
    ['1 bouquet garni', [1, null, null, 'bouquet garni', '']],
    ['100 g de beurre + une noix pour le moule', [100, null, 'g', 'beurre', '+ une noix pour le moule']],
    ['2 oignons (facultatif)', [2, null, null, 'oignons', '(facultatif)']],
    ['Sel poivre', [null, null, null, 'Sel poivre', '']],
    ['3 lardons', [3, null, null, 'lardons', '']],
    ['2 litres de bouillon', [2, null, 'l', 'bouillon', '']],
  ] as const)('%s', (text, expected) => {
    expect(read(text)).toEqual(expected);
  });

  it('« l » de « lait » n’est pas un litre, ni « g » de « gingembre » un gramme', () => {
    expect(parseIngredient('1 lait concentré').unit).toBeNull();
    expect(parseIngredient('2 gingembres').unit).toBeNull();
  });

  it('le nom replié sert à comparer : accents, casse, (s), pluriels', () => {
    expect(ingredientKey('Œuf(s) entier(s)')).toBe('oeuf entier');
    expect(ingredientKey('oeufs entiers')).toBe('oeuf entier');
    expect(ingredientKey('Pommes de terre')).toBe('pomme de terre');
  });

  it('repère un titre de groupe', () => {
    expect(isSectionHeading('Pour la béchamel :')).toBe(true);
    expect(isSectionHeading('Pour la pâte')).toBe(true);
    expect(isSectionHeading('Préparation')).toBe(true);
    expect(isSectionHeading('2 oignons')).toBe(false);
    expect(isSectionHeading('sel')).toBe(false);
  });
});

describe('le corpus réel (Marmiton, CuisineAZ)', () => {
  it('toute ligne se lit, et une quantité a toujours un nom', () => {
    for (const line of REAL_INGREDIENT_LINES) {
      const p = parseIngredient(line);
      if (p.quantity !== null) expect(p.name.length, line).toBeGreaterThan(0);
      expect(scaleIngredient(line, 1)).toBe(line);
    }
  });

  it('presque toutes les lignes avec un chiffre en tête ont une quantité', () => {
    const numbered = REAL_INGREDIENT_LINES.filter((l) => /^\d/.test(l));
    const read = numbered.filter((l) => parseIngredient(l).quantity !== null);
    expect(read.length).toBe(numbered.length);
  });

  it('doubler une recette double chaque quantité qu’on sait lire', () => {
    for (const line of REAL_INGREDIENT_LINES) {
      const before = parseIngredient(line);
      if (before.quantity === null) continue;
      const after = parseIngredient(scaleIngredient(line, 2));
      const unitRatio = before.unit === 'g' && after.unit === 'kg' ? 1000 : before.unit === 'cl' && after.unit === 'l' ? 100 : 1;
      expect(after.quantity! * unitRatio, line).toBeCloseTo(before.quantity * 2, 0);
    }
  });
});

describe('ajuster au nombre de personnes', () => {
  it.each([
    ['600 g de boeuf haché', 3 / 8, '225 g de boeuf haché'],
    ['600 g de boeuf haché', 2, '1,2 kg de boeuf haché'],
    ['60 cl de lait', 2, '1,2 l de lait'],
    ['20 cl de crème fraîche', 3 / 8, '7,5 cl de crème fraîche'],
    ['1 l de lait', 3 / 8, '0,4 l de lait'],
    ["2 gousses d'ail", 3 / 8, "¾ gousse d'ail"],
    ['1 feuille de laurier', 2, '2 feuilles de laurier'],
    ["2 c. à s. d'huile", 3, "6 c. à s. d'huile"],
    ['3 oignons jaunes', 3 / 8, '1 ¼ oignons jaunes'],
    ['1 oignon jaune', 2, '2 oignons jaunes'],
    ['1 pâte brisée', 2, '2 pâtes brisées'],
    ['6 pommes Golden', 2, '12 pommes Golden'],
    ['1 Œuf(s)', 2, '2 Œufs'],
    ['4 Radis', 3 / 8, '1 ½ Radis'],
    ['2 à 3 tomates', 2, '4 à 6 tomates'],
    ['- 3 oeufs', 2, '- 6 oeufs'],
    ['sel', 2, 'sel'],
    ['100 g de beurre + une noix pour le moule', 2, '200 g de beurre + une noix pour le moule'],
  ] as const)('%s × %d', (text, factor, expected) => {
    expect(scaleIngredient(text, factor)).toBe(expected);
  });

  it('des quantités qui se mesurent', () => {
    expect(formatQuantity(11.25, 'g')).toBe('11');
    expect(formatQuantity(112.5, 'g')).toBe('115');
    expect(formatQuantity(3.3, 'g')).toBe('3,5');
    expect(formatQuantity(0.1, null)).toBe('¼');
    expect(formatQuantity(2.4, 'cas')).toBe('2 ½');
    expect(formatQuantity(1.05, 'kg')).toBe('1,1');
  });

  it('accorde un nom compté jusqu’à la première préposition', () => {
    expect(agreeName('pomme de terre', true)).toBe('pommes de terre');
    expect(agreeName('gâteau', true)).toBe('gâteaux');
    expect(agreeName('noix', true)).toBe('noix');
  });
});
