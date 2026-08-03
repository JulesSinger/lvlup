import type { RankId } from './ranks';

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
}

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
}

export interface ActionInput {
  title: string;
  pp: number;
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
}

export interface AppUser {
  id: string;
  email: string;
  /** true quand les données vivent seulement dans ce navigateur */
  isLocal: boolean;
}
