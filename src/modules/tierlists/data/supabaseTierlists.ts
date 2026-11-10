import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAll, getClient, requireUserId, unwrap } from '../../../core/data/supabaseClient';
import type { ImageSize, PreparedImage } from '../../../core/lib/images';
import { DEFAULT_TIERS } from '../lib/board';
import type { ItemInput, ItemMove, Tier, TierColor, TierInput, TierItem, TierList, TierListInput, TierPatch } from '../lib/types';
import { validateItem, validateList, validateTier } from '../lib/validation';
import { imageCache } from './deviceImages';
import type { TierlistsBackup, TierlistsStore } from './tierlistsStore';

/** Le bucket privé des images (migration du 2026-11-10). */
const BUCKET = 'tierlists';
const BATCH = 500;
/** Déplacements envoyés ensemble : un glisser en change quelques-uns, « tout remettre » parfois cent. */
const PARALLEL = 10;

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function fail(problem: string | null) {
  if (problem) throw new Error(problem);
}

function* chunks<T>(items: T[], size: number): Generator<T[]> {
  for (let i = 0; i < items.length; i += size) yield items.slice(i, i + size);
}

interface ListRow {
  id: string;
  title: string;
  description: string;
  created_at: string;
  updated_at: string;
}

interface TierRow {
  id: string;
  list_id: string;
  label: string;
  color: TierColor;
  position: number;
}

interface ItemRow {
  id: string;
  list_id: string;
  tier_id: string | null;
  label: string;
  image_path: string | null;
  thumb_path: string | null;
  width: number | null;
  height: number | null;
  position: number;
  created_at: string;
}

const toList = (r: ListRow): TierList => ({ id: r.id, title: r.title, description: r.description, createdAt: r.created_at, updatedAt: r.updated_at });
const toTier = (r: TierRow): Tier => ({ id: r.id, listId: r.list_id, label: r.label, color: r.color, position: r.position });
const toItem = (r: ItemRow): TierItem => ({
  id: r.id,
  listId: r.list_id,
  tierId: r.tier_id,
  label: r.label,
  image: r.image_path && r.thumb_path ? { path: r.image_path, thumbPath: r.thumb_path, width: r.width ?? 0, height: r.height ?? 0 } : null,
  position: r.position,
  createdAt: r.created_at,
});

function itemColumns(item: TierItem): Record<string, unknown> {
  return {
    list_id: item.listId,
    tier_id: item.tierId,
    label: item.label,
    image_path: item.image?.path ?? null,
    thumb_path: item.image?.thumbPath ?? null,
    width: item.image?.width ?? null,
    height: item.image?.height ?? null,
    position: item.position,
    created_at: item.createdAt,
  };
}

const files = (items: TierItem[]) => items.flatMap((i) => (i.image ? [i.image.path, i.image.thumbPath] : []));

