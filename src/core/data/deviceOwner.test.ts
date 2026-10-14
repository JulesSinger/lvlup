import { describe, expect, it } from 'vitest';
import { claimDevice, OWNER_KEY, pendingWrites } from './deviceOwner';
import { createOutbox } from './outbox';

/** Un localStorage en mémoire, avec `key(i)` et `length` comme le vrai. */
function memoryStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  };
}

const ops = (...ids: string[]) => JSON.stringify(ids.map((id) => ({ id, at: 1 })));

describe('à qui appartient l’appareil (docs/securite.md §3)', () => {
  it('un premier compte prend l’appareil, files d’avant comprises', () => {
    const s = memoryStorage({ 'zenith.outbox.v1': ops('a') });
    expect(claimDevice('jules', s)).toBe(false);
    expect(s.getItem(OWNER_KEY)).toBe('jules');
    expect(s.getItem('zenith.outbox.v1')).toBe(ops('a'));
  });

  it('un autre compte n’envoie jamais les écritures du premier : elles sont mises de côté', () => {
    const s = memoryStorage({ [OWNER_KEY]: 'jules', 'zenith.outbox.v1': ops('a'), 'taches.outbox.v1': ops('t1', 't2'), 'atlas.theme.v1': 'light' });
    expect(claimDevice('lea', s)).toBe(true);
    expect(s.getItem('zenith.outbox.v1')).toBeNull();
    expect(s.getItem('taches.outbox.v1')).toBeNull();
    expect(pendingWrites(s)).toBe(0);
    expect(s.getItem('zenith.outbox.v1.parked.jules')).toBe(ops('a'));
    expect(s.getItem('atlas.theme.v1')).toBe('light');
  });

  it('les écritures reviennent quand leur compte se reconnecte, avant tout envoi', () => {
    const s = memoryStorage({ [OWNER_KEY]: 'jules', 'taches.outbox.v1': ops('t1') });
    claimDevice('lea', s);
    s.setItem('taches.outbox.v1', ops('l1'));
    expect(claimDevice('jules', s)).toBe(true);
    expect(s.getItem('taches.outbox.v1')).toBe(ops('t1'));
    expect(s.getItem('taches.outbox.v1.parked.lea')).toBe(ops('l1'));
    expect(claimDevice('lea', s)).toBe(true);
    expect(JSON.parse(s.getItem('taches.outbox.v1')!).map((o: { id: string }) => o.id)).toEqual(['l1']);
    expect(s.getItem('taches.outbox.v1.parked.jules')).toBe(ops('t1'));
  });

  it('le même compte qui revient ne change rien', () => {
    const s = memoryStorage({ [OWNER_KEY]: 'jules', 'nutrition.outbox.v1': ops('n') });
    expect(claimDevice('jules', s)).toBe(false);
    expect(s.getItem('nutrition.outbox.v1')).toBe(ops('n'));
  });

  it('compte les écritures en attente, toutes files confondues', () => {
    const s = memoryStorage({ 'zenith.outbox.v1': ops('a', 'b'), 'nutrition.outbox.v1': ops('c'), 'recettes.offline.v1': '{"recipes":[]}' });
    expect(pendingWrites(s)).toBe(3);
  });

  it('une file d’attente doit porter une clé reconnaissable', () => {
    expect(() => createOutbox('zenith.outbox.v1')).not.toThrow();
    expect(() => createOutbox('mes-coches')).toThrow(/outbox/);
  });
});
