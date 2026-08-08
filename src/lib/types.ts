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
export type TierKind = 'jalon' | 'compte' | 'cumul' | 'serie' | 'performance' | 'mesure';

/** Sens de progression, pour les performances et les mesures. */
export type Direction = 'hausse' | 'baisse';

/** Cible absolue (« atteindre 75 kg ») ou relative au premier relevé. */
export type TargetMode = 'absolu' | 'delta';

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
}

export interface AppUser {
  id: string;
  email: string;
  /** true quand les données vivent seulement dans ce navigateur */
  isLocal: boolean;
}
