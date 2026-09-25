import { beforeEach, describe, expect, it } from 'vitest';
import { createFlusher, createOutbox, isNetworkError, type QueuedOp } from './outbox';

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

interface Op extends QueuedOp {
  label: string;
}

const op = (id: string): Op => ({ id, at: 0, label: id });

beforeEach(() => memory.clear());

describe('createOutbox', () => {
  it('garde les opérations sous sa propre clé, et survit à une nouvelle instance (rechargement)', () => {
    createOutbox<Op>('test.outbox.v1').replace([op('a'), op('b')]);
    expect(createOutbox<Op>('test.outbox.v1').list().map((o) => o.id)).toEqual(['a', 'b']);
    expect(createOutbox<Op>('autre.outbox.v1').list()).toEqual([]);
  });

  it('libère la clé quand la file se vide', () => {
    const box = createOutbox<Op>('test.outbox.v1');
    box.replace([op('a')]);
    box.remove('a');
    expect(memory.has('test.outbox.v1')).toBe(false);
  });

  it('prévient les abonnés à chaque changement, jusqu’au désabonnement', () => {
    const box = createOutbox<Op>('test.outbox.v1');
    const seen: number[] = [];
    const off = box.onChange((ops) => seen.push(ops.length));
    box.replace([op('a'), op('b')]);
    box.remove('a');
    off();
    box.clear();
    expect(seen).toEqual([2, 1]);
  });

  it('une file illisible est traitée comme vide plutôt que de planter', () => {
    memory.set('test.outbox.v1', '{pas du json');
    expect(createOutbox<Op>('test.outbox.v1').list()).toEqual([]);
  });
});

describe('createFlusher', () => {
  it('envoie dans l’ordre et vide la file', async () => {
    const box = createOutbox<Op>('test.outbox.v1');
    box.replace([op('a'), op('b')]);
    const sent: string[] = [];
    const result = await createFlusher(box, async (o) => void sent.push(o.id))();
    expect(sent).toEqual(['a', 'b']);
    expect(result).toEqual({ sent: 2, remaining: 0, dropped: [] });
  });

  it('une coupure réseau arrête le vidage et garde la suite', async () => {
    const box = createOutbox<Op>('test.outbox.v1');
    box.replace([op('a'), op('b'), op('c')]);
    const result = await createFlusher(box, async (o) => {
      if (o.id === 'b') throw new TypeError('Failed to fetch');
    })();
    expect(result).toEqual({ sent: 1, remaining: 2, dropped: [] });
    expect(box.list().map((o) => o.id)).toEqual(['b', 'c']);
  });

  it('un refus du serveur retire l’opération, remonte le message, et laisse passer la suite', async () => {
    const box = createOutbox<Op>('test.outbox.v1');
    box.replace([op('a'), op('b')]);
    const result = await createFlusher(box, async (o) => {
      if (o.id === 'a') throw new Error('violates check constraint');
    })();
    expect(result).toEqual({ sent: 1, remaining: 0, dropped: ['violates check constraint'] });
  });

  it('deux vidages simultanés n’en font qu’un', async () => {
    const box = createOutbox<Op>('test.outbox.v1');
    box.replace([op('a')]);
    let calls = 0;
    const flush = createFlusher(box, async () => {
      calls += 1;
    });
    await Promise.all([flush(), flush()]);
    expect(calls).toBe(1);
  });
});

describe('isNetworkError', () => {
  it('distingue une requête qui n’a pas pu partir d’un refus du serveur', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkError(new Error('Load failed'))).toBe(true);
    expect(isNetworkError(new Error('new row violates row-level security policy'))).toBe(false);
  });
});
