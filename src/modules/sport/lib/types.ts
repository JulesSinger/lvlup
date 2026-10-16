/**
 * Les types du module Sport — la course à pied (docs/etude-sport.md §4, §7, §12).
 *
 * Distances en MÈTRES et durées en SECONDES, entières, comme les centimes de
 * Budget : jamais de flottant qu'une addition ferait dériver. L'allure
 * (secondes par kilomètre) n'est jamais rangée : elle se calcule depuis la
 * distance et la durée, et ne peut donc pas les contredire.
 *
 * Les listes `as const` ont leur pendant dans les contraintes CHECK de la
 * migration ; `schema.test.ts` compare les deux (CLAUDE.md §5).
 */

/** Les sortes de sortie : `autre` pour ce qui n'entre dans aucune case. */
export const RUN_KINDS = ['footing', 'fractionne', 'seuil', 'longue', 'allure', 'course', 'autre'] as const;
export type RunKind = (typeof RUN_KINDS)[number];

/** Les séances de course d'un plan : les sortes de sortie, sans `autre` — une séance prévue sait ce qu'elle est. */
export const RUNNING_SESSION_KINDS = ['footing', 'fractionne', 'seuil', 'longue', 'allure', 'course'] as const;
export type RunningSessionKind = (typeof RUNNING_SESSION_KINDS)[number];

/**
 * Les séances d'à côté (demande de Jules, 12/10/2026 : son coach programme
 * aussi du renforcement et du vélo). Elles ne comptent pas dans les
 * kilomètres de course, aucune sortie ne les fait : on les coche à la main
 * (`PlanSession.doneAt`). L'escalade s'y ajoute le 16/10/2026, puis le foot (un five en salle), demandes de Jules.
 */
export const CROSS_SESSION_KINDS = ['renfo', 'velo', 'escalade', 'foot'] as const;
export type CrossSessionKind = (typeof CROSS_SESSION_KINDS)[number];

/** Les séances qui n'ont pas de distance : une durée, et la consigne. */
export const hasDistance = (kind: SessionKind): boolean => kind !== 'renfo' && kind !== 'escalade' && kind !== 'foot';

export const SESSION_KINDS = [...RUNNING_SESSION_KINDS, ...CROSS_SESSION_KINDS] as const;

/** D'où vient une séance d'à côté (renfo, vélo, escalade, foot) (`sport_activities`, 12/10/2026) : Strava, ou la main. */
export const ACTIVITY_SOURCES = ['strava', 'manuel'] as const;
export type ActivitySource = (typeof ACTIVITY_SOURCES)[number];

/**
 * Une séance de renforcement ou de vélo faite, venue de Strava : montrée dans
 * le journal, jamais comptée dans les sorties de course. Elle coche la séance
 * du plan qu'elle a faite (`sessionId`).
 */
export interface Activity {
  id: string;
  startedAt: string;
  day: string;
  sport: CrossSessionKind;
  durationS: number;
  distanceM: number | null;
  elevationM: number | null;
  avgHr: number | null;
  maxHr: number | null;
  title: string;
  source: ActivitySource;
  sourceRef: string | null;
  sessionId: string | null;
  createdAt: string;
}
export type SessionKind = (typeof SESSION_KINDS)[number];

/** Une séance de course (faite par une sortie), ou d'à côté (cochée à la main). */
export const isRunningSession = (kind: SessionKind): kind is RunningSessionKind => (RUNNING_SESSION_KINDS as readonly string[]).includes(kind);

/** D'où vient une sortie (§3) : la main, le raccourci iPhone, l'archive Strava, un fichier. */
export const RUN_SOURCES = ['manuel', 'raccourci', 'strava', 'gpx', 'tcx', 'fit'] as const;
export type RunSource = (typeof RUN_SOURCES)[number];

