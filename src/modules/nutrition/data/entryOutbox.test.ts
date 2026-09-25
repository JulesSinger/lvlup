import { beforeEach, describe, expect, it } from 'vitest';
import { createOutbox } from '../../../core/data/outbox';
import type { Entry, EntryInput } from '../lib/types';
import { applyPendingEntries, pendingEntryIds, withCreate, withDelete, withUpdate, type EntryOp } from './entryOutbox';
import { createJournalWriter } from './journalWriter';
import type { NutritionStore } from './nutritionStore';

/**
 * La file existe pour une seule raison : ne jamais perdre un repas noté sans
 * réseau. Ces tests vérifient qu'elle tient cette promesse, y compris dans
 * les enchaînements tordus (ajouter, corriger, retirer hors ligne), et que
 * le rejeu ne double rien.
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

const input: EntryInput = {
  day: '2026-09-25',
  meal: 'lunch',
  foodId: null,
  ciqualCode: '9104',
  label: 'Riz blanc, cuit',
  grams: 200,
  kcal: 310,
  proteinDg: 64,
  carbsDg: 664,
  fatDg: 14,
};

const serverEntry = (id: string, overrides: Partial<Entry> = {}): Entry => ({
  ...input,
  id,
  createdAt: '2026-09-25T12:00:00.000Z',
  ...overrides,
});

describe('mise en file', () => {
  it('une correction d’une entrée pas encore partie se fond dans sa création', () => {
    const ops = withUpdate(withCreate([], 'e1', input), 'e1', { grams: 250, kcal: 388 });
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ kind: 'create', input: { grams: 250, kcal: 388, label: 'Riz blanc, cuit' } });
  });

  it('deux corrections successives d’une entrée déjà sur le serveur n’en font qu’une', () => {
    const ops = withUpdate(withUpdate([], 'e1', { grams: 250 }), 'e1', { kcal: 388 });
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ kind: 'update', patch: { grams: 250, kcal: 388 } });
  });

  it('ajouter puis retirer hors ligne : rien ne part au serveur', () => {
    const ops = withDelete(withUpdate(withCreate([], 'e1', input), 'e1', { grams: 250 }), 'e1');
    expect(ops).toEqual([]);
  });

  it('retirer une entrée du serveur rend ses corrections en attente sans objet', () => {
    const ops = withDelete(withUpdate([], 'e1', { grams: 250 }), 'e1');
    expect(ops.map((op) => op.kind)).toEqual(['delete']);
  });

  it('ne touche pas aux opérations des autres entrées', () => {
    const ops = withDelete(withCreate(withCreate([], 'e1', input), 'e2', input), 'e1');
    expect([...pendingEntryIds(ops)]).toEqual(['e2']);
  });
});

describe('applyPendingEntries', () => {
  it('ajoute les entrées en attente aux données du serveur, avec leur id définitif', () => {
    const result = applyPendingEntries([serverEntry('s1')], withCreate([], 'e1', input));
    expect(result.map((e) => e.id)).toEqual(['s1', 'e1']);
  });

  it('ne double pas une entrée que le serveur a finalement reçue', () => {
    const result = applyPendingEntries([serverEntry('e1')], withCreate([], 'e1', input));
    expect(result).toHaveLength(1);
  });

  it('applique les corrections et les retraits en attente', () => {
    let ops: EntryOp[] = withUpdate([], 's1', { grams: 300, kcal: 465 });
    ops = withDelete(ops, 's2');
    const result = applyPendingEntries([serverEntry('s1'), serverEntry('s2')], ops);
    expect(result).toEqual([serverEntry('s1', { grams: 300, kcal: 465 })]);
  });

  it('laisse les données intactes quand la file est vide', () => {
    expect(applyPendingEntries([serverEntry('s1')], [])).toEqual([serverEntry('s1')]);
  });
});

/** Un stockage qui peut perdre le réseau, ou refuser, à la demande. */
function fakeStore() {
  const rows = new Map<string, Entry>();
  let mode: 'online' | 'offline' | 'refuse' = 'online';
  const guard = () => {
    if (mode === 'offline') throw new TypeError('Failed to fetch');
    if (mode === 'refuse') throw new Error('new row violates check constraint');
  };
  const store = {
    async createEntry(i: EntryInput, id?: string) {
      guard();
      const key = id ?? `srv-${rows.size}`;
      if (!rows.has(key)) rows.set(key, { ...i, id: key, createdAt: '2026-09-25T12:00:00.000Z' });
      return rows.get(key) as Entry;
    },
    async updateEntry(id: string, patch: Partial<EntryInput>) {
      guard();
      const row = rows.get(id);
      if (row) rows.set(id, { ...row, ...patch });
    },
    async deleteEntry(id: string) {
      guard();
      rows.delete(id);
    },
  } as unknown as NutritionStore;
  return { store, rows, setMode: (m: typeof mode) => (mode = m) };
}

describe('journalWriter', () => {
  beforeEach(() => memory.clear());

  it('avec du réseau, écrit directement et ne met rien en file', async () => {
    const { store, rows } = fakeStore();
    const writer = createJournalWriter(store, createOutbox<EntryOp>('test.nutrition.outbox'));
    const { id, queued } = await writer.add(input);
    expect(queued).toBe(false);
    expect(rows.has(id)).toBe(true);
    expect(writer.pending()).toEqual([]);
  });

  it('sans réseau, met en file ; au retour du réseau, envoie avec le même id, sans doublon', async () => {
    const { store, rows, setMode } = fakeStore();
    const writer = createJournalWriter(store, createOutbox<EntryOp>('test.nutrition.outbox'));
    setMode('offline');
    const { id, queued } = await writer.add(input);
    expect(queued).toBe(true);
    expect(rows.size).toBe(0);

    setMode('online');
    const result = await writer.flush();
    expect(result).toEqual({ sent: 1, remaining: 0, dropped: [] });
    expect([...rows.keys()]).toEqual([id]);

    // Rejouée une seconde fois (réponse perdue) : toujours une seule ligne.
    await store.createEntry(input, id);
    expect(rows.size).toBe(1);
  });

  it('une entrée qui attend passe par la file même avec du réseau, pour garder l’ordre', async () => {
    const { store, rows, setMode } = fakeStore();
    const writer = createJournalWriter(store, createOutbox<EntryOp>('test.nutrition.outbox'));
    setMode('offline');
    const { id } = await writer.add(input);
    setMode('online');
    await writer.update(id, { grams: 250 });
    await writer.flush();
    expect(rows.get(id)?.grams).toBe(250);
  });

  it('un refus du serveur n’est pas mis en file : il remonte', async () => {
    const { store, setMode } = fakeStore();
    const writer = createJournalWriter(store, createOutbox<EntryOp>('test.nutrition.outbox'));
    setMode('refuse');
    await expect(writer.add(input)).rejects.toThrow('check constraint');
    expect(writer.pending()).toEqual([]);
  });

  it('la file survit à un rechargement (nouvelle instance, même clé)', async () => {
    const { store, setMode } = fakeStore();
    setMode('offline');
    await createJournalWriter(store, createOutbox<EntryOp>('test.nutrition.outbox')).add(input);
    const reloaded = createJournalWriter(store, createOutbox<EntryOp>('test.nutrition.outbox'));
    expect(reloaded.pending()).toHaveLength(1);
  });
});
