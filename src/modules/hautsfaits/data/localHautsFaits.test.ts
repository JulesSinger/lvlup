import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryBlobStore } from '../../../core/data/images/blobStore';
import { LocalHautsFaits } from './localHautsFaits';

/**
 * Le module s'appuie sur localStorage ; en environnement Node on en fournit
 * une version minimale — même motif que les autres modules.
 */
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

const BREVET = { title: 'Brevet des collèges', category: 'etudes', dateStart: '2014-01-01', datePrecision: 'year' } as const;

describe('LocalHautsFaits', () => {
  let store: LocalHautsFaits;

  beforeEach(() => {
    memory.clear();
    store = new LocalHautsFaits();
  });

  it('crée un haut fait avec ses valeurs par défaut', async () => {
    const feat = await store.createFeat(BREVET);
    expect(feat).toMatchObject({
      ...BREVET,
      dateEnd: null,
      dateEndPrecision: null,
      major: false,
      highlight: '',
      place: '',
      people: '',
      story: '',
    });
    expect(await store.listFeats()).toHaveLength(1);
  });

  it('rejoué avec le même id, il n’écrit rien de plus et rend le premier', async () => {
    const first = await store.createFeat(BREVET, 'f-1');
    const again = await store.createFeat({ ...BREVET, title: 'Autre chose' }, 'f-1');
    expect(again).toEqual(first);
    expect(await store.listFeats()).toHaveLength(1);
  });

  it('une période garde sa fin ; une fin sans précision prend celle du début', async () => {
    const madrid = await store.createFeat({
      title: 'Six mois à Madrid',
      category: 'voyage',
      dateStart: '2021-01-01',
      datePrecision: 'month',
      dateEnd: '2021-06-01',
    });
    expect(madrid.dateEndPrecision).toBe('month');
  });

  it('retirer la fin retire aussi sa précision, comme la contrainte côté base', async () => {
    const feat = await store.createFeat({ ...BREVET, dateEnd: '2015-01-01', dateEndPrecision: 'year' });
    await store.updateFeat(feat.id, { dateEnd: null });
    const [after] = await store.listFeats();
    expect(after.dateEnd).toBeNull();
    expect(after.dateEndPrecision).toBeNull();
  });

  it('modifie et supprime', async () => {
    const feat = await store.createFeat(BREVET);
    await store.updateFeat(feat.id, { highlight: 'Mention Très bien', major: true });
    expect((await store.listFeats())[0]).toMatchObject({ highlight: 'Mention Très bien', major: true });
    await store.deleteFeat(feat.id);
    expect(await store.listFeats()).toEqual([]);
  });

  it('les réglages : rien par défaut, puis retenus', async () => {
    expect(await store.getSettings()).toEqual({ birthDate: null, onThisDayReminder: false });
    await store.saveSettings({ birthDate: '1999-03-12' });
    expect(await store.getSettings()).toEqual({ birthDate: '1999-03-12', onThisDayReminder: false });
  });

  it('préserve les sections des autres modules dans le blob local', async () => {
    localStorage.setItem('palier.v1', JSON.stringify({ tachesTasks: [{ id: 't' }] }));
    await store.createFeat(BREVET);
    expect(JSON.parse(localStorage.getItem('palier.v1') ?? '{}').tachesTasks).toEqual([{ id: 't' }]);
  });

  it('exporte puis restaure tout, identifiants compris', async () => {
    const feat = await store.createFeat(BREVET, 'f-brevet');
    await store.saveSettings({ birthDate: '1999-03-12' });
    const backup = await store.exportData();
    memory.clear();
    await store.importData(backup);
    expect((await store.listFeats())[0]).toEqual(feat);
    expect((await store.getSettings()).birthDate).toBe('1999-03-12');
  });

  describe('les photos', () => {
    const image = (text: string) => ({
      full: new Blob([`grande ${text}`], { type: 'image/jpeg' }),
      thumb: new Blob([`miniature ${text}`], { type: 'image/jpeg' }),
      width: 2048,
      height: 1536,
      takenAt: '2025-03-02T09:41:07',
    });
    let blobs: MemoryBlobStore;

    beforeEach(() => {
      blobs = new MemoryBlobStore();
      store = new LocalHautsFaits(blobs);
    });

    it('range les deux versions à part, et la ligne dit où les trouver', async () => {
      const feat = await store.createFeat(BREVET);
      const photo = await store.addPhoto(feat.id, image('a'), 0, 'p1');
      expect(photo).toMatchObject({ featId: feat.id, width: 2048, height: 1536, takenAt: '2025-03-02T09:41:07', position: 0 });
      expect(photo.bytes).toBe(image('a').full.size + image('a').thumb.size);
      expect(await (await store.photoBlob(photo, 'full')).text()).toBe('grande a');
      expect(await (await store.photoBlob(photo, 'thumb')).text()).toBe('miniature a');
      // Les images ne vont jamais dans le blob local partagé, trop petit pour elles.
      expect(localStorage.getItem('palier.v1')).not.toContain('grande a');
    });

    it('rejouée avec le même id, une photo n’est rangée qu’une fois ; sans haut fait, elle est refusée', async () => {
      const feat = await store.createFeat(BREVET);
      await store.addPhoto(feat.id, image('a'), 0, 'p1');
      await store.addPhoto(feat.id, image('a'), 0, 'p1');
      expect(await store.listPhotos()).toHaveLength(1);
      await expect(store.addPhoto('inconnu', image('b'), 0)).rejects.toThrow('n’existe plus');
    });

    it('change l’ordre, retire une photo et ses fichiers', async () => {
      const feat = await store.createFeat(BREVET);
      const a = await store.addPhoto(feat.id, image('a'), 0);
      const b = await store.addPhoto(feat.id, image('b'), 1);
      await store.setPhotoPositions([
        { id: b.id, position: 0 },
        { id: a.id, position: 1 },
      ]);
      expect((await store.listPhotos()).find((p) => p.id === b.id)?.position).toBe(0);
      await store.removePhoto(a);
      expect((await store.listPhotos()).map((p) => p.id)).toEqual([b.id]);
      expect(blobs.size).toBe(2);
      await expect(store.photoBlob(a, 'full')).rejects.toThrow('plus sur cet appareil');
    });

    it('supprimer un haut fait emporte ses photos et leurs fichiers, pas celles des autres', async () => {
      const brevet = await store.createFeat(BREVET);
      const bac = await store.createFeat({ ...BREVET, title: 'Bac', dateStart: '2017-01-01' });
      await store.addPhoto(brevet.id, image('a'), 0);
      await store.addPhoto(bac.id, image('b'), 0);
      await store.deleteFeat(brevet.id);
      expect((await store.listPhotos()).map((p) => p.featId)).toEqual([bac.id]);
      expect(blobs.size).toBe(2);
    });

    it('la sauvegarde garde la liste des photos, pas leur contenu ; restaurée ici, chacune retrouve son image', async () => {
      const feat = await store.createFeat(BREVET);
      const photo = await store.addPhoto(feat.id, image('a'), 0);
      const backup = await store.exportData();
      expect(JSON.stringify(backup)).not.toContain('grande a');
      memory.clear();
      await store.importData(backup);
      expect(await store.listPhotos()).toEqual([photo]);
      expect(await (await store.photoBlob(photo, 'full')).text()).toBe('grande a');
    });
  });
});
