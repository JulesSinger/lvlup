import type { Feat, FeatInput, FeatPatch, HautsFaitsSettings } from '../lib/types';

/**
 * La part du module dans une sauvegarde. Le socle n'en connaît pas la
 * forme : il se contente d'assembler les sections que les modules lui
 * donnent (voir `core/data/backup.ts`).
 */
export interface HautsFaitsBackup {
  feats: Feat[];
  settings?: HautsFaitsSettings;
}

/**
 * Contrat de stockage du module Hauts faits.
 *
 * Étape 1 : les hauts faits et les réglages. Les photos arrivent à l'étape 4
 * (docs/etude-hauts-faits.md §5), avec leur propre table et le stockage de
 * fichiers.
 */
export interface HautsFaitsStore {
  listFeats(): Promise<Feat[]>;
  /**
   * `id` est choisi par l'application avant le premier envoi : créer deux
   * fois le même haut fait n'en écrit qu'un et rend le premier.
   */
  createFeat(input: FeatInput, id?: string): Promise<Feat>;
  updateFeat(id: string, patch: FeatPatch): Promise<void>;
  deleteFeat(id: string): Promise<void>;

  getSettings(): Promise<HautsFaitsSettings>;
  saveSettings(patch: Partial<HautsFaitsSettings>): Promise<void>;

  /** Sa section de la sauvegarde — le socle ne fait que l'assembler. */
  exportData(): Promise<HautsFaitsBackup>;
  importData(data: HautsFaitsBackup): Promise<void>;
}
