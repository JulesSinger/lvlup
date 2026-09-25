import type { OffProduct } from '../lib/barcode';

/**
 * Lecture d'un produit sur Open Food Facts, par code-barres (étape 6,
 * docs/etude-nutrition.md §4).
 *
 * Ce n'est pas un stockage — rien n'est écrit chez Open Food Facts —, d'où
 * un simple module à côté du contrat plutôt qu'une méthode de
 * `NutritionStore`. Le produit lu est recopié chez l'utilisateur
 * (`nutrition_foods`) après relecture : le rescanner ne coûtera plus aucun
 * appel, et marchera hors ligne.
 *
 * Limites de l'API : 15 lectures par minute et par adresse, largement assez
 * pour un scan à la fois. La recherche textuelle d'Open Food Facts (10 par
 * minute, interdite pendant la frappe) n'est jamais utilisée.
 */

const ENDPOINT = 'https://world.openfoodfacts.org/api/v2/product/';
const FIELDS = 'product_name,product_name_fr,brands,serving_quantity,nutriments';

/**
 * Open Food Facts demande que chaque application s'identifie. Un navigateur
 * interdit de modifier `User-Agent` ; l'API accepte `X-User-Agent` à la place
 * (vérifié dans ses en-têtes CORS le 25/09/2026).
 */
const APP_ID = 'Atlas-Ceres/1.0 (application personnelle)';

export type OffLookup = { found: true; product: OffProduct } | { found: false };

export async function lookupBarcode(code: string): Promise<OffLookup> {
  let response: Response;
  try {
    response = await fetch(`${ENDPOINT}${encodeURIComponent(code)}.json?fields=${FIELDS}`, {
      headers: { 'X-User-Agent': APP_ID },
    });
  } catch {
    throw new Error('Open Food Facts ne répond pas. Vérifie la connexion, ou recopie l’étiquette.');
  }
  // Un produit inconnu répond 404 avec `status: 0` : ce n'est pas une panne.
  if (response.status === 404) return { found: false };
  if (response.status === 429) {
    throw new Error('Trop de recherches d’affilée sur Open Food Facts : réessaie dans une minute.');
  }
  if (!response.ok) throw new Error(`Open Food Facts a répondu une erreur (${response.status}).`);
  const body = (await response.json()) as { status?: number; product?: OffProduct };
  return body.status === 1 && body.product ? { found: true, product: body.product } : { found: false };
}

/** Mention exigée par la licence ODbL, à afficher avec les données (étude §4). */
export const OFF_CREDIT = 'Open Food Facts (ODbL)';
