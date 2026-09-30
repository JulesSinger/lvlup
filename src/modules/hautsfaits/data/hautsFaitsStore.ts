import type { Feat, FeatInput, FeatPatch, FeatPhoto, HautsFaitsSettings, PhotoSize, PreparedPhoto } from '../lib/types';

/**
 * La part du module dans une sauvegarde. Le socle n'en connaît pas la
 * forme : il se contente d'assembler les sections que les modules lui
 * donnent (voir `core/data/backup.ts`).
 */
export interface HautsFaitsBackup {
  feats: Feat[];
  settings?: HautsFaitsSettings;
  /**
   * La liste des photos, PAS leur contenu : des centaines de Mo en base64
   * feraient un fichier de sauvegarde inutilisable (étude §5.6). Restaurée
   * sur le même compte ou le même appareil, chaque ligne retrouve son image,
   * restée dans le stockage ; ailleurs, la photo s'affiche comme manquante.
   */
  photos?: FeatPhoto[];
}

/**
 * Contrat de stockage du module Hauts faits.
 *
 * Les hauts faits, les réglages, et depuis l'étape 4 les photos
 * (docs/etude-hauts-faits.md §5) : une ligne qui décrit chaque photo, les
 * images rangées à part — IndexedDB en local, le stockage de fichiers de
 * Supabase avec un compte.
 */
export interface HautsFaitsStore {
  listFeats(): Promise<Feat[]>;
  /**
   * `id` est choisi par l'application avant le premier envoi : créer deux
   * fois le même haut fait n'en écrit qu'un et rend le premier.
   */
  createFeat(input: FeatInput, id?: string): Promise<Feat>;
  updateFeat(id: string, patch: FeatPatch): Promise<void>;
  /** Emporte ses photos, fichiers compris. */
  deleteFeat(id: string): Promise<void>;

  listPhotos(): Promise<FeatPhoto[]>;
  /**
   * Range les images PUIS écrit la ligne : une coupure entre les deux laisse
   * au pire un fichier sans ligne (de la place perdue), jamais une ligne qui
   * pointe vers une image absente. Rejouable avec le même `id`.
   */
  addPhoto(featId: string, photo: PreparedPhoto, position: number, id?: string): Promise<FeatPhoto>;
  /** L'image elle-même, en grand ou en miniature. */
  photoBlob(photo: FeatPhoto, size: PhotoSize): Promise<Blob>;
  setPhotoPositions(positions: { id: string; position: number }[]): Promise<void>;
  /** Retire la ligne, puis les fichiers. */
  removePhoto(photo: FeatPhoto): Promise<void>;

  getSettings(): Promise<HautsFaitsSettings>;
  saveSettings(patch: Partial<HautsFaitsSettings>): Promise<void>;

  /** Sa section de la sauvegarde — le socle ne fait que l'assembler. */
  exportData(): Promise<HautsFaitsBackup>;
  importData(data: HautsFaitsBackup): Promise<void>;
}
