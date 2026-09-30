import { beforeEach, describe, expect, it } from 'vitest';
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
});
