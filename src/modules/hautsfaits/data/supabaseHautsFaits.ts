import type { SupabaseClient } from '@supabase/supabase-js';
import { getClient, requireUserId, unwrap } from '../../../core/data/supabaseClient';
import {
  DEFAULT_HAUTSFAITS_SETTINGS,
  type DatePrecision,
  type Feat,
  type FeatCategory,
  type FeatInput,
  type FeatPatch,
  type HautsFaitsSettings,
} from '../lib/types';
import type { HautsFaitsBackup, HautsFaitsStore } from './hautsFaitsStore';

interface FeatRow {
  id: string;
  title: string;
  category: FeatCategory;
  date_start: string;
  date_precision: DatePrecision;
  date_end: string | null;
  date_end_precision: DatePrecision | null;
  major: boolean;
  highlight: string;
  place: string;
  people: string;
  story: string;
  created_at: string;
  updated_at: string;
}

const toFeat = (r: FeatRow): Feat => ({
  id: r.id,
  title: r.title,
  category: r.category,
  dateStart: r.date_start,
  datePrecision: r.date_precision,
  dateEnd: r.date_end,
  dateEndPrecision: r.date_end_precision,
  major: r.major,
  highlight: r.highlight,
  place: r.place,
  people: r.people,
  story: r.story,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/** Colonnes d'un haut fait, pour les seuls champs présents dans `patch`. */
function featColumns(patch: FeatPatch | FeatInput): Record<string, unknown> {
  const p = patch as FeatPatch;
  const row: Record<string, unknown> = {};
  if (p.title !== undefined) row.title = p.title;
  if (p.category !== undefined) row.category = p.category;
  if (p.dateStart !== undefined) row.date_start = p.dateStart;
  if (p.datePrecision !== undefined) row.date_precision = p.datePrecision;
  if (p.dateEnd !== undefined) row.date_end = p.dateEnd;
  if (p.dateEndPrecision !== undefined) row.date_end_precision = p.dateEndPrecision;
  if (p.major !== undefined) row.major = p.major;
  if (p.highlight !== undefined) row.highlight = p.highlight;
  if (p.place !== undefined) row.place = p.place;
  if (p.people !== undefined) row.people = p.people;
  if (p.story !== undefined) row.story = p.story;
  // Plus de fin : plus de précision de fin — sinon la base refuse.
  if (p.dateEnd === null) row.date_end_precision = null;
  return row;
}

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** Hauts faits stockés sur Supabase, protégés par le Row Level Security. */
export class SupabaseHautsFaits implements HautsFaitsStore {
  private client: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.client = getClient(url, anonKey);
  }

  private requireUserId(): Promise<string> {
    return requireUserId(this.client);
  }

  async listFeats(): Promise<Feat[]> {
    return (unwrap(await this.client.from('hautsfaits_feats').select('*').order('date_start', { ascending: false })) as FeatRow[]).map(toFeat);
  }

  async createFeat(input: FeatInput, id?: string): Promise<Feat> {
    const userId = await this.requireUserId();
    if (id) {
      // Rejouable : `on conflict do nothing` sur l'id, puis relecture — même
      // motif que les entrées de Cérès et les tâches.
      const { error } = await this.client
        .from('hautsfaits_feats')
        .upsert({ id, user_id: userId, ...featColumns(input) }, { onConflict: 'id', ignoreDuplicates: true });
      check(error);
      return toFeat(unwrap(await this.client.from('hautsfaits_feats').select('*').eq('id', id).single()) as FeatRow);
    }
    const row = unwrap(
      await this.client
        .from('hautsfaits_feats')
        .insert({ user_id: userId, ...featColumns(input) })
        .select()
        .single(),
    ) as FeatRow;
    return toFeat(row);
  }

  async updateFeat(id: string, patch: FeatPatch) {
    check(
      (await this.client.from('hautsfaits_feats').update({ ...featColumns(patch), updated_at: new Date().toISOString() }).eq('id', id))
        .error,
    );
  }

  async deleteFeat(id: string) {
    check((await this.client.from('hautsfaits_feats').delete().eq('id', id)).error);
  }

  async getSettings(): Promise<HautsFaitsSettings> {
    const { data, error } = await this.client.from('hautsfaits_settings').select('birth_date, on_this_day_reminder').maybeSingle();
    check(error);
    if (!data) return { ...DEFAULT_HAUTSFAITS_SETTINGS };
    return { birthDate: data.birth_date, onThisDayReminder: data.on_this_day_reminder };
  }

  async saveSettings(patch: Partial<HautsFaitsSettings>) {
    const userId = await this.requireUserId();
    const next = { ...(await this.getSettings()), ...patch };
    check(
      (
        await this.client.from('hautsfaits_settings').upsert(
          {
            user_id: userId,
            birth_date: next.birthDate,
            on_this_day_reminder: next.onThisDayReminder,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' },
        )
      ).error,
    );
  }

  async exportData(): Promise<HautsFaitsBackup> {
    return { feats: await this.listFeats(), settings: await this.getSettings() };
  }

  /**
   * Remplace tout, comme une restauration de sauvegarde. Les identifiants
   * sont gardés (des uuid choisis par l'application) : les photos, à
   * l'étape 4, retrouveront leur haut fait sans table de correspondance.
   */
  async importData(data: HautsFaitsBackup) {
    const userId = await this.requireUserId();
    check((await this.client.from('hautsfaits_feats').delete().eq('user_id', userId)).error);
    const feats = data.feats ?? [];
    if (feats.length > 0) {
      check((await this.client.from('hautsfaits_feats').insert(feats.map((f) => ({ id: f.id, user_id: userId, ...featColumns(f) })))).error);
    }
    if (data.settings) await this.saveSettings(data.settings);
  }
}
