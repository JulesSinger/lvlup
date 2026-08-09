import type { AppUser } from '../lib/types';

/** Réglages du compte, synchronisés entre appareils. */
export interface Settings {
  /** Cible de PP à atteindre chaque jour */
  dailyGoal: number;
  /** Rappel quotidien par notification */
  reminderEnabled: boolean;
  /** Heure locale du rappel, format « HH:MM » */
  reminderTime: string;
  /**
   * Décalage entre UTC et l'heure locale, en minutes. Réécrit à chaque
   * ouverture de l'app : c'est ce qui permet au serveur d'envoyer le rappel
   * à la bonne heure même après un changement d'heure ou un déplacement.
   */
  tzOffset: number;
}

export const DEFAULT_SETTINGS: Settings = {
  dailyGoal: 40,
  reminderEnabled: false,
  reminderTime: '20:00',
  tzOffset: 0,
};

/** Un navigateur abonné aux notifications (iPhone, Mac, Android…). */
export interface PushDevice {
  id: string;
  endpoint: string;
  label: string;
  createdAt: string;
}

export interface PushDeviceInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  label: string;
}

/** État de la fonction d'envoi, pour diagnostiquer sans deviner. */
export interface PushDiagnostic {
  reachable: boolean;
  version: string;
  vapidPublic: boolean;
  vapidPrivate: boolean;
  vapidSubject: boolean;
  /** Début de la clé publique côté serveur, à comparer avec celle du build */
  serverKeyPrefix: string;
}

/** Niveaux d'objectif quotidien proposés (à la Duolingo). */
export const DAILY_GOAL_LEVELS: { label: string; pp: number; hint: string }[] = [
  { label: 'Tranquille', pp: 20, hint: 'une action, ou deux petits pas' },
  { label: 'Régulier', pp: 40, hint: 'deux à trois actions' },
  { label: 'Sérieux', pp: 70, hint: 'une vraie session quotidienne' },
  { label: 'Intense', pp: 120, hint: 'plusieurs objectifs chaque jour' },
];

/**
 * Contrat du socle : ce qui ne dépend d'aucun module.
 *
 * Comptes, réglages et notifications valent pour toute l'application. Les
 * données d'un domaine — objectifs, budget — relèvent du contrat de leur
 * module, pas de celui-ci. C'est cette séparation qui permet d'ajouter un
 * module sans faire grossir les implémentations existantes.
 */
export interface CoreStore {
  /** true si les données sont sur un serveur (comptes réels, multi-appareils) */
  readonly isRemote: boolean;

  // --- Authentification ---
  getUser(): Promise<AppUser | null>;
  /** Notifie à chaque connexion/déconnexion. Renvoie une fonction de désabonnement. */
  onUserChange(callback: (user: AppUser | null) => void): () => void;
  signUp(email: string, password: string): Promise<{ needsConfirmation: boolean }>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  /** Envoie le mail de réinitialisation de mot de passe. */
  resetPassword(email: string): Promise<void>;
  /** Définit un nouveau mot de passe pour la session en cours. */
  updatePassword(password: string): Promise<void>;
  /**
   * Prévient quand l'utilisateur arrive par un lien de récupération : l'app
   * doit alors lui faire choisir un nouveau mot de passe avant toute chose.
   */
  onPasswordRecovery(callback: () => void): () => void;

  // --- Réglages ---
  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<void>;

  // --- Rappels push ---
  listPushDevices(): Promise<PushDevice[]>;
  /** Enregistre (ou met à jour) l'abonnement de ce navigateur. */
  savePushDevice(input: PushDeviceInput): Promise<void>;
  /** Retire un abonnement, par endpoint. */
  removePushDevice(endpoint: string): Promise<void>;
  /** Déclenche un envoi immédiat vers les appareils de ce compte. */
  sendTestPush(): Promise<{ sent: number; devices: number }>;
  /** Interroge la fonction d'envoi : est-elle là, et bien configurée ? */
  pingPushFunction(): Promise<PushDiagnostic>;
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
