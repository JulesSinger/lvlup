import type { RankId } from './ranks';

/**
 * Nature d'un palier — c'est elle qui décide de la façon de compter.
 *
 * La distinction n'est pas cosmétique : « Courir 10 km » et « Courir 100 km »
 * s'écrivent pareil et ne se comptent pas du tout de la même façon. Le premier
 * est une performance d'une seule séance, le second un cumul. Un modèle unique
 * validerait le premier au bout de deux sorties de 5 km — et valider un palier
 * trop tôt dévalorise la cérémonie, qui est le cœur émotionnel de l'app.
 */
/**
 * Les six natures de palier.
 *
 * Déclarées comme un tableau et non comme une simple union : un test compare
 * cette liste au CHECK de la base. Sans lui, les deux avaient silencieusement
 * divergé — `compte` existait côté TypeScript et manquait côté SQL, si bien
 * que toute création d'objectif comportant un palier en jours était refusée
 * par Postgres, alors que le code compilait et que tous les tests passaient.
 */
export const TIER_KINDS = ['jalon', 'compte', 'cumul', 'serie', 'performance', 'mesure'] as const;
export type TierKind = (typeof TIER_KINDS)[number];

/** Sens de progression, pour les performances et les mesures. */
export const DIRECTIONS = ['hausse', 'baisse'] as const;
export type Direction = (typeof DIRECTIONS)[number];

/** Cible absolue (« atteindre 75 kg ») ou relative au premier relevé. */
export const TARGET_MODES = ['absolu', 'delta'] as const;
export type TargetMode = (typeof TARGET_MODES)[number];

export interface Tier {
  id: string;
  goalId: string;
  title: string;
  rank: RankId;
  /** Position dans la liste, 0 = premier palier */
  position: number;
  /** Date ISO de validation, null si le palier n'est pas encore atteint */
  completedAt: string | null;
  createdAt: string;

  // --- Comptage (un « jalon » ignore tout ce qui suit) ---
  kind: TierKind;
  /** Cible chiffrée. Négative pour une mesure en delta (« perdre 5 kg » = -5). */
  target: number | null;
  /** Unité affichée : 'jours', 'km', 'kg'… vide si sans objet. */
  unit: string;
  direction: Direction;
  mode: TargetMode;
  /** Actions qui alimentent ce palier. Vide = toutes celles de l'objectif. */
  sources: string[];
}

/** Valeurs de comptage d'un palier ordinaire : coché à la main. */
export const JALON: Pick<Tier, 'kind' | 'target' | 'unit' | 'direction' | 'mode' | 'sources'> = {
  kind: 'jalon',
  target: null,
  unit: '',
  direction: 'hausse',
  mode: 'absolu',
  sources: [],
};

export interface Goal {
  id: string;
  title: string;
  description: string;
  emoji: string;
  position: number;
  archived: boolean;
  createdAt: string;
  tiers: Tier[];
}

export interface GoalInput {
  title: string;
  description: string;
  emoji: string;
}

export interface TierInput {
  title: string;
  rank: RankId;
  kind?: TierKind;
  target?: number | null;
  unit?: string;
  direction?: Direction;
  mode?: TargetMode;
  sources?: string[];
}

/**
 * Une action du quotidien rattachée à un objectif : la petite chose concrète
 * qu'on fait pour le faire avancer. Chaque objectif naît avec deux actions
 * génériques (« Un vrai effort » / « Un petit pas ») que l'on renomme ensuite.
 */
export interface Action {
  id: string;
  goalId: string;
  title: string;
  /** Points rapportés par une réalisation */
  pp: number;
  position: number;
  archived: boolean;
  createdAt: string;
  /** Unité de la quantité relevée : 'km', 'min', 'kg'… vide si sans objet. */
  unit: string;
  /**
   * La valeur habituelle. C'est elle qui préserve le geste unique : toucher
   * la pastille enregistre cette quantité, sans ouvrir de clavier.
   */
  defaultValue: number | null;
  /**
   * Un relevé (se peser) plutôt qu'un effort. Il entretient la série mais
   * rapporte peu de points — sinon on farmerait des PP sur une balance.
   */
  isMeasure: boolean;
}

