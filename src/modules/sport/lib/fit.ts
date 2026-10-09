/**
 * Lire un fichier FIT — bibliothèque pure (docs/etude-sport.md §3.4, §20).
 *
 * L'archive de Jules (09/10/2026) : 43 de ses 67 courses n'ont qu'un FIT, et
 * la fréquence cardiaque n'est QUE dans les fichiers (les colonnes du CSV sont
 * vides). Plutôt qu'une dépendance (`fit-file-parser`, qui attend le `Buffer`
 * de Node), un lecteur réduit à ce que Sport utilise : les points d'une
 * sortie (instant, distance, fréquence cardiaque, altitude, position) et le
 * résumé de séance (FC moyenne et max, dénivelé).
 *
 * Le format, en bref : un en-tête (« .FIT »), puis des messages. Un message de
 * DÉFINITION décrit, pour un « type local » de 0 à 15, le message global
 * (20 = point, 18 = séance) et la liste de ses champs (numéro, taille, type) ;
 * les messages de DONNÉES qui suivent sont lus d'après cette définition. Un
 * en-tête « compressé » porte un écart de temps sur 5 bits. Un champ dont la
 * valeur est la valeur « invalide » de son type est absent.
 */
import type { TrackPoint } from './track';

/** Les secondes FIT comptent depuis le 31/12/1989 à 0 h UTC. */
const FIT_EPOCH_MS = Date.UTC(1989, 11, 31);

const RECORD = 20;
const SESSION = 18;

interface FieldDef {
  num: number;
  size: number;
  base: number;
}

interface Definition {
  global: number;
  little: boolean;
  fields: FieldDef[];
  /** Taille totale des champs de développeur, ignorés. */
  devSize: number;
}

export interface FitSession {
  avgHr: number | null;
  maxHr: number | null;
  ascentM: number | null;
}

export interface FitReading {
  points: TrackPoint[];
  session: FitSession | null;
}

/** Une valeur entière d'un champ, ou null si elle vaut la valeur « invalide » de son type. */
function readValue(view: DataView, at: number, field: FieldDef, little: boolean): number | null {
  const type = field.base & 0x1f;
  switch (type) {
    case 0x00: // enum
    case 0x02: // uint8
    case 0x0a: {
      // uint8z
      if (field.size < 1) return null;
      const v = view.getUint8(at);
      return v === 0xff || (type === 0x0a && v === 0) ? null : v;
    }
    case 0x01: {
      const v = view.getInt8(at);
      return v === 0x7f ? null : v;
    }
    case 0x04:
    case 0x0b: {
      if (field.size < 2) return null;
      const v = view.getUint16(at, little);
      return v === 0xffff || (type === 0x0b && v === 0) ? null : v;
    }
    case 0x03: {
      if (field.size < 2) return null;
      const v = view.getInt16(at, little);
      return v === 0x7fff ? null : v;
    }
    case 0x06:
    case 0x0c: {
      if (field.size < 4) return null;
      const v = view.getUint32(at, little);
      return v === 0xffffffff || (type === 0x0c && v === 0) ? null : v;
    }
    case 0x05: {
      if (field.size < 4) return null;
      const v = view.getInt32(at, little);
      return v === 0x7fffffff ? null : v;
    }
    default:
      return null;
  }
}

const semicircles = (v: number) => (v * 180) / 2 ** 31;

/** Lit un FIT (déjà décompressé) ; lève une erreur si ce n'en est pas un. */
export function parseFit(bytes: Uint8Array): FitReading {
  if (bytes.length < 12) throw new Error('Fichier FIT trop court.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const headerSize = view.getUint8(0);
  const signature = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  if (signature !== '.FIT' || headerSize < 12) throw new Error('Ce n’est pas un fichier FIT.');
  const end = Math.min(bytes.length, headerSize + view.getUint32(4, true));

  const defs = new Map<number, Definition>();
  const points: TrackPoint[] = [];
  let session: FitSession | null = null;
  let lastTimestamp = 0;
  let at = headerSize;

  while (at < end) {
    const header = view.getUint8(at);
    at += 1;
    let local: number;
    let compressedOffset: number | null = null;

    if (header & 0x80) {
      // En-tête compressé : un message de données, et 5 bits de temps.
      local = (header >> 5) & 0x03;
      compressedOffset = header & 0x1f;
    } else if (header & 0x40) {
      // Définition.
      local = header & 0x0f;
      const hasDev = (header & 0x20) !== 0;
      const little = view.getUint8(at + 1) === 0;
      const global = view.getUint16(at + 2, little);
      const count = view.getUint8(at + 4);
      at += 5;
      const fields: FieldDef[] = [];
      for (let i = 0; i < count; i++) {
        fields.push({ num: view.getUint8(at), size: view.getUint8(at + 1), base: view.getUint8(at + 2) });
        at += 3;
      }
      let devSize = 0;
      if (hasDev) {
        const devCount = view.getUint8(at);
        at += 1;
        for (let i = 0; i < devCount; i++) {
          devSize += view.getUint8(at + 1);
          at += 3;
        }
      }
      defs.set(local, { global, little, fields, devSize });
      continue;
    } else {
      local = header & 0x0f;
    }

    const def = defs.get(local);
    if (!def) throw new Error('Fichier FIT incohérent : une donnée sans définition.');
    const values = new Map<number, number | null>();
    for (const field of def.fields) {
      values.set(field.num, readValue(view, at, field, def.little));
      at += field.size;
    }
    at += def.devSize;

    let timestamp = values.get(253) ?? null;
    if (compressedOffset !== null) {
      // Les 5 bits remplacent ceux du dernier instant connu ; un tour de plus s'ils reculent.
      timestamp = (lastTimestamp & ~0x1f) + compressedOffset + (compressedOffset < (lastTimestamp & 0x1f) ? 0x20 : 0);
    }
    if (timestamp !== null) lastTimestamp = timestamp;

    if (def.global === RECORD && timestamp !== null) {
      const point: TrackPoint = { t: FIT_EPOCH_MS + timestamp * 1000 };
      const dist = values.get(5);
      if (dist != null) point.dist = dist / 100;
      const hr = values.get(3);
      if (hr != null && hr > 0) point.hr = hr;
      const alt = values.get(78) ?? values.get(2);
      if (alt != null) point.ele = alt / 5 - 500;
      const lat = values.get(0);
      const lon = values.get(1);
      if (lat != null && lon != null) {
        point.lat = semicircles(lat);
        point.lon = semicircles(lon);
      }
      points.push(point);
    } else if (def.global === SESSION) {
      session = {
        avgHr: values.get(16) ?? null,
        maxHr: values.get(17) ?? null,
        ascentM: values.get(22) ?? null,
      };
    }
  }
  return { points, session };
}
