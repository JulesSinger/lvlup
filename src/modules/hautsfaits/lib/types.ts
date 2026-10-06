/**
 * Les types du module Hauts faits (docs/etude-hauts-faits.md §3 et §8).
 *
 * Les listes énumérées sont des tableaux `as const` parce que la base les
 * répète dans ses contraintes CHECK : `schema.test.ts` compare les deux
 * (CLAUDE.md §5).
 */
import type { PreparedImage } from '../../../core/lib/images';

/**
 * Catégories fixes pour le moment (décision de Jules, 29/09/2026) : une
 * couleur et un emoji chacune, cohérents d'un haut fait à l'autre. Des
 * catégories à soi, comme dans Budget, pourront venir plus tard.
 */
export const FEAT_CATEGORIES = ['etudes', 'sport', 'voyage', 'chezsoi', 'travail', 'proches', 'creation', 'autre'] as const;
export type FeatCategory = (typeof FEAT_CATEGORIES)[number];

/**
 * Ce qu'on sait d'une date : le jour exact du semi, le mois d'un départ, ou
 * seulement l'année du brevet. La date est rangée au premier jour de la
 * période qu'elle décrit (1er janvier pour une année, 1er du mois pour un
 * mois) : le tri marche tel quel, et l'affichage ne dit que ce qu'on sait.
 */
export const DATE_PRECISIONS = ['day', 'month', 'year'] as const;
export type DatePrecision = (typeof DATE_PRECISIONS)[number];

export const FEAT_TITLE_MAX = 200;
export const FEAT_HIGHLIGHT_MAX = 60;
export const FEAT_PLACE_MAX = 120;
export const FEAT_PEOPLE_MAX = 200;
export const FEAT_STORY_MAX = 4000;

export interface Feat {
  /** Choisi par l'application (uuid), pour une file hors ligne future sans migration. */
  id: string;
  title: string;
  category: FeatCategory;
  /** AAAA-MM-JJ, premier jour de la période décrite par `datePrecision`. */
  dateStart: string;
  datePrecision: DatePrecision;
  /** Une période (« six mois à Madrid ») : sa fin, avec sa propre précision. */
  dateEnd: string | null;
  dateEndPrecision: DatePrecision | null;
  /** Un haut fait majeur prend une grande carte, avec sa photo, dans la frise. */
  major: boolean;
  /** Le chiffre clé, en médaillon : « 1 h 52 min », « mention Bien ». */
  highlight: string;
  place: string;
  people: string;
  story: string;
  createdAt: string;
  updatedAt: string;
}

export type FeatInput = Pick<Feat, 'title' | 'category' | 'dateStart' | 'datePrecision'> &
  Partial<Pick<Feat, 'dateEnd' | 'dateEndPrecision' | 'major' | 'highlight' | 'place' | 'people' | 'story'>>;

export type FeatPatch = Partial<Omit<Feat, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * Réglages du module, en base plutôt que sur l'appareil : la date de
 * naissance est une donnée du compte (âge, « une vie en semaines »).
 */
export interface HautsFaitsSettings {
  /** AAAA-MM-JJ, ou `null` : sans elle, ni âge ni vie en semaines. */
  birthDate: string | null;
  /** Le rappel « Ce jour-là », coupé par défaut. */
  onThisDayReminder: boolean;
}

export const DEFAULT_HAUTSFAITS_SETTINGS: HautsFaitsSettings = { birthDate: null, onThisDayReminder: false };

/** Au plus 12 photos par haut fait (décision du 29/09/2026). */
export const PHOTOS_MAX = 12;
/** Le grand côté de la version affichée en grand, puis de la miniature (frise, galerie). */
export const PHOTO_FULL_SIZE = 2048;
export const PHOTO_THUMB_SIZE = 720;

/**
 * Une photo d'un haut fait. Les images elles-mêmes vivent à part (IndexedDB
 * en local, le stockage de fichiers de Supabase avec un compte) : cette ligne
 * dit où les trouver. La couverture d'un haut fait est sa photo en première
 * position.
 */
export interface FeatPhoto {
  id: string;
  featId: string;
  path: string;
  thumbPath: string;
  /** Dimensions de la grande version. */
  width: number;
  height: number;
  /** Poids des deux versions, pour dire la place occupée. */
  bytes: number;
  /** Date de prise de vue lue dans la photo (AAAA-MM-JJTHH:MM:SS, heure locale), ou `null`. */
  takenAt: string | null;
  position: number;
  createdAt: string;
}

/** Une photo réduite dans le navigateur, prête à être envoyée — la forme commune du socle. */
export type PreparedPhoto = PreparedImage;

export type PhotoSize = 'thumb' | 'full';