/** Tier lists sur Supabase, protégées par le Row Level Security ; les images dans le bucket `tierlists`. */
export class SupabaseTierlists implements TierlistsStore {
  private client: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.client = getClient(url, anonKey);
  }

  private requireUserId(): Promise<string> {
    return requireUserId(this.client);
  }

  /** Création rejouable : `on conflict do nothing` sur l'id, puis relecture de la ligne. */
  private async upsertThenRead<R>(table: string, id: string, row: Record<string, unknown>): Promise<R> {
    const { error } = await this.client.from(table).upsert({ id, ...row }, { onConflict: 'id', ignoreDuplicates: true });
    check(error);
    return unwrap(await this.client.from(table).select('*').eq('id', id).single()) as R;
  }

  /** Un fichier qu'on n'arrive pas à supprimer n'est que de la place perdue : on ne bloque pas pour ça. */
  private async removeFiles(paths: string[]) {
    if (paths.length === 0) return;
    await imageCache.forgetCached(paths);
    for (const batch of chunks(paths, 100)) {
      const { error } = await this.client.storage.from(BUCKET).remove(batch);
      if (error) console.warn('Tier lists : fichiers restés dans le stockage', batch, error.message);
    }
  }

  /** La liste remonte en tête de la grille ; un échec ici ne doit rien empêcher. */
  private async touch(listId: string) {
    const { error } = await this.client.from('tierlists_lists').update({ updated_at: new Date().toISOString() }).eq('id', listId);
    if (error) console.warn('Tier lists : date de la liste non mise à jour', error.message);
  }

  async listLists(): Promise<TierList[]> {
    const rows = await fetchAll<ListRow>((from, to) =>
      this.client.from('tierlists_lists').select('*').order('updated_at', { ascending: false }).order('id').range(from, to),
    );
    return rows.map(toList);
  }

  async createList(input: TierListInput, id: string = crypto.randomUUID()): Promise<{ list: TierList; tiers: Tier[] }> {
    fail(validateList(input));
    const userId = await this.requireUserId();
    const list = toList(
      await this.upsertThenRead<ListRow>('tierlists_lists', id, {
        user_id: userId,
        title: input.title.trim(),
        description: input.description ?? '',
      }),
    );
    // Rejouée après une coupure, la création ne double pas les rangées.
    let tiers = await this.listTiers(id);
    if (tiers.length === 0) {
      const rows = DEFAULT_TIERS.map((t, position) => ({ user_id: userId, list_id: id, label: t.label, color: t.color, position }));
      tiers = (unwrap(await this.client.from('tierlists_tiers').insert(rows).select()) as TierRow[]).map(toTier);
    }
    return { list, tiers };
  }

  async updateList(id: string, patch: Partial<TierListInput>) {
    fail(validateList(patch));
    const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (patch.title !== undefined) row.title = patch.title.trim();
    if (patch.description !== undefined) row.description = patch.description;
    check((await this.client.from('tierlists_lists').update(row).eq('id', id)).error);
  }

  async deleteList(id: string) {
    const items = await this.listItems(id);
    // Rangées et éléments partent avec la liste (`on delete cascade`) ; les fichiers ensuite.
    check((await this.client.from('tierlists_lists').delete().eq('id', id)).error);
    await this.removeFiles(files(items));
  }

  async listTiers(listId: string): Promise<Tier[]> {
    const rows = await fetchAll<TierRow>((from, to) =>
      this.client.from('tierlists_tiers').select('*').eq('list_id', listId).order('position').order('id').range(from, to),
    );
    return rows.map(toTier);
  }

  async createTier(input: TierInput, id: string = crypto.randomUUID()): Promise<Tier> {
    fail(validateTier(input));
    const userId = await this.requireUserId();
    const tier = toTier(
      await this.upsertThenRead<TierRow>('tierlists_tiers', id, {
        user_id: userId,
        list_id: input.listId,
        label: input.label.trim(),
        color: input.color,
        position: input.position,
      }),
    );
    await this.touch(input.listId);
    return tier;
  }

  async updateTiers(patches: { id: string; patch: TierPatch }[]) {
    for (const { patch } of patches) fail(validateTier(patch));
    for (const batch of chunks(patches, PARALLEL)) {
      const results = await Promise.all(
        batch.map(({ id, patch }) => {
          const row: Record<string, unknown> = {};
          if (patch.label !== undefined) row.label = patch.label.trim();
          if (patch.color !== undefined) row.color = patch.color;
          if (patch.position !== undefined) row.position = patch.position;
          return this.client.from('tierlists_tiers').update(row).eq('id', id).select('list_id');
        }),
      );
      for (const r of results) check(r.error);
      const listId = (results[0]?.data as { list_id: string }[] | null)?.[0]?.list_id;
      if (listId) await this.touch(listId);
    }
  }

  async deleteTier(id: string) {
    // `on delete set null` : ce qui restait dans la rangée tombe dans la réserve.
    const { data, error } = await this.client.from('tierlists_tiers').delete().eq('id', id).select('list_id');
    check(error);
    const listId = (data as { list_id: string }[] | null)?.[0]?.list_id;
    if (listId) await this.touch(listId);
  }

  async listItems(listId: string): Promise<TierItem[]> {
    const rows = await fetchAll<ItemRow>((from, to) =>
      this.client.from('tierlists_items').select('*').eq('list_id', listId).order('position').order('id').range(from, to),
    );
    return rows.map(toItem);
  }

  async createItem(input: ItemInput, image?: PreparedImage, id: string = crypto.randomUUID()): Promise<TierItem> {
    fail(validateItem(input, Boolean(image)));
    const userId = await this.requireUserId();
    const row: Record<string, unknown> = {
      user_id: userId,
      list_id: input.listId,
      tier_id: input.tierId,
      label: input.label.trim(),
      position: input.position,
    };
    if (image) {
      // Le premier segment du chemin est le compte : c'est ce que vérifient les politiques du bucket.
      const path = `${userId}/${input.listId}/${id}.jpg`;
      const thumbPath = `${userId}/${input.listId}/${id}-thumb.jpg`;
      const bucket = this.client.storage.from(BUCKET);
      for (const [target, blob] of [
        [path, image.full],
        [thumbPath, image.thumb],
      ] as const) {
        // `upsert` : un envoi rejoué après une coupure réécrit le même fichier plutôt que d'échouer.
        const { error } = await bucket.upload(target, blob, { contentType: 'image/jpeg', upsert: true, cacheControl: '31536000' });
        if (error) throw new Error(`L’image n’a pas pu être envoyée : ${error.message}`);
      }
      Object.assign(row, { image_path: path, thumb_path: thumbPath, width: image.width, height: image.height });
    }
    const item = toItem(await this.upsertThenRead<ItemRow>('tierlists_items', id, row));
    await this.touch(input.listId);
    return item;
  }

  async updateItemLabel(id: string, label: string) {
    const current = unwrap(await this.client.from('tierlists_items').select('*').eq('id', id).single()) as ItemRow;
    fail(validateItem({ label }, Boolean(current.image_path)));
    check((await this.client.from('tierlists_items').update({ label: label.trim() }).eq('id', id)).error);
    await this.touch(current.list_id);
  }

  async deleteItem(item: TierItem) {
    check((await this.client.from('tierlists_items').delete().eq('id', item.id)).error);
    await this.removeFiles(files([item]));
    await this.touch(item.listId);
  }

  async moveItems(moves: ItemMove[]) {
    if (moves.length === 0) return;
    let listId: string | undefined;
    for (const batch of chunks(moves, PARALLEL)) {
      const results = await Promise.all(
        batch.map((m) => this.client.from('tierlists_items').update({ tier_id: m.tierId, position: m.position }).eq('id', m.id).select('list_id')),
      );
      for (const r of results) check(r.error);
      listId ??= (results[0]?.data as { list_id: string }[] | null)?.[0]?.list_id;
    }
    if (listId) await this.touch(listId);
  }

  async imageBlob(item: TierItem, size: ImageSize): Promise<Blob> {
    if (!item.image) throw new Error('Cet élément n’a pas d’image.');
    const path = size === 'full' ? item.image.path : item.image.thumbPath;
    return imageCache.cachedBlob(path, async () => {
      const { data, error } = await this.client.storage.from(BUCKET).download(path);
      if (error || !data) throw new Error('Cette image n’a pas pu être chargée.');
      return data;
    });
  }

  async exportData(): Promise<TierlistsBackup> {
    const lists = await this.listLists();
    const [tiers, items] = await Promise.all([
      fetchAll<TierRow>((from, to) => this.client.from('tierlists_tiers').select('*').order('id').range(from, to)),
      fetchAll<ItemRow>((from, to) => this.client.from('tierlists_items').select('*').order('id').range(from, to)),
    ]);
    return { lists, tiers: tiers.map(toTier), items: items.map(toItem) };
  }

  async importData(data: TierlistsBackup) {
    const userId = await this.requireUserId();
    // Rangées et éléments partent avec les listes (`on delete cascade`).
    // Les fichiers des images ne sont jamais effacés par une restauration.
    check((await this.client.from('tierlists_lists').delete().eq('user_id', userId)).error);
    for (const batch of chunks(data.lists ?? [], BATCH)) {
      const rows = batch.map((l) => ({ id: l.id, user_id: userId, title: l.title, description: l.description, created_at: l.createdAt, updated_at: l.updatedAt }));
      check((await this.client.from('tierlists_lists').insert(rows)).error);
    }
    for (const batch of chunks(data.tiers ?? [], BATCH)) {
      const rows = batch.map((t) => ({ id: t.id, user_id: userId, list_id: t.listId, label: t.label, color: t.color, position: t.position }));
      check((await this.client.from('tierlists_tiers').insert(rows)).error);
    }
    for (const batch of chunks(data.items ?? [], BATCH)) {
      const rows = batch.map((i) => ({ id: i.id, user_id: userId, ...itemColumns(i) }));
      check((await this.client.from('tierlists_items').insert(rows)).error);
    }
  }
}
