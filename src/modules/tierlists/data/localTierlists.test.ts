import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryBlobStore } from '../../../core/data/images/blobStore';
import { LocalTierlists } from './localTierlists';

/** localStorage minimal en environnement Node — même motif que les autres modules. */
const memory = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
  key: (i: number) => [...memory.keys()][i] ?? null,
  get length() {
    return memory.size;
  },
} as Storage;

const image = () => ({ full: new Blob(['grande']), thumb: new Blob(['mini']), width: 900, height: 600, takenAt: null });

describe('LocalTierlists', () => {
  let blobs: MemoryBlobStore;
  let store: LocalTierlists;

  beforeEach(() => {
    memory.clear();
    blobs = new MemoryBlobStore();
    store = new LocalTierlists(blobs);
  });

  it('crée une liste avec ses rangées S à D, une seule fois même rejouée', async () => {
    const { list, tiers } = await store.createList({ title: '  Champions LoL ' }, 'l1');
    expect(list.title).toBe('Champions LoL');
    expect(tiers.map((t) => t.label)).toEqual(['S', 'A', 'B', 'C', 'D']);
    await store.createList({ title: 'Champions LoL' }, 'l1');
    expect(await store.listLists()).toHaveLength(1);
    expect(await store.listTiers('l1')).toHaveLength(5);
    await expect(store.createList({ title: ' ' })).rejects.toThrow('titre');
  });

  it('range des éléments texte et image, les déplace, garde l’image sur l’appareil', async () => {
    const { tiers } = await store.createList({ title: 'Films' }, 'l1');
    const texte = await store.createItem({ listId: 'l1', tierId: null, label: 'Dune', position: 0 });
    const photo = await store.createItem({ listId: 'l1', tierId: null, label: '', position: 1 }, image());
    expect(photo.image?.thumbPath).toBe(`l1/${photo.id}-thumb.jpg`);
    expect(await (await store.imageBlob(photo, 'thumb')).text()).toBe('mini');
    await expect(store.createItem({ listId: 'l1', tierId: null, label: '', position: 2 })).rejects.toThrow();

    await store.moveItems([{ id: texte.id, tierId: tiers[0].id, position: 0 }]);
    const items = await store.listItems('l1');
    expect(items.find((i) => i.id === texte.id)?.tierId).toBe(tiers[0].id);

    await store.updateItemLabel(photo.id, 'Interstellar');
    expect((await store.listItems('l1')).find((i) => i.id === photo.id)?.label).toBe('Interstellar');

    await store.deleteItem(photo);
    expect(blobs.size).toBe(0);
  });

  it('une rangée supprimée renvoie ses éléments dans la réserve', async () => {
    const { tiers } = await store.createList({ title: 'Films' }, 'l1');
    await store.createItem({ listId: 'l1', tierId: tiers[1].id, label: 'Dune', position: 0 });
    await store.deleteTier(tiers[1].id);
    expect((await store.listItems('l1'))[0].tierId).toBeNull();
    expect(await store.listTiers('l1')).toHaveLength(4);
  });

  it('renomme et recolore les rangées', async () => {
    const { tiers } = await store.createList({ title: 'Films' }, 'l1');
    await store.updateTiers([{ id: tiers[0].id, patch: { label: ' Top ', color: 'violet' } }]);
    const s = (await store.listTiers('l1')).find((t) => t.id === tiers[0].id);
    expect(s).toMatchObject({ label: 'Top', color: 'violet' });
    await expect(store.updateTiers([{ id: tiers[0].id, patch: { color: 'noir' as never } }])).rejects.toThrow('couleur');
  });

  it('supprime une liste avec tout ce qu’elle contient, images comprises', async () => {
    await store.createList({ title: 'A' }, 'l1');
    await store.createList({ title: 'B' }, 'l2');
    await store.createItem({ listId: 'l1', tierId: null, label: '', position: 0 }, image());
    await store.createItem({ listId: 'l2', tierId: null, label: 'Reste', position: 0 });
    await store.deleteList('l1');
    expect((await store.listLists()).map((l) => l.id)).toEqual(['l2']);
    expect(await store.listItems('l1')).toEqual([]);
    expect(await store.listTiers('l1')).toEqual([]);
    expect(blobs.size).toBe(0);
  });

  it('sauvegarde et restaure', async () => {
    await store.createList({ title: 'A' }, 'l1');
    await store.createItem({ listId: 'l1', tierId: null, label: 'x', position: 0 });
    const backup = await store.exportData();
    memory.clear();
    await store.importData(backup);
    expect(await store.listLists()).toHaveLength(1);
    expect(await store.listItems('l1')).toHaveLength(1);
    expect(await store.listTiers('l1')).toHaveLength(5);
  });
});
