import type { ComponentType, ReactNode } from 'react';

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

/** Une dépense (ou une entrée) qu'un module demande d'enregistrer au budget. */
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
  /** Montant, en centimes, toujours positif : c'est `direction` qui dit le sens. */
  amountCents: number;
  /**
   * Une sortie d'argent (par défaut) ou une ENTRÉE — un paiement reçu d'un
   * client de Projets (depuis le 2026-10-06). Le service garde son nom :
   * Courses n'a rien à changer.
   */
  direction?: 'expense' | 'income';
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
  /** Avec une heure : la durée, en minutes ; 30 sans elle (depuis le 28/09/2026). */
  duration?: number;
  /** La marque se coche depuis le calendrier (`CalendarSource.toggleMark`) */
  checkable?: boolean;
  /**
   * La marque se déplace et s'étire depuis le calendrier (`CalendarSource.moveMark`,
   * depuis le 28/09/2026 : les tâches de Polaris, glissées dans Éclipse).
   */
  movable?: boolean;
  /** Cochée : faite */
  done?: boolean;
  /**
   * Prévisionnelle : ce qui arrivera si rien ne change (les prochaines
   * occurrences d'une tâche répétée), dessinée en retrait — jamais cochable.
   */
  tentative?: boolean;
  /**
   * De quoi ouvrir la chose elle-même dans son module (`onOpenModule(source.id,
   * link)`) — « task:<id> » pour une tâche de Polaris. Absent : rien à ouvrir.
   */
  link?: string;
}

/** Où une marque a été glissée : son jour, son heure (`null` : la journée entière). */
export interface MarkMove {
  day: string;
  time: string | null;
  /** Seulement quand on a étiré la marque : sa nouvelle durée, en minutes */
  duration?: number;
}

/** Un créneau du calendrier, pour y créer quelque chose : son jour, son heure (`null` : la journée), sa durée. */
export interface MarkSlot {
  day: string;
  time: string | null;
  /** Avec une heure, en minutes */
  duration?: number;
  /** Ce qui était déjà tapé dans la fenêtre de l'événement avant de basculer */
  title?: string;
}

/**
 * La fenêtre d'un module, prêtée au calendrier (06/10/2026) : modifier une
 * marque sans quitter le calendrier, ou créer une chose du module sur un
 * créneau. Le module la dessine et écrit avec ses propres règles ; le
 * calendrier ne fait que l'ouvrir et relire le calque à la fermeture.
 */
export interface MarkEditorProps {
  /** Ce qu'on modifie : le `link` d'une marque. Absent : on crée, sur `slot`. */
  link?: string;
  slot?: MarkSlot;
  /** Placé en haut de la fenêtre (la bascule « Événement / Tâche » du calendrier) */
  header?: ReactNode;
  /** `changed` : quelque chose a été écrit, le calque est à relire. */
  onClose: (changed: boolean) => void;
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
  /**
   * Déplacer ou étirer une marque `movable`. Comme pour cocher, c'est le
   * module qui écrit, avec ses règles ; il rejette si le geste n'a pas de sens
   * chez lui, et la marque revient alors à sa place.
   */
  moveMark?(markId: string, to: MarkMove): Promise<void>;
  /**
   * La fenêtre du module, ouverte par-dessus le calendrier pour modifier une
   * marque qui a un `link`, ou créer sur un créneau (depuis le 06/10/2026,
   * les tâches). Sans elle, toucher une marque ouvre son simple résumé.
   */
  Editor?: ComponentType<MarkEditorProps>;
  /** Le nom de ce qu'on crée depuis un créneau (« Tâche ») ; absent : rien ne se crée depuis le calendrier. */
  createLabel?: string;
}

/**
 * Une action d'Objectifs qu'un autre module peut cocher (Sport, 08/10/2026,
 * docs/etude-sport.md §6.1, §18) : « Sortie course » de « Courir un marathon ».
 */
export interface GoalActionChoice {
  actionId: string;
  goalTitle: string;
  actionTitle: string;
  /** L'unité de la quantité de l'action (« km », « min ») ; vide si sans objet. */
  unit: string;
  /** Le jour où l'objectif a été créé : on ne coche rien avant. */
  since: string;
}

/** Une coche qu'un module demande à Objectifs, tenue par lui. */
export interface CheckinRequest {
  /**
   * Référence stable, préfixée par le module (« sport:jour:2026-10-07 ») :
   * c'est elle qui rend la coche rejouable sans doublon, modifiable et
   * retirable. Une seule coche par référence.
   */
  ref: string;
  actionId: string;
  /** AAAA-MM-JJ */
  day: string;
  /** La quantité, dans l'unité de l'action ; null si sans objet. */
  value: number | null;
  note: string;
}

/** Une coche posée par un module, telle qu'Objectifs la garde. */
export interface RecordedCheckin {
  ref: string;
  actionId: string | null;
  day: string;
  value: number | null;
  note: string;
}

export interface CheckinService {
  /** Les actions qu'on peut cocher : celles des objectifs en cours, hors relevés (une pesée n'est pas une sortie). */
  actions(): Promise<GoalActionChoice[]>;
  /**
   * Pose la coche, ou la met à jour si sa référence existe déjà. `taken` :
   * l'action est déjà cochée ce jour-là à la main — Objectifs n'y touche pas,
   * une coche faite par Jules n'est jamais réécrite par un autre module.
   */
  record(request: CheckinRequest): Promise<'recorded' | 'taken'>;
  /** Retire la coche portant cette référence ; sans effet si elle n'existe pas. */
  remove(ref: string): Promise<void>;
  /** Les coches dont la référence commence par `prefix`. */
  list(prefix: string): Promise<RecordedCheckin[]>;
}

/** Tout ce que les modules peuvent se rendre les uns aux autres. */
export interface AtlasServices {
  /** Fourni par le module budget (Astra). */
  expenses?: ExpenseService;
  /** Fourni par le module objectifs : cocher une action depuis un autre module (Sport). */
  checkins?: CheckinService;
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
