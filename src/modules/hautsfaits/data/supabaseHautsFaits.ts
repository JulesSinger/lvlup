import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAll, getClient, requireUserId, unwrap } from '../../../core/data/supabaseClient';
import {
  DEFAULT_HAUTSFAITS_SETTINGS,
  type DatePrecision,
  type Feat,
  type FeatCategory,
  type FeatInput,
  type FeatPatch,
  type FeatPhoto,
  type HautsFaitsSettings,
  type PhotoSize,
  type PreparedPhoto,
} from '../lib/types';
import type { HautsFaitsBackup, HautsFaitsStore } from './hautsFaitsStore';
import { cachedBlob, forgetCached } from './photoCache';

/** Le bucket privé des photos (migration 2026-09-30-hautsfaits-photos.sql). */
const BUCKET = 'hautsfaits';

interface PhotoRow {
  id: string;
  feat_id: string;
  path: string;
  thumb_path: string;
  width: number;
  height: number;
  bytes: number;
  taken_at: string | null;
  position: number;
  created_at: string;
}

/** Postgres rend un `timestamp` « 2025-03-02T09:41:07 » ou avec des fractions : on garde la seconde. */
const toPhoto = (r: PhotoRow): FeatPhoto => ({
  id: r.id,
  featId: r.feat_id,
  path: r.path,
  thumbPath: r.thumb_path,
  width: r.width,
  height: r.height,
  bytes: r.bytes,
  takenAt: r.taken_at ? r.taken_at.replace(' ', 'T').slice(0, 19) : null,
  position: r.position,
  createdAt: r.created_at,
});

interface FeatRow {
  id: string;
  title: string;
  category: FeatCategory;
  date_start: string;
  date_precision: DatePrecision;
  date_end: string | null;
  date_end_precision: DatePrecision | null;
  major: boolean;
  highlight: string;
  place: string;
  people: string;
  story: string;
  created_at: string;
  updated_at: string;
}

