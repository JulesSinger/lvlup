import { describe, expect, it } from 'vitest';
import { OFFLINE_KEY, readOfflineCopy, saveOfflineCopy } from './offlineCopy';

const storage = () => {
  const memory = new Map<string, string>();
  return {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, v),
    removeItem: (k: string) => void memory.delete(k),
    clear: () => memory.clear(),
    key: () => null,
    length: 0,
  } as Storage;
};

describe('la copie hors ligne du carnet', () => {
  it('se garde et se relit', () => {
    const s = storage();
    expect(readOfflineCopy(s)).toBeNull();
    saveOfflineCopy({ recipes: [{ id: 'r', title: 'Lasagnes' } as never], photos: [], cooked: [], plan: [] }, s, new Date('2026-10-08T10:00:00Z'));
    expect(readOfflineCopy(s)).toMatchObject({ savedAt: '2026-10-08T10:00:00.000Z', recipes: [{ title: 'Lasagnes' }] });
  });

  it('une copie abîmée, ou un stockage plein, ne cassent rien', () => {
    const s = storage();
    s.setItem(OFFLINE_KEY, '{abîmé');
    expect(readOfflineCopy(s)).toBeNull();
    const full = { ...storage(), setItem: () => { throw new Error('QuotaExceededError'); } } as Storage;
    expect(() => saveOfflineCopy({ recipes: [], photos: [], cooked: [], plan: [] }, full)).not.toThrow();
  });
});