export interface ActionInput {
  title: string;
  pp: number;
  unit?: string;
  defaultValue?: number | null;
  isMeasure?: boolean;
}

/**
 * Un gel acheté avec des PP.
 *
 * C'est un **événement journalisé**, pas un compteur : la réserve de gels
 * reste recalculée depuis l'historique, comme le streak lui-même. Stocker un
 * solde qu'on incrémente et décrémente aurait introduit exactement la
 * désynchronisation que ce projet évite partout — un compteur qui dérive de la
 * réalité sans que rien ne le signale.
 *
 * Le jour de l'achat compte : un gel acheté un mardi ne protège pas le lundi
 * d'avant.
 */
export interface FreezePurchase {
  id: string;
  /** Jour de l'achat (YYYY-MM-DD) */
  day: string;
  /** PP dépensés — figés à l'achat, comme les PP d'une réalisation. */
  cost: number;
  createdAt: string;
}

/**
 * Prix d'un gel, en PP de la semaine en cours.
 *
 * L'ordre de grandeur : l'objectif du jour par défaut est de 40 PP, soit 280
 * pour une semaine parfaite. Une bonne semaine achète donc un gel, une semaine
 * moyenne aucun — et sept jours d'affilée en donnent déjà un gratuitement.
 * L'achat sert la semaine active mais irrégulière, ce qui est exactement la
 * situation où un gel a du sens.
 */
export const FREEZE_COST = 200;

/** Les deux actions créées d'office avec tout nouvel objectif. */
export const DEFAULT_ACTIONS: ActionInput[] = [
  { title: 'Un vrai effort', pp: 15 },
  { title: 'Un petit pas', pp: 5 },
];

/** Barème proposé dans l'éditeur d'action. */
export const ACTION_PP_CHOICES = [5, 10, 15, 20, 30];

/**
 * Une réalisation : « aujourd'hui, j'ai fait cette action ».
 * Une seule par action et par jour ; nourrit les PP, le streak et le journal.
 *
 * `actionId` est nul pour les check-ins d'avant les actions : ils valent
 * toujours leurs 10 PP d'origine et restent dans l'historique.
 */
export interface Checkin {
  id: string;
  goalId: string;
  actionId: string | null;
  /** PP figés au moment de la réalisation — renommer une action ne réécrit pas l'histoire */
  pp: number;
  /** Jour local au format YYYY-MM-DD */
  day: string;
  /** Note libre optionnelle : « 8 km ce matin, dur mais fait » */
  note: string;
  createdAt: string;
  /** Quantité relevée ce jour-là : 8 (km), 30 (min), 78.1 (kg). */
  value: number | null;
  /**
   * Titre d'un **geste ponctuel** — une réalisation sans action derrière.
   *
   * « J'ai regardé un tuto sur comment tenir un budget » : c'est un vrai pas
   * vers l'objectif, mais pas une habitude. Sans ça, les deux seules options
   * étaient de créer une action permanente qu'on ne cochera jamais plus, ce
   * qui pollue l'écran du soir pour toujours, ou de ne rien noter — et la
   * grille affiche alors une case vide un jour où on a vraiment avancé.
   *
   * `null` pour une réalisation ordinaire : c'est l'action qui la nomme. Ce
   * champ est aussi ce qui distingue un geste ponctuel d'une réalisation dont
   * l'action a été supprimée — la première ne compte jamais dans un palier,
   * la seconde garde ses droits acquis.
   */
  title: string | null;
}

/**
 * PP d'un geste ponctuel. Fixes, et volontairement modestes : dès qu'on peut
 * choisir, on peut farmer. Il rapporte ce que rapporte un petit pas.
 */
export const ONE_OFF_PP = 10;

// AppUser vit désormais dans le socle ; réexporté ici le temps que
// `src/data/` soit scindé (étape 3), pour ne rien casser en chemin.
export type { AppUser } from '../../../core/lib/types';