export const PLAN_STATUSES = ['actif', 'termine', 'abandonne'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const RUN_TITLE_MAX = 120;
export const RUN_NOTE_MAX = 2000;
export const PLAN_TITLE_MAX = 120;
export const SESSION_TITLE_MAX = 120;
export const SESSION_INSTRUCTIONS_MAX = 1000;
/** 500 km : au-delà, c'est une faute de frappe (ou un fichier mal lu). */
export const RUN_DISTANCE_MAX_M = 500_000;
/** 72 heures. */
export const RUN_DURATION_MAX_S = 259_200;
export const SESSIONS_PER_WEEK_MIN = 2;
export const SESSIONS_PER_WEEK_MAX = 6;

export const MARATHON_M = 42_195;
export const HALF_MARATHON_M = 21_098;

/** Une sortie. */
export interface Run {
  id: string;
  /** Le départ, en ISO 8601. */
  startedAt: string;
  /** Le jour local de la sortie, `AAAA-MM-JJ` — celui de la montre, pas d'UTC. */
  day: string;
  distanceM: number;
  durationS: number;
  elevationM: number | null;
  avgHr: number | null;
  maxHr: number | null;
  kind: RunKind;
  /** Le ressenti, de 1 à 10. */
  effort: number | null;
  title: string;
  note: string;
  source: RunSource;
  /**
   * La référence de la source, unique par compte : une même sortie importée
   * deux fois n'existe qu'une fois. `null` pour une saisie à la main.
   */
  sourceRef: string | null;
  /** La séance du plan que cette sortie a faite. */
  sessionId: string | null;
  /** Les temps au kilomètre, en secondes, quand un fichier les donne. */
  splitsS: number[] | null;
  createdAt: string;
}

export interface RunInput {
  startedAt: string;
  day: string;
  distanceM: number;
  durationS: number;
  elevationM?: number | null;
  avgHr?: number | null;
  maxHr?: number | null;
  kind?: RunKind;
  effort?: number | null;
  title?: string;
  note?: string;
  source?: RunSource;
  sourceRef?: string | null;
  sessionId?: string | null;
  splitsS?: number[] | null;
}

export type RunPatch = Partial<Omit<RunInput, 'source' | 'sourceRef'>>;

/** Une sortie à importer d'un bloc (archive, fichier, raccourci) : sa référence est obligatoire. */
export type RunImport = RunInput & { id: string; sourceRef: string };

/** Un plan : la course visée et sa préparation (§4.3, §12). */
export interface Plan {
  id: string;
  title: string;
  raceDistanceM: number;
  raceDay: string;
  /** La date officielle n'est pas encore connue : le plan est construit sur une date provisoire. */
  raceDayConfirmed: boolean;
  /** Le temps espéré, facultatif. */
  targetS: number | null;
  /** Un temps de référence récent (un 10 km en 50 min), d'où viennent les allures. */
  referenceDistanceM: number | null;
  referenceS: number | null;
  sessionsPerWeek: number;
  startDay: string;
  status: PlanStatus;
  createdAt: string;
}

export interface PlanInput {
  title: string;
  raceDistanceM: number;
  raceDay: string;
  raceDayConfirmed?: boolean;
  targetS?: number | null;
  referenceDistanceM?: number | null;
  referenceS?: number | null;
  sessionsPerWeek?: number;
  startDay: string;
  status?: PlanStatus;
}

export type PlanPatch = Partial<PlanInput>;

/**
 * Une séance prévue. Elle appartient à une SEMAINE du plan (Jules n'a pas de
 * jours fixes, §12) ; son jour est facultatif.
 */
export interface PlanSession {
  id: string;
  planId: string;
  /** La semaine du plan, à partir de 1. */
  week: number;
  position: number;
  kind: SessionKind;
  title: string;
  distanceM: number | null;
  durationS: number | null;
  /** L'allure cible, une fourchette en secondes par kilomètre. */
  paceMinS: number | null;
  paceMaxS: number | null;
  /** La zone de fréquence cardiaque visée, de 1 à 5. */
  hrZone: number | null;
  instructions: string;
  day: string | null;
  /** Une séance d'à côté cochée : quand. Une séance de course est faite par une sortie, jamais par ce champ. */
  doneAt: string | null;
  createdAt: string;
}

export type PlanSessionDraft = Omit<PlanSession, 'createdAt' | 'doneAt'>;

export type PlanSessionPatch = Partial<Omit<PlanSession, 'id' | 'planId' | 'createdAt'>>;

/** Les réglages du compte : la fréquence cardiaque et le lien avec Objectifs. */
export interface SportSettings {
  hrMax: number | null;
  hrRest: number | null;
  /** L'action d'Objectifs que nourrit une sortie (étape 7). */
  objectifsActionId: string | null;
}

export const DEFAULT_SPORT_SETTINGS: SportSettings = { hrMax: null, hrRest: null, objectifsActionId: null };

/** Un jeton du raccourci iPhone. Le jeton lui-même n'est jamais rangé, seulement son empreinte. */
export interface ImportToken {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
}
