import { newId } from '../../../core/data/coreStore';
import { readRaw, writeRaw } from '../../../core/data/localSnapshot';
import { DEFAULT_HAUTSFAITS_SETTINGS, type Feat, type FeatInput, type FeatPatch, type HautsFaitsSettings } from '../lib/types';
import type { HautsFaitsBackup, HautsFaitsStore } from './hautsFaitsStore';

const arrayOf = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

interface Snapshot {
  feats: Feat[];
  settings: HautsFaitsSettings;
}

/** Lecture des seules sections du module, sur le blob local partagé. */
function read(): Snapshot {
  const raw = readRaw();
  const settings = raw.hautsfaitsSettings as Partial<HautsFaitsSettings> | undefined;
  return {
    feats: arrayOf<Feat>(raw.hautsfaitsFeats),
    settings: { ...DEFAULT_HAUTSFAITS_SETTINGS, ...settings },
  };
}

/** Écriture par fusion : les sections des autres modules sont préservées. */
function write(s: Snapshot) {
  writeRaw({ ...readRaw(), hautsfaitsFeats: s.feats, hautsfaitsSettings: s.settings });
}

/** Une fin sans précision n'existe pas, et inversement — comme la contrainte côté base. */
function normalized(feat: Feat): Feat {
  if (feat.dateEnd === null) return { ...feat, dateEndPrecision: null };
  return { ...feat, dateEndPrecision: feat.dateEndPrecision ?? feat.datePrecision };
}

/** Hauts faits stockés dans le navigateur, sans compte ni serveur. */
export class LocalHautsFaits implements HautsFaitsStore {
  async listFeats(): Promise<Feat[]> {
    return read().feats.slice();
  }

  async createFeat(input: FeatInput, id: string = newId()): Promise<Feat> {
    const s = read();
    const existing = s.feats.find((f) => f.id === id);
    if (existing) return existing; // rejoué : rien de plus
    const now = new Date().toISOString();
    const feat = normalized({
      id,
      title: input.title,
      category: input.category,
      dateStart: input.dateStart,
      datePrecision: input.datePrecision,
      dateEnd: input.dateEnd ?? null,
      dateEndPrecision: input.dateEndPrecision ?? null,
      major: input.major ?? false,
      highlight: input.highlight ?? '',
      place: input.place ?? '',
      people: input.people ?? '',
      story: input.story ?? '',
      createdAt: now,
      updatedAt: now,
    });
    s.feats.push(feat);
    write(s);
    return feat;
  }

  async updateFeat(id: string, patch: FeatPatch) {
    const s = read();
    const i = s.feats.findIndex((f) => f.id === id);
    if (i < 0) return;
    s.feats[i] = normalized({ ...s.feats[i], ...patch, updatedAt: new Date().toISOString() });
    write(s);
  }

  async deleteFeat(id: string) {
    const s = read();
    s.feats = s.feats.filter((f) => f.id !== id);
    write(s);
  }

  async getSettings(): Promise<HautsFaitsSettings> {
    return read().settings;
  }

  async saveSettings(patch: Partial<HautsFaitsSettings>) {
    const s = read();
    s.settings = { ...s.settings, ...patch };
    write(s);
  }

  async exportData(): Promise<HautsFaitsBackup> {
    const s = read();
    return { feats: s.feats.slice(), settings: s.settings };
  }

  async importData(data: HautsFaitsBackup) {
    write({ feats: data.feats ?? [], settings: { ...DEFAULT_HAUTSFAITS_SETTINGS, ...data.settings } });
  }
}
