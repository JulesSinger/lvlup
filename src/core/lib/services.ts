/**
 * Les services qu'un module rend aux autres — le seul moyen, pour un
 * module, d'agir chez un autre sans l'importer (`conventions.test.ts`
 * l'interdit). Né le 26/09/2026 pour le lien Comète → Astra
 * (docs/etude-courses.md §18).
 *
 * Le principe est celui de `SettingsSection` ou `LandingPreview` : un module
 * **déclare** ce qu'il fournit dans sa fiche (`AtlasModule.provides`), le
 * socle rassemble ces déclarations (`collectServices`) et les passe à
 * l'écran de chaque module (`ModuleScreenProps.services`). Le socle ne
 * connaît que la forme du contrat, jamais son implémentation ; un module qui
 * s'en sert doit toujours supporter son absence (module retiré du registre).
 */

/** Une dépense qu'un module demande d'enregistrer au budget. */
export interface ExpenseRequest {
  /**
   * Référence stable, choisie par le module demandeur et préfixée par son
   * nom (« comete:course:12 ») : c'est elle qui rend l'enregistrement
   * rejouable sans doublon, et qui permet de retirer la dépense plus tard.
   * Jamais un identifiant de base, qu'une restauration de sauvegarde change.
   */
  ref: string;
  /** Jour de la dépense (AAAA-MM-JJ) */
  day: string;
  label: string;
  /** Montant dépensé, en centimes, positif */
  amountCents: number;
  /** Catégorie souhaitée, par son nom ; « à classer » si le budget ne la connaît pas */
  categoryName: string;
  note?: string;
}

export interface ExpenseService {
  /** Enregistre la dépense ; sans effet si `ref` l'est déjà. */
  record(request: ExpenseRequest): Promise<void>;
  /** Retire la dépense portant cette référence ; sans effet si elle n'existe pas. */
  remove(ref: string): Promise<void>;
  /** Parmi ces références, celles qui ont une dépense enregistrée. */
  recorded(refs: readonly string[]): Promise<Set<string>>;
}

/** Tout ce que les modules peuvent se rendre les uns aux autres. */
export interface AtlasServices {
  /** Fourni par le module budget (Astra). */
  expenses?: ExpenseService;
}

/**
 * Rassemble les services déclarés par les modules du registre. Deux modules
 * qui fourniraient le même service seraient une erreur de conception : le
 * premier déclaré l'emporte, et le test du socle le vérifie.
 */
export function collectServices(modules: readonly { provides?: Partial<AtlasServices> }[]): AtlasServices {
  const services: AtlasServices = {};
  for (const module of modules) {
    for (const [name, service] of Object.entries(module.provides ?? {})) {
      const key = name as keyof AtlasServices;
      if (service && !services[key]) services[key] = service as never;
    }
  }
  return services;
}
