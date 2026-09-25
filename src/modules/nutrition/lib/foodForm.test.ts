import { describe, expect, it } from 'vitest';
import { EMPTY_FOOD_FORM, foodToForm, kcalFromForm, parseGramsToDg, validateFoodForm, type FoodFormValues } from './foodForm';
import type { Food } from './types';

const label: FoodFormValues = {
  ...EMPTY_FOOD_FORM,
  name: '  Poulet rôti de la cantine ',
  kcal: '190',
  protein: '27,5',
  carbs: '0',
  fat: '9.2',
};

describe('parseGramsToDg', () => {
  it('lit la virgule comme le point, en décigrammes', () => {
    expect(parseGramsToDg('12,5')).toBe(125);
    expect(parseGramsToDg('12.5')).toBe(125);
    expect(parseGramsToDg(' 3 ')).toBe(30);
  });

  it('arrondit au décigramme', () => {
    expect(parseGramsToDg('0,26')).toBe(3);
  });

  it('refuse ce qui n’est pas un nombre positif', () => {
    expect(parseGramsToDg('')).toBeNull();
    expect(parseGramsToDg('-1')).toBeNull();
    expect(parseGramsToDg('abc')).toBeNull();
  });
});

describe('kcalFromForm', () => {
  it('suggère les kcal d’après les macros, 4/4/9', () => {
    // 27,5 × 4 + 0 + 9,2 × 9 = 110 + 82,8
    expect(kcalFromForm(label)).toBe(193);
  });

  it('rien tant qu’une macro manque', () => {
    expect(kcalFromForm({ ...label, fat: '' })).toBeNull();
  });
});

describe('validateFoodForm', () => {
  it('convertit une étiquette dans les unités du stockage', () => {
    const result = validateFoodForm({ ...label, fiber: '1,5', servingGrams: '150', favorite: true });
    expect(result).toEqual({
      ok: true,
      input: {
        source: 'custom',
        name: 'Poulet rôti de la cantine',
        brand: null,
        kcal: 190,
        proteinDg: 275,
        carbsDg: 0,
        fatDg: 92,
        fiberDg: 15,
        servingGrams: 150,
        favorite: true,
      },
    });
  });

  it('fibres et portion vides restent vides', () => {
    const result = validateFoodForm(label);
    expect(result.ok && result.input.fiberDg).toBeNull();
    expect(result.ok && result.input.servingGrams).toBeNull();
  });

  it('exige un nom, des kcal entières et les trois macros', () => {
    expect(validateFoodForm({ ...label, name: ' ' }).ok).toBe(false);
    expect(validateFoodForm({ ...label, kcal: '190,5' }).ok).toBe(false);
    expect(validateFoodForm({ ...label, kcal: '1200' }).ok).toBe(false);
    expect(validateFoodForm({ ...label, carbs: '' }).ok).toBe(false);
  });

  it('refuse plus de 100 g de nutriments pour 100 g', () => {
    const result = validateFoodForm({ ...label, protein: '60', carbs: '30', fat: '20' });
    expect(result.ok).toBe(false);
  });

  it('refuse une portion qui n’est pas un nombre entier de grammes', () => {
    expect(validateFoodForm({ ...label, servingGrams: '12,5' }).ok).toBe(false);
  });
});

describe('foodToForm', () => {
  it('fait l’aller-retour avec validateFoodForm', () => {
    const food: Food = {
      id: 'f1',
      source: 'custom',
      barcode: null,
      name: 'Skyr',
      brand: 'Siggi’s',
      kcal: 63,
      proteinDg: 110,
      carbsDg: 40,
      fatDg: 2,
      fiberDg: null,
      servingGrams: 150,
      favorite: true,
      createdAt: '2026-09-25T08:00:00.000Z',
    };
    const form = foodToForm(food);
    expect(form.protein).toBe('11');
    expect(form.fat).toBe('0,2');
    const result = validateFoodForm(form);
    expect(result.ok && result.input).toMatchObject({ name: 'Skyr', brand: 'Siggi’s', proteinDg: 110, fatDg: 2, servingGrams: 150 });
  });
});
