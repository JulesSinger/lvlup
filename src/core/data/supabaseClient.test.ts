import { describe, expect, it } from 'vitest';
import { fetchAll, PAGE_SIZE } from './supabaseClient';

/** Une « table » de n lignes, servie par tranches comme le fait `range(from, to)`. */
function table(n: number) {
  const rows = Array.from({ length: n }, (_, i) => i);
  const calls: [number, number][] = [];
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    return { data: rows.slice(from, to + 1), error: null };
  };
  return { page, calls };
}

describe('lire toutes les lignes, par paquets', () => {
  it('au-delà d’un paquet, rien n’est perdu ni lu deux fois', async () => {
    const { page, calls } = table(PAGE_SIZE * 2 + 37);
    const rows = await fetchAll(page);
    expect(rows).toHaveLength(PAGE_SIZE * 2 + 37);
    expect(new Set(rows).size).toBe(rows.length);
    expect(calls).toEqual([
      [0, PAGE_SIZE - 1],
      [PAGE_SIZE, PAGE_SIZE * 2 - 1],
      [PAGE_SIZE * 2, PAGE_SIZE * 3 - 1],
    ]);
  });

  it('pile un paquet plein : un dernier appel, vide, confirme la fin', async () => {
    const { page, calls } = table(PAGE_SIZE);
    expect(await fetchAll(page)).toHaveLength(PAGE_SIZE);
    expect(calls).toHaveLength(2);
  });

  it('une table vide, une seule requête ; une erreur remonte', async () => {
    const { page, calls } = table(0);
    expect(await fetchAll(page)).toEqual([]);
    expect(calls).toHaveLength(1);
    await expect(fetchAll(async () => ({ data: null, error: { message: 'refusé' } }))).rejects.toThrow('refusé');
  });
});
