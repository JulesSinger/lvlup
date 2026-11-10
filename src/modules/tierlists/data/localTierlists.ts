import { newId } from '../../../core/data/coreStore';
import type { BlobStore } from '../../../core/data/images/blobStore';
import { readRaw, writeRaw } from '../../../core/data/localSnapshot';
import type { ImageSize, PreparedImage } from '../../../core/lib/images';
import { DEFAULT_TIERS } from '../lib/board';
import type { ItemInput, ItemMove, Tier, TierInput, TierItem, TierList, TierListInput, TierPatch } from '../lib/types';
import { validateItem, validateList, validateTier } from '../lib/validation';
import { deviceBlobs } from './deviceImages';
import type { TierlistsBackup, TierlistsStore } from './tierlistsStore';

const arrayOf = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

interface Snapshot {
  lists: TierList[];
  tiers: Tier[];
  items: TierItem[];
}

/** Lecture des seules sections du module, sur le blob local partagé. */
function read(): Snapshot {
  const raw = readRaw();
  return {
    lists: arrayOf<TierList>(raw.tierlistsLists),
    tiers: arrayOf<Tier>(raw.tierlistsTiers),
    items: arrayOf<TierItem>(raw.tierlistsItems),
  };
}

/** Écriture par fusion : les sections des autres modules sont préservées. */
function write(s: Snapshot) {
  writeRaw({ ...readRaw(), tierlistsLists: s.lists, tierlistsTiers: s.tiers, tierlistsItems: s.items });
}

function fail(problem: string | null) {
  if (problem) throw new Error(problem);
}

const files = (items: TierItem[]) => items.flatMap((i) => (i.image ? [i.image.path, i.image.thumbPath] : []));

/** Tier lists stockées dans le navigateur, sans compte ni serveur ; les images dans IndexedDB. */
export class LocalTierlists implements TierlistsStore {
  private blobs: BlobStore;

  constructor(blobs?: BlobStore) {
    this.blobs = blobs ?? deviceBlobs();
  }

  async listLists(): Promise<TierList[]> {
    return read().lists.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
  }

  async createList(input: TierListInput, id: string = newId()): Promise<{ list: TierList; tiers: Tier[] }> {
    fail(validateList(input));
    const s = read();
    const existing = s.lists.find((l) => l.id === id);
    if (existing) return { list: existing, tiers: s.tiers.filter((t) => t.listId === id) };
    const now = new Date().toISOString();
    const list: TierList = { id, title: input.title.trim(), description: input.description ?? '', createdAt: now, updatedAt: now };
    const tiers: Tier[] = DEFAULT_TIERS.map((t, position) => ({ id: newId(), listId: id, label: t.label, color: t.color, position }));
    s.lists.push(list);
    s.tiers.push(...tiers);
    write(s);
    return { list, tiers };
  }

  async updateList(id: string, patch: Partial<TierListInput>) {
    fail(validateList(patch));
    const s = read();
    s.lists = s.lists.map((l) =>
      l.id === id
        ? {
            ...l,
            ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
            ...(patch.description !== undefined ? { description: patch.description } : {}),
            updatedAt: new Date().toISOString(),
          }
        : l,
    );
    write(s);
  }

  async deleteList(id: string) {
    const s = read();
    const gone = s.items.filter((i) => i.listId === id);
    s.lists = s.lists.filter((l) => l.id !== id);
    s.tiers = s.tiers.filter((t) => t.listId !== id);
    s.items = s.items.filter((i) => i.listId !== id);
    write(s);
    await this.blobs.delete(files(gone));
  }

  /** Toucher une liste la fait remonter en tête de la grille. */
  private touch(s: Snapshot, listId: string) {
    const now = new Date().toISOString();
    s.lists = s.lists.map((l) => (l.id === listId ? { ...l, updatedAt: now } : l));
  }

  async listTiers(listId: string): Promise<Tier[]> {
    return read().tiers.filter((t) => t.listId === listId);
  }

