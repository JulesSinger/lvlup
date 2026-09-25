/**
 * Code-barres et Open Food Facts — bibliothèque pure (étape 6,
 * docs/etude-nutrition.md §4, §10). Aucun appel réseau ici : l'appel vit
 * dans `data/openFoodFacts.ts`, ce fichier ne fait que lire et convertir.
 */
import { EMPTY_FOOD_FORM, type FoodFormValues } from './foodForm';

/** Les chiffres d'un code tapé à la main, sans espaces ni tirets. */
export function normalizeBarcode(text: string): string {
  return text.replace(/[\s-]/g, '');
}

/**
 * Un code EAN-8, UPC-A (12 chiffres) ou EAN-13 valide, clé de contrôle
 * comprise. La clé attrape une faute de frappe avant tout appel réseau :
 * sans elle, un chiffre de travers donnerait un « produit inconnu » trompeur.
 */
export function isValidBarcode(code: string): boolean {
  if (!/^(\d{8}|\d{12}|\d{13})$/.test(code)) return false;
  const digits = code.split('').map(Number);
  const check = digits.pop() as number;
  // Depuis la droite, hors clé : poids 3, 1, 3, 1…
  const sum = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** La partie d'une fiche Open Food Facts dont on se sert. */
export interface OffProduct {
  product_name?: string;
  product_name_fr?: string;
  brands?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
}

const KJ_PER_KCAL = 4.184;

function numberOf(value: number | string | undefined): number | null {
  if (value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** 27.46 → « 27,5 » : le format que le formulaire attend, au décigramme. */
function gramsText(value: number | null): string {
  if (value === null) return '';
  return String(Math.round(value * 10) / 10).replace('.', ',');
}

export interface OffConversion {
  values: FoodFormValues;
  /** Ce qui manque sur la fiche et reste à recopier de l'étiquette */
  missing: string[];
}

/**
 * Une fiche Open Food Facts, en formulaire d'aliment pré-rempli.
 *
 * Rien n'est enregistré directement : les données d'Open Food Facts sont
 * participatives, sans garantie (étude §4, §8). L'utilisateur relit le
 * formulaire, complète ce qui manque, corrige ce qui est faux, puis
 * enregistre sa propre copie.
 *
 * Énergie : les kcal si la fiche les donne, sinon les kJ convertis (une fiche
 * européenne n'a parfois que les kJ).
 */
export function offToFoodForm(product: OffProduct): OffConversion {
  const n = product.nutriments ?? {};
  // `energy_100g` est toujours en kJ chez Open Food Facts.
  const kj = numberOf(n['energy-kj_100g']) ?? numberOf(n.energy_100g);
  const kcalValue = numberOf(n['energy-kcal_100g']) ?? (kj === null ? null : kj / KJ_PER_KCAL);
  const protein = numberOf(n.proteins_100g);
  const carbs = numberOf(n.carbohydrates_100g);
  const fat = numberOf(n.fat_100g);
  const serving = numberOf(product.serving_quantity);

  const missing: string[] = [];
  const name = (product.product_name_fr || product.product_name || '').trim();
  if (!name) missing.push('le nom');
  if (kcalValue === null) missing.push('l’énergie');
  if (protein === null) missing.push('les protéines');
  if (carbs === null) missing.push('les glucides');
  if (fat === null) missing.push('les lipides');

  return {
    values: {
      ...EMPTY_FOOD_FORM,
      name: name.slice(0, 120),
      // « Marque A, Marque B » : la première suffit à reconnaître le produit.
      brand: (product.brands ?? '').split(',')[0].trim().slice(0, 80),
      kcal: kcalValue === null ? '' : String(Math.round(kcalValue)),
      protein: gramsText(protein),
      carbs: gramsText(carbs),
      fat: gramsText(fat),
      fiber: gramsText(numberOf(n.fiber_100g)),
      servingGrams: serving !== null && serving >= 1 ? String(Math.round(serving)) : '',
    },
    missing,
  };
}
