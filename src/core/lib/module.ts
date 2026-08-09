import type { ComponentType } from 'react';
import type { Settings } from '../data/coreStore';
import type { AppUser } from './types';

/**
 * Ce qu'un module déclare au hub.
 *
 * Le socle ne connaît des modules que cette forme : il ne sait rien de leurs
 * écrans, de leurs tables ni de leurs types. Ajouter un module revient donc à
 * créer un dossier, exporter une déclaration, et ajouter une ligne au registre
 * — jamais à modifier un fichier du socle.
 */

/** La part d'un module dans une sauvegarde. Le socle ne l'ouvre jamais. */
export interface ModuleDataStore {
  exportData(): Promise<unknown>;
  importData(data: unknown): Promise<void>;
}

/**
 * Ce que le hub passe à l'écran racine d'un module.
 *
 * Le module ne connaît jamais Supabase ni les autres modules : il reçoit un
 * utilisateur déjà authentifié, déclenche les réglages et l'erreur globale
 * par callback, et sait quand revenir à la liste des modules.
 */
export interface ModuleScreenProps {
  user: AppUser;
  /** Réglages partagés (rythme quotidien, rappel…), en lecture. */
  settings: Settings;
  /** Erreur affichée par le hub — la plomberie d'erreurs reste au socle. */
  error: string;
  /** Signale une erreur au hub, pour qu'elle s'affiche au même endroit que les autres. */
  onError: (message: string) => void;
  /** Ouvre le panneau de réglages, porté par le hub. */
  onOpenSettings: () => void;
  /** Revient à l'écran de choix du module. */
  onBackToHub: () => void;
  /**
   * Incrémenté après une restauration de sauvegarde : c'est le signal pour le
   * module de relire ses propres données, que le hub ne connaît pas.
   */
  reloadToken: number;
}

/** Ce qu'un module ajoute au panneau de réglages, sous son propre intitulé. */
export interface ModuleSettingsProps {
  user: AppUser | null;
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}

export interface AtlasModule {
  /**
   * Nom technique : dossier, préfixe des tables et des classes CSS, clé dans
   * la sauvegarde. Il ne change jamais pour une raison de vocabulaire.
   */
  id: string;
  /** Nom affiché — la marque. Le seul champ à toucher si elle évolue. */
  label: string;
  emoji: string;
  data: ModuleDataStore;
  /** Écran racine du module. Le hub le rend sans rien savoir de son contenu. */
  Screen: ComponentType<ModuleScreenProps>;
  /** Section optionnelle ajoutée au panneau de réglages, sous `label`. */
  SettingsSection?: ComponentType<ModuleSettingsProps>;
  /**
   * Retrouve la section du module dans une sauvegarde antérieure au format
   * versionné, où tout vivait à plat. C'est au module de savoir lire son
   * ancien format : le socle ignore le nom de ses champs.
   *
   * Rend `null` si le fichier ne contient rien pour ce module.
   */
  fromLegacyBackup?(raw: Record<string, unknown>): unknown | null;
}