  async createTier(input: TierInput, id: string = newId()): Promise<Tier> {
    fail(validateTier(input));
    const s = read();
    const existing = s.tiers.find((t) => t.id === id);
    if (existing) return existing;
    const tier: Tier = { id, listId: input.listId, label: input.label.trim(), color: input.color, position: input.position };
    s.tiers.push(tier);
    this.touch(s, input.listId);
    write(s);
    return tier;
  }

  async updateTiers(patches: { id: string; patch: TierPatch }[]) {
    for (const { patch } of patches) fail(validateTier(patch));
    const s = read();
    const byId = new Map(patches.map((p) => [p.id, p.patch]));
    s.tiers = s.tiers.map((t) => {
      const patch = byId.get(t.id);
      return patch ? { ...t, ...patch, ...(patch.label !== undefined ? { label: patch.label.trim() } : {}) } : t;
    });
    const listId = s.tiers.find((t) => byId.has(t.id))?.listId;
    if (listId) this.touch(s, listId);
    write(s);
  }

  async deleteTier(id: string) {
    const s = read();
    const tier = s.tiers.find((t) => t.id === id);
    s.tiers = s.tiers.filter((t) => t.id !== id);
    // Comme `on delete set null` : ce qui restait dans la rangée tombe dans la réserve.
    s.items = s.items.map((i) => (i.tierId === id ? { ...i, tierId: null } : i));
    if (tier) this.touch(s, tier.listId);
    write(s);
  }

  async listItems(listId: string): Promise<TierItem[]> {
    return read().items.filter((i) => i.listId === listId);
  }

  async createItem(input: ItemInput, image?: PreparedImage, id: string = newId()): Promise<TierItem> {
    fail(validateItem(input, Boolean(image)));
    const before = read();
    const existing = before.items.find((i) => i.id === id);
    if (existing) return existing;
    let stored: TierItem['image'] = null;
    if (image) {
      const path = `${input.listId}/${id}.jpg`;
      const thumbPath = `${input.listId}/${id}-thumb.jpg`;
      await this.blobs.put(path, image.full);
      await this.blobs.put(thumbPath, image.thumb);
      stored = { path, thumbPath, width: image.width, height: image.height };
    }
    const item: TierItem = {
      id,
      listId: input.listId,
      tierId: input.tierId,
      label: input.label.trim(),
      image: stored,
      position: input.position,
      createdAt: new Date().toISOString(),
    };
    // Relu après l'enregistrement des images : une autre écriture a pu passer entre-temps.
    const s = read();
    s.items.push(item);
    this.touch(s, input.listId);
    write(s);
    return item;
  }

  async updateItemLabel(id: string, label: string) {
    const s = read();
    const item = s.items.find((i) => i.id === id);
    if (!item) return;
    fail(validateItem({ label }, Boolean(item.image)));
    s.items = s.items.map((i) => (i.id === id ? { ...i, label: label.trim() } : i));
    this.touch(s, item.listId);
    write(s);
  }

  async deleteItem(item: TierItem) {
    const s = read();
    s.items = s.items.filter((i) => i.id !== item.id);
    this.touch(s, item.listId);
    write(s);
    await this.blobs.delete(files([item]));
  }

  async moveItems(moves: ItemMove[]) {
    if (moves.length === 0) return;
    const s = read();
    const byId = new Map(moves.map((m) => [m.id, m]));
    s.items = s.items.map((i) => {
      const m = byId.get(i.id);
      return m ? { ...i, tierId: m.tierId, position: m.position } : i;
    });
    const listId = s.items.find((i) => byId.has(i.id))?.listId;
    if (listId) this.touch(s, listId);
    write(s);
  }

  async imageBlob(item: TierItem, size: ImageSize): Promise<Blob> {
    if (!item.image) throw new Error('Cet élément n’a pas d’image.');
    const blob = await this.blobs.get(size === 'full' ? item.image.path : item.image.thumbPath);
    if (!blob) throw new Error('Cette image n’est plus sur cet appareil.');
    return blob;
  }

  async exportData(): Promise<TierlistsBackup> {
    const s = read();
    return { lists: s.lists, tiers: s.tiers, items: s.items };
  }

  async importData(data: TierlistsBackup) {
    write({ lists: data.lists ?? [], tiers: data.tiers ?? [], items: data.items ?? [] });
  }
}