const toFeat = (r: FeatRow): Feat => ({
  id: r.id,
  title: r.title,
  category: r.category,
  dateStart: r.date_start,
  datePrecision: r.date_precision,
  dateEnd: r.date_end,
  dateEndPrecision: r.date_end_precision,
  major: r.major,
  highlight: r.highlight,
  place: r.place,
  people: r.people,
  story: r.story,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/** Colonnes d'un haut fait, pour les seuls champs présents dans `patch`. */
function featColumns(patch: FeatPatch | FeatInput): Record<string, unknown> {
  const p = patch as FeatPatch;
  const row: Record<string, unknown> = {};
  if (p.title !== undefined) row.title = p.title;
  if (p.category !== undefined) row.category = p.category;
  if (p.dateStart !== undefined) row.date_start = p.dateStart;
  if (p.datePrecision !== undefined) row.date_precision = p.datePrecision;
  if (p.dateEnd !== undefined) row.date_end = p.dateEnd;
  if (p.dateEndPrecision !== undefined) row.date_end_precision = p.dateEndPrecision;
  if (p.major !== undefined) row.major = p.major;
  if (p.highlight !== undefined) row.highlight = p.highlight;
  if (p.place !== undefined) row.place = p.place;
  if (p.people !== undefined) row.people = p.people;
  if (p.story !== undefined) row.story = p.story;
  // Plus de fin : plus de précision de fin — sinon la base refuse.
  if (p.dateEnd === null) row.date_end_precision = null;
  return row;
}

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** Hauts faits stockés sur Supabase, protégés par le Row Level Security. */
export class SupabaseHautsFaits implements HautsFaitsStore {
  private client: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.client = getClient(url, anonKey);
  }

  private requireUserId(): Promise<string> {
    return requireUserId(this.client);
  }

  async listFeats(): Promise<Feat[]> {
    return (
      await fetchAll<FeatRow>((first, last) =>
        this.client.from('hautsfaits_feats').select('*').order('date_start', { ascending: false }).order('id').range(first, last),
      )
    ).map(toFeat);
  }

  async createFeat(input: FeatInput, id?: string): Promise<Feat> {
    const userId = await this.requireUserId();
    if (id) {
      // Rejouable : `on conflict do nothing` sur l'id, puis relecture — même
      // motif que les entrées de Cérès et les tâches.
      const { error } = await this.client
        .from('hautsfaits_feats')
        .upsert({ id, user_id: userId, ...featColumns(input) }, { onConflict: 'id', ignoreDuplicates: true });
      check(error);
      return toFeat(unwrap(await this.client.from('hautsfaits_feats').select('*').eq('id', id).single()) as FeatRow);
    }
    const row = unwrap(
      await this.client
        .from('hautsfaits_feats')
        .insert({ user_id: userId, ...featColumns(input) })
        .select()
        .single(),
    ) as FeatRow;
    return toFeat(row);
  }

  async updateFeat(id: string, patch: FeatPatch) {
    check(
      (await this.client.from('hautsfaits_feats').update({ ...featColumns(patch), updated_at: new Date().toISOString() }).eq('id', id))
        .error,
    );
  }

  async deleteFeat(id: string) {
    const photos = (unwrap(await this.client.from('hautsfaits_photos').select('*').eq('feat_id', id)) as PhotoRow[]).map(toPhoto);
    // La ligne d'abord (ses photos partent par cascade), les fichiers ensuite.
    check((await this.client.from('hautsfaits_feats').delete().eq('id', id)).error);
    await this.removeFiles(photos.flatMap((p) => [p.path, p.thumbPath]));
  }

  /**
   * Un fichier qu'on n'arrive pas à supprimer n'est que de la place perdue :
   * la ligne est déjà partie, on ne bloque pas l'utilisateur pour ça.
   */
  private async removeFiles(paths: string[]) {
    if (paths.length === 0) return;
    await forgetCached(paths);
    const { error } = await this.client.storage.from(BUCKET).remove(paths);
    if (error) console.warn('Hauts faits : fichiers restés dans le stockage', paths, error.message);
  }

  async listPhotos(): Promise<FeatPhoto[]> {
    return (
      await fetchAll<PhotoRow>((first, last) =>
        this.client.from('hautsfaits_photos').select('*').order('position').order('id').range(first, last),
      )
    ).map(toPhoto);
  }

  async addPhoto(featId: string, photo: PreparedPhoto, position: number, id: string = crypto.randomUUID()): Promise<FeatPhoto> {
    const userId = await this.requireUserId();
    // Le premier segment du chemin est le compte : c'est ce que vérifient les politiques du bucket.
    const path = `${userId}/${featId}/${id}.jpg`;
    const thumbPath = `${userId}/${featId}/${id}-thumb.jpg`;
    const bucket = this.client.storage.from(BUCKET);
    for (const [target, blob] of [
      [path, photo.full],
      [thumbPath, photo.thumb],
    ] as const) {
      // `upsert` : un envoi rejoué après une coupure réécrit le même fichier plutôt que d'échouer.
      const { error } = await bucket.upload(target, blob, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' });
      if (error) throw new Error(`La photo n’a pas pu être envoyée : ${error.message}`);
    }
    const { error } = await this.client.from('hautsfaits_photos').upsert(
      {
        id,
        user_id: userId,
        feat_id: featId,
        path,
        thumb_path: thumbPath,
        width: photo.width,
        height: photo.height,
        bytes: photo.full.size + photo.thumb.size,
        taken_at: photo.takenAt,
        position,
      },
      { onConflict: 'id', ignoreDuplicates: true },
    );
    check(error);
    return toPhoto(unwrap(await this.client.from('hautsfaits_photos').select('*').eq('id', id).single()) as PhotoRow);
  }

  async photoBlob(photo: FeatPhoto, size: PhotoSize): Promise<Blob> {
    const path = size === 'full' ? photo.path : photo.thumbPath;
    return cachedBlob(path, async () => {
      const { data, error } = await this.client.storage.from(BUCKET).download(path);
      if (error || !data) throw new Error('Cette photo n’a pas pu être chargée.');
      return data;
    });
  }

  async setPhotoPositions(positions: { id: string; position: number }[]) {
    for (const { id, position } of positions) {
      check((await this.client.from('hautsfaits_photos').update({ position }).eq('id', id)).error);
    }
  }

  async removePhoto(photo: FeatPhoto) {
    check((await this.client.from('hautsfaits_photos').delete().eq('id', photo.id)).error);
    await this.removeFiles([photo.path, photo.thumbPath]);
  }

  async getSettings(): Promise<HautsFaitsSettings> {
    const { data, error } = await this.client.from('hautsfaits_settings').select('birth_date, on_this_day_reminder').maybeSingle();
    check(error);
    if (!data) return { ...DEFAULT_HAUTSFAITS_SETTINGS };
    return { birthDate: data.birth_date, onThisDayReminder: data.on_this_day_reminder };
  }

  async saveSettings(patch: Partial<HautsFaitsSettings>) {
    const userId = await this.requireUserId();
    const next = { ...(await this.getSettings()), ...patch };
    check(
      (
        await this.client.from('hautsfaits_settings').upsert(
          {
            user_id: userId,
            birth_date: next.birthDate,
            on_this_day_reminder: next.onThisDayReminder,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        )
      ).error,
    );
  }

  async exportData(): Promise<HautsFaitsBackup> {
    return { feats: await this.listFeats(), settings: await this.getSettings(), photos: await this.listPhotos() };
  }

  /**
   * Remplace tout, comme une restauration de sauvegarde. Les identifiants
   * sont gardés (des uuid choisis par l'application) : les photos
   * retrouvent leur haut fait sans table de correspondance, et leurs
   * fichiers, restés dans le stockage, sur le même compte (étude §5.6). Les
   * fichiers ne sont jamais effacés par une restauration.
   */
  async importData(data: HautsFaitsBackup) {
    const userId = await this.requireUserId();
    check((await this.client.from('hautsfaits_feats').delete().eq('user_id', userId)).error);
    const feats = data.feats ?? [];
    if (feats.length > 0) {
      check((await this.client.from('hautsfaits_feats').insert(feats.map((f) => ({ id: f.id, user_id: userId, ...featColumns(f) })))).error);
    }
    const photos = (data.photos ?? []).filter((p) => feats.some((f) => f.id === p.featId));
    if (photos.length > 0) {
      check(
        (
          await this.client.from('hautsfaits_photos').insert(
            photos.map((p) => ({
              id: p.id,
              user_id: userId,
              feat_id: p.featId,
              path: p.path,
              thumb_path: p.thumbPath,
              width: p.width,
              height: p.height,
              bytes: p.bytes,
              taken_at: p.takenAt,
              position: p.position,
            })),
          )
        ).error,
      );
    }
    if (data.settings) await this.saveSettings(data.settings);
  }
}
