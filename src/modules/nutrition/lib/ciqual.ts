import type { CiqualRow } from './ciqualImport';
import type { NutrientValues } from './macros';

/**
 * La table CIQUAL embarquée (docs/etude-nutrition.md §4) : les aliments
 * génériques, livrés avec l'application plutôt que mis en base — recherche
 * instantanée, hors ligne, sans rien consommer du palier gratuit.
 *
 * Régénérée par `scripts/import-ciqual.mjs` ; les règles de conversion sont
 * dans `lib/ciqualImport.ts`.
 */

/** Un aliment générique. Valeurs pour 100 g, dans les unités de `lib/types.ts`. */
export interface CiqualFood extends NutrientValues {
  /** Code CIQUAL — stable d'une version de la table à l'autre, c'est lui que retient le journal */
  code: string;
  name: string;
  fiberDg: number | null;
}

export interface CiqualTable {
  source: string;
  licence: string;
  version: string;
  foods: CiqualRow[];
}

export function toCiqualFood([code, name, kcal, proteinDg, carbsDg, fatDg, fiberDg]: CiqualRow): CiqualFood {
  return { code, name, kcal, proteinDg, carbsDg, fatDg, fiberDg };
}

let loading: Promise<CiqualFood[]> | null = null;

/**
 * Charge la table à la demande. L'import dynamique en fait un fichier à part
 * au build : ni le hub ni les autres modules n'en portent le poids, et il
 * n'est téléchargé qu'une fois, à la première ouverture d'une recherche.
 */
export function loadCiqual(): Promise<CiqualFood[]> {
  loading ??= import('../data/ciqual.json')
    .then((m) => (m.default as CiqualTable).foods.map(toCiqualFood))
    .catch((error: unknown) => {
      // Un échec (réseau coupé au premier chargement) ne doit pas rester en
      // cache : la tentative suivante doit pouvoir réussir.
      loading = null;
      throw error;
    });
  return loading;
}

/** Mention exigée par la Licence Ouverte, à afficher dans le module (étude §4). */
export const CIQUAL_CREDIT = 'Ciqual 2025, ANSES';
