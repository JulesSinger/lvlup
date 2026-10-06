/**
 * La date de prise de vue d'une photo — un petit lecteur EXIF maison,
 * bibliothèque pure (docs/etude-hauts-faits.md §5.3).
 *
 * Il ne lit qu'une chose : `DateTimeOriginal` (sinon `DateTime`), dans le
 * segment APP1 d'un JPEG. Pas de dépendance pour si peu. Tout ce qui ne
 * ressemble pas à ce qu'on attend rend `null` : une date absente vaut mieux
 * qu'une date fausse proposée à l'écran.
 */

const TAG_EXIF_IFD = 0x8769;
const TAG_DATETIME = 0x0132;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TYPE_ASCII = 2;

/** « 2025:03:02 09:41:07 » → « 2025-03-02T09:41:07 » (heure locale de l'appareil qui a pris la photo). */
function parseExifDate(raw: string): string | null {
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(raw);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  if (Number(y) < 1900 || Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) return null;
  return `${y}-${mo}-${d}T${h}:${mi}:${s}`;
}

export function readExifDate(buffer: ArrayBuffer): string | null {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return null;
    const marker = view.getUint8(offset + 1);
    const length = view.getUint16(offset + 2);
    if (marker === 0xda || length < 2) return null; // début de l'image : plus de métadonnées
    if (marker === 0xe1 && offset + 10 <= view.byteLength && readAscii(view, offset + 4, 6) === 'Exif\0\0') {
      try {
        return readTiff(view, offset + 10, Math.min(view.byteLength, offset + 2 + length));
      } catch {
        return null;
      }
    }
    offset += 2 + length;
  }
  return null;
}

function readAscii(view: DataView, start: number, length: number): string {
  let out = '';
  for (let i = 0; i < length && start + i < view.byteLength; i++) out += String.fromCharCode(view.getUint8(start + i));
  return out;
}

function readTiff(view: DataView, tiff: number, end: number): string | null {
  const order = view.getUint16(tiff);
  if (order !== 0x4949 && order !== 0x4d4d) return null;
  const little = order === 0x4949;
  const u16 = (at: number) => view.getUint16(at, little);
  const u32 = (at: number) => view.getUint32(at, little);
  if (u16(tiff + 2) !== 42) return null;

  /** Les entrées d'un répertoire (IFD) : étiquette → [type, nombre, valeur ou décalage]. */
  const entries = (ifd: number) => {
    const found = new Map<number, [number, number, number]>();
    const at = tiff + ifd;
    if (at + 2 > end) return found;
    const count = u16(at);
    for (let i = 0; i < count; i++) {
      const entry = at + 2 + i * 12;
      if (entry + 12 > end) break;
      found.set(u16(entry), [u16(entry + 2), u32(entry + 4), u32(entry + 8)]);
    }
    return found;
  };
  const ascii = (entry: [number, number, number] | undefined) => {
    if (!entry || entry[0] !== TYPE_ASCII || entry[1] < 19) return null;
    const start = tiff + entry[2];
    if (start + 19 > end) return null;
    return parseExifDate(readAscii(view, start, 19));
  };

  const ifd0 = entries(u32(tiff + 4));
  const exifPointer = ifd0.get(TAG_EXIF_IFD);
  const original = exifPointer ? ascii(entries(exifPointer[2]).get(TAG_DATETIME_ORIGINAL)) : null;
  return original ?? ascii(ifd0.get(TAG_DATETIME));
}
