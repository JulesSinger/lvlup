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

/**
 * Une marque qu'un module pose sur un jour du calendrier (Éclipse, étape 5,
 * docs/etude-calendrier.md §6) : « ✓ Course 8 km », « 12 cartes à réviser ».
 * Sur la journée entière, ou à une heure ; le calendrier l'affiche, il ne la
 * possède pas — même cochable, c'est le module qui écrit.
 */
export interface CalendarMark {
  /** Unique dans sa source, stable d'un chargement à l'autre */
  id: string;
  /** AAAA-MM-JJ */
  day: string;
  title: string;
  /** Le détail, montré au survol */
  detail?: string;
  /**
   * Une heure (« HH:MM », locale) : la marque se place alors dans la grille
   * horaire plutôt que dans la bande des journées entières (depuis le
   * 28/09/2026, pour les tâches de Polaris qui ont une heure).
   */
  time?: string;
  /** La marque se coche depuis le calendrier (`CalendarSource.toggleMark`) */
  checkable?: boolean;
  /** Cochée : faite */
  done?: boolean;
  /**
   * De quoi ouvrir la chose elle-même dans son module (`onOpenModule(source.id,
   * link)`) — « task:<id> » pour une tâche de Polaris. Absent : rien à ouvrir.
   */
  link?: string;
}

/**
 * Un calque du calendrier : ce qu'un module sait des jours, entre deux
 * dates. Le module qui le déclare le calcule depuis ses propres données, à
 * chaque demande — rien n'est copié chez le calendrier.
 */
export interface CalendarSource {
  /** Le nom technique du module (sert de clé au réglage « afficher ») */
  id: string;
  /** Le nom affiché du calque */
  label: string;
  /** Couleur des marques ; celle du module d'ordinaire */
  color: string;
  /** Affiché tant que l'utilisateur n'a rien choisi */
  defaultVisible: boolean;
  /** Les marques des jours `from` à `to`, inclus */
  marksBetween(from: string, to: string): Promise<CalendarMark[]>;
  /**
   * Cocher ou décocher une marque `checkable` — le premier calque qui écrit
   * (Polaris, 28/09/2026). C'est le module qui décide de ce que « cocher »
   * veut dire chez lui ; le calendrier ne fait que transmettre le geste.
   */
  toggleMark?(markId: string): Promise<void>;
}

/** Tout ce que les modules peuvent se rendre les uns aux autres. */
export interface AtlasServices {
  /** Fourni par le module budget (Astra). */
  expenses?: ExpenseService;
  /** Fournis par tout module qui a quelque chose à montrer dans le calendrier — plusieurs à la fois. */
  calendarSources?: CalendarSource[];
}

/**
 * Rassemble les services déclarés par les modules du registre.
 *
 * Deux sortes de services : ceux qu'un seul module rend (`expenses`) — deux
 * fournisseurs seraient une erreur de conception, le premier déclaré
 * l'emporte — et ceux que plusieurs modules **ajoutent** les uns aux autres,
 * déclarés en tableau (`calendarSources`) : ils s'additionnent, dans l'ordre
 * du registre.
 */
export function collectServices(modules: readonly { provides?: Partial<AtlasServices> }[]): AtlasServices {
  const services: AtlasServices = {};
  const bag = services as Record<string, unknown>;
  for (const module of modules) {
    for (const [name, service] of Object.entries(module.provides ?? {})) {
      if (!service) continue;
      if (Array.isArray(service)) bag[name] = [...((bag[name] as unknown[] | undefined) ?? []), ...service];
      else if (!bag[name]) bag[name] = service;
    }
  }
  return services;
}
