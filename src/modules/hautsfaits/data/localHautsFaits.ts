import { newId } from '../../../core/data/coreStore';
import { readRaw, writeRaw } from '../../../core/data/localSnapshot';
import {
  DEFAULT_HAUTSFAITS_SETTINGS,
  type Feat,
  type FeatInput,
  type FeatPatch,
  type FeatPhoto,
  type HautsFaitsSettings,
  type PhotoSize,
  type PreparedPhoto,
} from '../lib/types';
import type { BlobStore } from '../../../core/data/images/blobStore';
import { deviceBlobs } from './blobStore';
import type { HautsFaitsBackup, HautsFaitsStore } from './hautsFaitsStore';

const arrayOf = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

interface Snapshot {
  feats: Feat[];
  settings: HautsFaitsSettings;
  photos: FeatPhoto[];
}

/** Lecture des seules sections du module, sur le blob local partagé. */
function read(): Snapshot {
  const raw = readRaw();
  const settings = raw.hautsfaitsSettings as Partial<HautsFaitsSettings> | undefined;
  return {
    feats: arrayOf<Feat>(raw.hautsfaitsFeats),
    settings: { ...DEFAULT_HAUTSFAITS_SETTINGS, ...settings },
    photos: arrayOf<FeatPhoto>(raw.hautsfaitsPhotos),
  };
}

/** Écriture par fusion : les sections des autres modules sont préservées. */
function write(s: Snapshot) {
  writeRaw({ ...readRaw(), hautsfaitsFeats: s.feats, hautsfaitsSettings: s.settings, hautsfaitsPhotos: s.photos });
}

/** Une fin sans précision n'existe pas, et inversement — comme la contrainte côté base. */
function normalized(feat: Feat): Feat {
  if (feat.dateEnd === null) return { ...feat, dateEndPrecision: null };
  return { ...feat, dateEndPrecision: feat.dateEndPrecision ?? feat.datePrecision };
}

/**
 * Hauts faits stockés dans le navigateur, sans compte ni serveur. Les lignes
 * vont dans le blob local partagé ; les images, trop lourdes pour lui, dans
 * IndexedDB (en mémoire là où il n'existe pas : les tests sous Node).
 */
export class LocalHautsFaits implements HautsFaitsStore {
  private blobs: BlobStore;

  constructor(blobs?: BlobStore) {
    this.blobs = blobs ?? deviceBlobs();
  }

  async listFeats(): Promise<Feat[]> {
    return read().feats.slice();
  }

  async createFeat(input: FeatInput, id: string = newId()): Promise<Feat> {
    const s = read();
    const existing = s.feats.find((f) => f.id === id);
    if (existing) return existing; // rejoué : rien de plus
    const now = new Date().toISOString();
    const feat = normalized({
      id,
      title: input.title,
      category: input.category,
      dateStart: input.dateStart,
      datePrecision: input.datePrecision,
      dateEnd: input.dateEnd ?? null,
      dateEndPrecision: input.dateEndPrecision ?? null,
      major: input.major ?? false,
      highlight: input.highlight ?? '',
      place: input.place ?? '',
      people: input.people ?? '',
      story: input.story ?? '',
      createdAt: now,
      updatedAt: now,
    });
    s.feats.push(feat);
    write(s);
    return feat;
  }

  async updateFeat(id: string, patch: FeatPatch) {
    const s = read();
    const i = s.feats.findIndex((f) => f.id === id);
    if (i < 0) return;
    s.feats[i] = normalized({ ...s.feats[i], ...patch, updatedAt: new Date().toISOString() });
    write(s);
  }

  async deleteFeat(id: string) {
    const s = read();
    const gone = s.photos.filter((p) => p.featId === id);
    s.feats = s.feats.filter((f) => f.id !== id);
    s.photos = s.photos.filter((p) => p.featId !== id);
    write(s);
    // Comme côté serveur : la ligne d'abord, les fichiers ensuite.
    await this.blobs.delete(gone.flatMap((p) => [p.path, p.thumbPath]));
  }

  async listPhotos(): Promise<FeatPhoto[]> {
    return read().photos.slice();
  }

  async addPhoto(featId: string, photo: PreparedPhoto, position: number, id: string = newId()): Promise<FeatPhoto> {
    const existing = read().photos.find((p) => p.id === id);
    if (existing) return existing;
    if (!read().feats.some((f) => f.id === featId)) throw new Error('Ce haut fait n’existe plus.');
    const path = `local/${featId}/${id}.jpg`;
    const thumbPath = `local/${featId}/${id}-thumb.jpg`;
    await this.blobs.put(path, photo.full);
    await this.blobs.put(thumbPath, photo.thumb);
    const row: FeatPhoto = {
      id,
      featId,
      path,
      thumbPath,
      width: photo.width,
      height: photo.height,
      bytes: photo.full.size + photo.thumb.size,
      takenAt: photo.takenAt,
      position,
      createdAt: new Date().toISOString(),
    };
    const s = read();
    s.photos.push(row);
    write(s);
    return row;
  }

  async photoBlob(photo: FeatPhoto, size: PhotoSize): Promise<Blob> {
    const blob = await this.blobs.get(size === 'full' ? photo.path : photo.thumbPath);
    if (!blob) throw new Error('Cette photo n’est plus sur cet appareil.');
    return blob;
  }

  async setPhotoPositions(positions: { id: string; position: number }[]) {
    const s = read();
    for (const { id, position } of positions) {
      const photo = s.photos.find((p) => p.id === id);
      if (photo) photo.position = position;
    }
    write(s);
  }

  async removePhoto(photo: FeatPhoto) {
    const s = read();
    s.photos = s.photos.filter((p) => p.id !== photo.id);
    write(s);
    await this.blobs.delete([photo.path, photo.thumbPath]);
  }

  async getSettings(): Promise<HautsFaitsSettings> {
    return read().settings;
  }

  async saveSettings(patch: Partial<HautsFaitsSettings>) {
    const s = read();
    s.settings = { ...s.settings, ...patch };
    write(s);
  }

  async exportData(): Promise<HautsFaitsBackup> {
    const s = read();
    return { feats: s.feats.slice(), settings: s.settings, photos: s.photos.slice() };
  }

  /**
   * Les images restent dans IndexedDB : restaurer une sauvegarde sur le même
   * appareil leur rend leurs lignes (étude §5.6).
   */
  async importData(data: HautsFaitsBackup) {
    const feats = data.feats ?? [];
    const photos = (data.photos ?? []).filter((p) => feats.some((f) => f.id === p.featId));
    write({ feats, settings: { ...DEFAULT_HAUTSFAITS_SETTINGS, ...data.settings }, photos });
  }
}
