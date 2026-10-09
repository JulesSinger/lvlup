import { describe, expect, it } from 'vitest';
import { parseFit } from './fit';

/** Un FIT minimal fabriqué ici : deux définitions, des points (dont un à en-tête compressé) et une séance. */
function buildFit(): Uint8Array {
  const body: number[] = [];
  const u16 = (v: number) => [v & 0xff, v >> 8];
  const u32 = (v: number) => [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, v >>> 24];
  // Définition du type local 0 : point (20) — instant, distance, FC, altitude.
  body.push(0x40, 0, 0, ...u16(20), 4, 253, 4, 0x86, 5, 4, 0x86, 3, 1, 0x02, 2, 2, 0x84);
  const start = 1_000_000_000;
  // Point 1 : en-tête normal.
  body.push(0x00, ...u32(start), ...u32(0), 140, ...u16((100 + 500) * 5));
  // Point 2 : en-tête compressé (type local 0), 10 s plus tard, 1 000 m.
  const offset = (start + 10) & 0x1f;
  body.push(0x80 | offset, ...u32(0xffffffff), ...u32(100_000), 0xff, ...u16((110 + 500) * 5));
  // Définition du type local 1 : séance (18) — FC moyenne, max, dénivelé.
  body.push(0x41, 0, 0, ...u16(18), 3, 16, 1, 0x02, 17, 1, 0x02, 22, 2, 0x84);
  body.push(0x01, 152, 171, ...u16(35));
  const header = [14, 0x10, ...u16(2100), ...u32(body.length), 0x2e, 0x46, 0x49, 0x54, 0, 0];
  return new Uint8Array([...header, ...body, 0, 0]);
}

describe('lire un FIT', () => {
  it('rend les points et le résumé de séance', () => {
    const { points, session } = parseFit(buildFit());
    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({ dist: 0, hr: 140, ele: 100 });
    expect(new Date(points[0].t).toISOString()).toBe('2021-09-08T01:46:40.000Z');
    // L'en-tête compressé avance de 10 s ; une FC « invalide » est absente.
    expect(points[1].t - points[0].t).toBe(10_000);
    expect(points[1]).toMatchObject({ dist: 1000, ele: 110 });
    expect(points[1].hr).toBeUndefined();
    expect(session).toEqual({ avgHr: 152, maxHr: 171, ascentM: 35 });
  });

  it('refuse ce qui n’est pas un FIT', () => {
    expect(() => parseFit(new Uint8Array(20))).toThrow();
    expect(() => parseFit(new Uint8Array([1, 2]))).toThrow();
  });
});
