import { describe, expect, it } from 'vitest';
import { readExifDate } from './exif';

/**
 * Un JPEG minimal avec un segment EXIF : un IFD0 (qui peut porter `DateTime`)
 * pointant vers un IFD Exif (qui porte `DateTimeOriginal`). Juste assez pour
 * que le lecteur trouve ce qu'il cherche, comme dans une vraie photo.
 */
function jpegWithExif({ original, dateTime, little = true }: { original?: string; dateTime?: string; little?: boolean }): ArrayBuffer {
  const tiff: number[] = [];
  const u16 = (v: number) => (little ? [v & 0xff, v >> 8] : [v >> 8, v & 0xff]);
  const u32 = (v: number) => (little ? [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, v >>> 24] : [v >>> 24, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff]);
  const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0)).concat([0]);

  // En-tête (8) + IFD0 à 8 : 2 entrées (2 + 24 + 4 = 30) → IFD Exif à 38 : 1 entrée (18) → chaînes à 56 et 76.
  const ifd0Entries = [[0x8769, 4, 1, 38]];
  if (dateTime) ifd0Entries.push([0x0132, 2, 20, 76]);
  tiff.push(...(little ? [0x49, 0x49] : [0x4d, 0x4d]), ...u16(42), ...u32(8));
  tiff.push(...u16(2));
  for (const [tag, type, count, value] of [...ifd0Entries, [0, 0, 0, 0]].slice(0, 2)) tiff.push(...u16(tag), ...u16(type), ...u32(count), ...u32(value));
  tiff.push(...u32(0));
  tiff.push(...u16(1), ...u16(original ? 0x9003 : 0x9999), ...u16(2), ...u32(20), ...u32(56), ...u32(0));
  while (tiff.length < 56) tiff.push(0);
  tiff.push(...ascii(original ?? '0000:00:00 00:00:00'));
  while (tiff.length < 76) tiff.push(0);
  tiff.push(...ascii(dateTime ?? '0000:00:00 00:00:00'));

  const app1 = [...ascii('Exif'), 0, ...tiff];
  const length = app1.length + 2;
  const bytes = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xe1, length >> 8, length & 0xff, ...app1, 0xff, 0xda, 0x00, 0x02];
  return new Uint8Array(bytes).buffer;
}

describe('la date de prise de vue', () => {
  it('lit DateTimeOriginal, dans les deux ordres d’octets', () => {
    expect(readExifDate(jpegWithExif({ original: '2025:03:02 09:41:07' }))).toBe('2025-03-02T09:41:07');
    expect(readExifDate(jpegWithExif({ original: '2019:07:14 22:05:00', little: false }))).toBe('2019-07-14T22:05:00');
  });

  it('se rabat sur DateTime quand la date d’origine manque', () => {
    expect(readExifDate(jpegWithExif({ dateTime: '2021:01:15 12:00:00' }))).toBe('2021-01-15T12:00:00');
  });

  it('rend null plutôt qu’une date fausse : zéros, pas d’EXIF, pas un JPEG', () => {
    expect(readExifDate(jpegWithExif({ original: '0000:00:00 00:00:00' }))).toBeNull();
    expect(readExifDate(new Uint8Array([0xff, 0xd8, 0xff, 0xda, 0x00, 0x02]).buffer)).toBeNull();
    expect(readExifDate(new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer)).toBeNull();
    expect(readExifDate(new ArrayBuffer(0))).toBeNull();
  });

  it('ne plante pas sur un fichier tronqué', () => {
    const cut = jpegWithExif({ original: '2025:03:02 09:41:07' }).slice(0, 40);
    expect(readExifDate(cut)).toBeNull();
  });
});
