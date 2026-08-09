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
  /**
   * Retrouve la section du module dans une sauvegarde antérieure au format
   * versionné, où tout vivait à plat. C'est au module de savoir lire son
   * ancien format : le socle ignore le nom de ses champs.
   *
   * Rend `null` si le fichier ne contient rien pour ce module.
   */
  fromLegacyBackup?(raw: Record<string, unknown>): unknown | null;
}
