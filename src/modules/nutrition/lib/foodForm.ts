/**
 * Le formulaire d'un aliment perso — bibliothèque pure (étape 5,
 * docs/etude-nutrition.md §10). Il se remplit depuis une étiquette : valeurs
 * pour 100 g, avec une virgule décimale (« 12,5 »), et ne doit jamais laisser
 * passer une valeur que la base refuserait ensuite.
 */
import { KCAL_PER_GRAM } from './macros';
import type { Food, FoodInput } from './types';

/** Ce que l'écran garde en mémoire : du texte, tel que tapé. */
export interface FoodFormValues {
  name: string;
  brand: string;
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
  servingGrams: string;
  favorite: boolean;
}

export const EMPTY_FOOD_FORM: FoodFormValues = {
  name: '',
  brand: '',
  kcal: '',
  protein: '',
  carbs: '',
  fat: '',
  fiber: '',
  servingGrams: '',
  favorite: false,
};

/** Grammes lus avec virgule ou point, en décigrammes entiers. `null` si illisible ou négatif. */
export function parseGramsToDg(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  return Math.round(Number(trimmed) * 10);
}

const dgText = (dg: number) => String(dg / 10).replace('.', ',');

/** Un aliment existant, remis sous forme de formulaire pour le modifier. */
export function foodToForm(food: Food): FoodFormValues {
  return {
    name: food.name,
    brand: food.brand ?? '',
    kcal: String(food.kcal),
    protein: dgText(food.proteinDg),
    carbs: dgText(food.carbsDg),
    fat: dgText(food.fatDg),
    fiber: food.fiberDg === null ? '' : dgText(food.fiberDg),
    servingGrams: food.servingGrams === null ? '' : String(food.servingGrams),
    favorite: food.favorite,
  };
}

/**
 * kcal suggérées d'après les macros (4/4/9), pour qui n'a que les grammes
 * sous les yeux. `null` tant qu'une des trois manque.
 */
export function kcalFromForm(values: FoodFormValues): number | null {
  const protein = parseGramsToDg(values.protein);
  const carbs = parseGramsToDg(values.carbs);
  const fat = parseGramsToDg(values.fat);
  if (protein === null || carbs === null || fat === null) return null;
  return Math.round(
    (protein * KCAL_PER_GRAM.protein + carbs * KCAL_PER_GRAM.carbs + fat * KCAL_PER_GRAM.fat) / 10,
  );
}

export type FoodFormResult = { ok: true; input: FoodInput } | { ok: false; error: string };

/**
 * Valide le formulaire et le convertit dans les unités du stockage. Les
 * bornes sont celles des CHECK de `nutrition_foods` (migration du
 * 25/09/2026) : une erreur ici plutôt qu'un refus de Postgres,
 * incompréhensible à l'écran.
 */
export function validateFoodForm(values: FoodFormValues): FoodFormResult {
  const name = values.name.trim();
  if (!name) return { ok: false, error: 'Le nom est obligatoire.' };
  if (name.length > 120) return { ok: false, error: 'Le nom est trop long (120 caractères au plus).' };
  const brand = values.brand.trim();
  if (brand.length > 80) return { ok: false, error: 'La marque est trop longue (80 caractères au plus).' };

  const kcal = Number(values.kcal.trim());
  if (values.kcal.trim() === '' || !Number.isInteger(kcal) || kcal < 0 || kcal > 1000) {
    return { ok: false, error: 'Indique les kcal pour 100 g, en nombre entier entre 0 et 1 000.' };
  }

  const proteinDg = parseGramsToDg(values.protein);
  const carbsDg = parseGramsToDg(values.carbs);
  const fatDg = parseGramsToDg(values.fat);
  if (proteinDg === null || carbsDg === null || fatDg === null) {
    return { ok: false, error: 'Indique les protéines, glucides et lipides pour 100 g (0 si aucun).' };
  }
  const fiberDg = values.fiber.trim() === '' ? null : parseGramsToDg(values.fiber);
  if (values.fiber.trim() !== '' && fiberDg === null) {
    return { ok: false, error: 'Les fibres doivent être un nombre de grammes, ou rester vides.' };
  }
  // 100 g d'aliment ne contiennent pas plus de 100 g de nutriments — une
  // demi-unité de marge pour les arrondis d'étiquette.
  if (proteinDg + carbsDg + fatDg > 1005) {
    return { ok: false, error: 'Protéines, glucides et lipides dépassent 100 g pour 100 g : vérifie l’étiquette.' };
  }

  const serving = values.servingGrams.trim();
  const servingGrams = serving === '' ? null : Number(serving);
  if (servingGrams !== null && (!Number.isInteger(servingGrams) || servingGrams < 1 || servingGrams > 10000)) {
    return { ok: false, error: 'La portion doit être un nombre entier de grammes, ou rester vide.' };
  }

  return {
    ok: true,
    input: {
      source: 'custom',
      name,
      brand: brand || null,
      kcal,
      proteinDg,
      carbsDg,
      fatDg,
      fiberDg,
      servingGrams,
      favorite: values.favorite,
    },
  };
}
