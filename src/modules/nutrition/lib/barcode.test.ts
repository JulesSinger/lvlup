import { describe, expect, it } from 'vitest';
import { isValidBarcode, normalizeBarcode, offToFoodForm } from './barcode';

describe('normalizeBarcode', () => {
  it('retire espaces et tirets', () => {
    expect(normalizeBarcode(' 3017 6204-22003 ')).toBe('3017620422003');
  });
});

describe('isValidBarcode', () => {
  it('accepte un EAN-13, un EAN-8 et un UPC-A dont la clé est juste', () => {
    expect(isValidBarcode('3017620422003')).toBe(true); // pâte à tartiner, EAN-13
    expect(isValidBarcode('96385074')).toBe(true); // EAN-8
    expect(isValidBarcode('036000291452')).toBe(true); // UPC-A
  });

  it('refuse une faute de frappe (clé de contrôle fausse)', () => {
    expect(isValidBarcode('3017620422004')).toBe(false);
  });

  it('refuse une longueur ou des caractères inattendus', () => {
    expect(isValidBarcode('12345')).toBe(false);
    expect(isValidBarcode('30176204220a3')).toBe(false);
  });
});

describe('offToFoodForm', () => {
  it('pré-remplit le formulaire depuis une fiche complète, au format français', () => {
    const { values, missing } = offToFoodForm({
      product_name: 'Nutella',
      product_name_fr: 'Pâte à tartiner aux noisettes',
      brands: 'Nutella, Ferrero',
      serving_quantity: 15,
      nutriments: {
        'energy-kcal_100g': 539,
        proteins_100g: 6.3,
        carbohydrates_100g: 57.5,
        fat_100g: 30.9,
        fiber_100g: 0,
      },
    });
    expect(values).toMatchObject({
      name: 'Pâte à tartiner aux noisettes',
      brand: 'Nutella',
      kcal: '539',
      protein: '6,3',
      carbs: '57,5',
      fat: '30,9',
      fiber: '0',
      servingGrams: '15',
      favorite: false,
    });
    expect(missing).toEqual([]);
  });

  it('convertit les kJ quand la fiche n’a pas les kcal', () => {
    const { values } = offToFoodForm({
      product_name: 'Biscuit',
      nutriments: { 'energy-kj_100g': 2092, proteins_100g: 6, carbohydrates_100g: 70, fat_100g: 20 },
    });
    expect(values.kcal).toBe('500');
  });

  it('arrondit au décigramme', () => {
    expect(offToFoodForm({ nutriments: { proteins_100g: 27.46 } }).values.protein).toBe('27,5');
  });

  it('dit ce qui manque plutôt que de mettre des zéros', () => {
    const { values, missing } = offToFoodForm({ product_name: 'Mystère', nutriments: { proteins_100g: 3 } });
    expect(values.fat).toBe('');
    expect(missing).toEqual(['l’énergie', 'les glucides', 'les lipides']);
  });

  it('une fiche vide ne plante pas', () => {
    expect(offToFoodForm({}).missing).toContain('le nom');
  });
});
