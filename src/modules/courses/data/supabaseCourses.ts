import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchAll, getClient, requireUserId, unwrap } from '../../../core/data/supabaseClient';
import type {
  Aisle,
  ClosePlan,
  Item,
  ItemInput,
  ListEntry,
  ListEntryPatch,
  ListTemplate,
  Store,
  TemplateLine,
  TemplateLinePatch,
  TemplatePatch,
  Trip,
  TripItem,
} from '../lib/types';
import type { FoodKind, Typology } from '../lib/typology';
import type { CoursesBackup, CoursesStore } from './coursesStore';

interface ItemRow {
  id: string;
  name: string;
  aisle: Aisle;
  recurrence: number | null;
  default_quantity: string;
  last_trip_number: number | null;
  typology?: Typology | null;
  food_kind?: FoodKind | null;
  created_at: string;
}

interface StoreRow {
  id: string;
  name: string;
  created_at: string;
}

interface EntryRow {
  id: string;
  item_id: string;
  quantity: string;
  note: string;
  checked: boolean;
  price_cents: number | null;
  created_at: string;
}

interface TripRow {
  id: string;
  number: number;
  day: string;
  store_id: string | null;
  store_name: string;
  total_cents: number;
  note: string;
  created_at: string;
}

interface TripItemRow {
  id: string;
  trip_id: string;
  item_id: string | null;
  name: string;
  aisle: Aisle;
  quantity: string;
  price_cents: number | null;
  typology?: Typology | null;
  food_kind?: FoodKind | null;
}

interface TemplateRow {
  id: string;
  name: string;
  emoji: string;
  position: number;
  created_at: string;
}

interface TemplateLineRow {
  id: string;
  template_id: string;
  item_id: string;
  quantity: string;
  note: string;
  position: number;
}

const toTemplate = (r: TemplateRow): ListTemplate => ({ id: r.id, name: r.name, emoji: r.emoji, position: r.position, createdAt: r.created_at });

const toTemplateLine = (r: TemplateLineRow): TemplateLine => ({
  id: r.id,
  templateId: r.template_id,
  itemId: r.item_id,
  quantity: r.quantity,
  note: r.note,
  position: r.position,
});

/** Les bornes de `courses_templates_name_check`, dites lisiblement plutôt qu'un refus de Postgres. */
function checkName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Donne un nom au modèle.');
  if (trimmed.length > 80) throw new Error('80 caractères au plus pour le nom du modèle.');
  return trimmed;
}

const toItem = (r: ItemRow): Item => ({
  id: r.id,
  name: r.name,
  aisle: r.aisle,
  recurrence: r.recurrence,
  defaultQuantity: r.default_quantity,
  lastTripNumber: r.last_trip_number,
  typology: r.typology ?? null,
  foodKind: r.food_kind ?? null,
  createdAt: r.created_at,
});

const toStore = (r: StoreRow): Store => ({ id: r.id, name: r.name, createdAt: r.created_at });

const toEntry = (r: EntryRow): ListEntry => ({
  id: r.id,
  itemId: r.item_id,
  quantity: r.quantity,
  note: r.note,
  checked: r.checked,
  priceCents: r.price_cents,
  createdAt: r.created_at,
});

const toTrip = (r: TripRow): Trip => ({
  id: r.id,
  number: r.number,
  day: r.day,
  storeId: r.store_id,
  storeName: r.store_name,
  totalCents: r.total_cents,
  note: r.note,
  createdAt: r.created_at,
});

const toTripItem = (r: TripItemRow): TripItem => ({
  id: r.id,
  tripId: r.trip_id,
  itemId: r.item_id,
  name: r.name,
  aisle: r.aisle,
  quantity: r.quantity,
  priceCents: r.price_cents,
  typology: r.typology ?? null,
  foodKind: r.food_kind ?? null,
});

/** Colonnes d'un article, pour les seuls champs présents dans `patch`. */
function itemColumns(patch: Partial<ItemInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.aisle !== undefined) row.aisle = patch.aisle;
  if (patch.recurrence !== undefined) row.recurrence = patch.recurrence;
  if (patch.defaultQuantity !== undefined) row.default_quantity = patch.defaultQuantity;
  if (patch.typology !== undefined) row.typology = patch.typology;
  // Un sous-type n'a de sens que pour l'alimentation (la base le refuse ailleurs).
  if (patch.foodKind !== undefined || patch.typology !== undefined) row.food_kind = patch.typology === undefined || patch.typology === 'alimentation' ? (patch.foodKind ?? null) : null;
  return row;
}

function entryColumns(patch: ListEntryPatch): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.quantity !== undefined) row.quantity = patch.quantity;
  if (patch.note !== undefined) row.note = patch.note;
  if (patch.checked !== undefined) row.checked = patch.checked;
  if (patch.priceCents !== undefined) row.price_cents = patch.priceCents;
  return row;
}

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

/** Comète stockée sur Supabase, protégée par le Row Level Security. */
export class SupabaseCourses implements CoursesStore {
  private client: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.client = getClient(url, anonKey);
  }

  private requireUserId(): Promise<string> {
    return requireUserId(this.client);
  }

  async listItems(): Promise<Item[]> {
    return (
      await fetchAll<ItemRow>((first, last) =>
        this.client.from('courses_items').select('*').order('id').range(first, last),
      )
    ).map(toItem);
  }

  async createItem(input: ItemInput, id?: string): Promise<Item> {
    const userId = await this.requireUserId();
    if (id) {
      // Rejouable (hors ligne) : déjà là, l'envoi ne fait rien, et on relit.
      check((await this.client.from('courses_items').upsert({ id, user_id: userId, ...itemColumns(input) }, { onConflict: 'id', ignoreDuplicates: true })).error);
      return toItem(unwrap(await this.client.from('courses_items').select('*').eq('id', id).single()) as ItemRow);
    }
    const row = unwrap(
      await this.client
        .from('courses_items')
        .insert({ user_id: userId, ...itemColumns(input) })
        .select()
        .single(),
    ) as ItemRow;
    return toItem(row);
  }

  async updateItem(id: string, patch: Partial<ItemInput>) {
    check((await this.client.from('courses_items').update(itemColumns(patch)).eq('id', id)).error);
  }

  async classifyTripItem(id: string, typology: Typology | null, foodKind: FoodKind | null) {
    check(
      (await this.client.from('courses_trip_items').update({ typology, food_kind: typology === 'alimentation' ? foodKind : null }).eq('id', id)).error,
    );
  }

  async deleteItem(id: string) {
    // `on delete cascade` retire l'article de la liste ; `set null` le
    // détache de l'historique, qui garde son nom figé.
    check((await this.client.from('courses_items').delete().eq('id', id)).error);
  }

  async listStores(): Promise<Store[]> {
    return (
      await fetchAll<StoreRow>((first, last) =>
        this.client.from('courses_stores').select('*').order('id').range(first, last),
      )
    ).map(toStore);
  }

  async createStore(name: string, id?: string): Promise<Store> {
    const userId = await this.requireUserId();
    if (id) {
      check((await this.client.from('courses_stores').upsert({ id, user_id: userId, name }, { onConflict: 'id', ignoreDuplicates: true })).error);
      return toStore(unwrap(await this.client.from('courses_stores').select('*').eq('id', id).single()) as StoreRow);
    }
    const row = unwrap(
      await this.client.from('courses_stores').insert({ user_id: userId, name }).select().single(),
    ) as StoreRow;
    return toStore(row);
  }

  async renameStore(id: string, name: string) {
    check((await this.client.from('courses_stores').update({ name }).eq('id', id)).error);
  }

  async deleteStore(id: string) {
    check((await this.client.from('courses_stores').delete().eq('id', id)).error);
  }

  async listEntries(): Promise<ListEntry[]> {
    return (
      await fetchAll<EntryRow>((first, last) =>
        this.client.from('courses_list').select('*').order('id').range(first, last),
      )
    ).map(toEntry);
  }

  async addEntry(itemId: string, quantity = '', note = '', id?: string): Promise<ListEntry> {
    const userId = await this.requireUserId();
    if (id) {
      check(
        (await this.client.from('courses_list').upsert({ id, user_id: userId, item_id: itemId, quantity, note }, { onConflict: 'id', ignoreDuplicates: true }))
          .error,
      );
      return toEntry(unwrap(await this.client.from('courses_list').select('*').eq('id', id).single()) as EntryRow);
    }
    const row = unwrap(
      await this.client
        .from('courses_list')
        .insert({ user_id: userId, item_id: itemId, quantity, note })
        .select()
        .single(),
    ) as EntryRow;
    return toEntry(row);
  }

  async updateEntry(id: string, patch: ListEntryPatch) {
    check((await this.client.from('courses_list').update(entryColumns(patch)).eq('id', id)).error);
  }

  async removeEntry(id: string) {
    check((await this.client.from('courses_list').delete().eq('id', id)).error);
  }

  async listTrips(): Promise<Trip[]> {
    const rows = await fetchAll<TripRow>((first, last) =>
      this.client.from('courses_trips').select('*').order('number', { ascending: false }).order('id').range(first, last),
    );
    return rows.map(toTrip);
  }

  async listTripItems(): Promise<TripItem[]> {
    return (
      await fetchAll<TripItemRow>((first, last) =>
        this.client.from('courses_trip_items').select('*').order('id').range(first, last),
      )
    ).map(toTripItem);
  }

  /**
   * Une seule requête : la fonction `courses_close_trip` applique tout le
   * plan dans une transaction (migration du 25/09/2026). Rien ne peut rester
   * à moitié écrit, et un numéro de course déjà pris est refusé par la base.
   */
  async closeTrip(plan: ClosePlan): Promise<Trip> {
    const row = unwrap(await this.client.rpc('courses_close_trip', { plan })) as TripRow;
    return toTrip(row);
  }

  async deleteTrip(id: string) {
    // `on delete cascade` emporte ce qui y a été acheté.
    check((await this.client.from('courses_trips').delete().eq('id', id)).error);
  }

  async listTemplates(): Promise<ListTemplate[]> {
    return (
      await fetchAll<TemplateRow>((first, last) =>
        this.client.from('courses_templates').select('*').order('position').order('id').range(first, last),
      )
    ).map(toTemplate);
  }

  async listTemplateLines(): Promise<TemplateLine[]> {
    return (
      await fetchAll<TemplateLineRow>((first, last) =>
        this.client.from('courses_template_lines').select('*').order('position').order('id').range(first, last),
      )
    ).map(toTemplateLine);
  }

  async createTemplate(name: string, emoji = '📋', id?: string): Promise<ListTemplate> {
    const userId = await this.requireUserId();
    const position = (await this.listTemplates()).reduce((m, t) => Math.max(m, t.position + 1), 0);
    const row = { user_id: userId, name: checkName(name), emoji: emoji || '📋', position };
    if (id) {
      check((await this.client.from('courses_templates').upsert({ id, ...row }, { onConflict: 'id', ignoreDuplicates: true })).error);
      return toTemplate(unwrap(await this.client.from('courses_templates').select('*').eq('id', id).single()) as TemplateRow);
    }
    return toTemplate(unwrap(await this.client.from('courses_templates').insert(row).select().single()) as TemplateRow);
  }

  async updateTemplate(id: string, patch: TemplatePatch) {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = checkName(patch.name);
    if (patch.emoji !== undefined) row.emoji = patch.emoji || '📋';
    if (patch.position !== undefined) row.position = patch.position;
    check((await this.client.from('courses_templates').update(row).eq('id', id)).error);
  }

  async deleteTemplate(id: string) {
    // `on delete cascade` emporte ses lignes.
    check((await this.client.from('courses_templates').delete().eq('id', id)).error);
  }

  async addTemplateLine(templateId: string, itemId: string, quantity = '', note = '', id?: string): Promise<TemplateLine> {
    const userId = await this.requireUserId();
    const position = (await this.listTemplateLines()).filter((l) => l.templateId === templateId).reduce((m, l) => Math.max(m, l.position + 1), 0);
    const row = { user_id: userId, template_id: templateId, item_id: itemId, quantity: quantity.slice(0, 30), note: note.slice(0, 200), position };
    if (id) {
      check((await this.client.from('courses_template_lines').upsert({ id, ...row }, { onConflict: 'id', ignoreDuplicates: true })).error);
      return toTemplateLine(unwrap(await this.client.from('courses_template_lines').select('*').eq('id', id).single()) as TemplateLineRow);
    }
    return toTemplateLine(unwrap(await this.client.from('courses_template_lines').insert(row).select().single()) as TemplateLineRow);
  }

  async updateTemplateLine(id: string, patch: TemplateLinePatch) {
    const row: Record<string, unknown> = {};
    if (patch.quantity !== undefined) row.quantity = patch.quantity;
    if (patch.note !== undefined) row.note = patch.note;
    if (patch.position !== undefined) row.position = patch.position;
    check((await this.client.from('courses_template_lines').update(row).eq('id', id)).error);
  }

  async removeTemplateLine(id: string) {
    check((await this.client.from('courses_template_lines').delete().eq('id', id)).error);
  }

  async exportData(): Promise<CoursesBackup> {
    // Les modèles à part : une base sans la migration du 28/11/2026 n'en a pas.
    const [templates, templateLines] = await Promise.all([this.listTemplates().catch(() => []), this.listTemplateLines().catch(() => [])]);
    return {
      templates,
      templateLines,
      items: await this.listItems(),
      stores: await this.listStores(),
      list: await this.listEntries(),
      trips: await this.listTrips(),
      tripItems: await this.listTripItems(),
    };
  }

  /**
   * Remplace tout : plus simple et plus sûr qu'une fusion ligne à ligne,
   * cohérent avec le sens d'une restauration de sauvegarde. Les ids changent
   * à l'import (Supabase les régénère) : on reconstitue les correspondances
   * avant de réinsérer ce qui en dépend — la liste après le catalogue, les
   * courses après les magasins, leurs articles en dernier.
   */
  async importData(data: CoursesBackup) {
    const userId = await this.requireUserId();
    // Les modèles d'abord ; une base sans leur migration n'en a pas, et c'est
    // seulement grave si la sauvegarde en apporte.
    const wipeTemplates = (await this.client.from('courses_templates').delete().eq('user_id', userId)).error;
    if (wipeTemplates && (data.templates ?? []).length > 0) throw new Error(wipeTemplates.message);
    for (const table of ['courses_trip_items', 'courses_trips', 'courses_list', 'courses_items', 'courses_stores']) {
      check((await this.client.from(table).delete().eq('user_id', userId)).error);
    }

    const itemIds = new Map<string, string>();
    for (const item of data.items ?? []) {
      const row = unwrap(
        await this.client
          .from('courses_items')
          .insert({ user_id: userId, ...itemColumns(item), last_trip_number: item.lastTripNumber })
          .select('id')
          .single(),
      ) as { id: string };
      itemIds.set(item.id, row.id);
    }

    const storeIds = new Map<string, string>();
    for (const store of data.stores ?? []) {
      const row = unwrap(
        await this.client.from('courses_stores').insert({ user_id: userId, name: store.name }).select('id').single(),
      ) as { id: string };
      storeIds.set(store.id, row.id);
    }

    for (const entry of data.list ?? []) {
      const itemId = itemIds.get(entry.itemId);
      if (!itemId) continue; // article disparu : la ligne n'a plus de sens
      check(
        (
          await this.client
            .from('courses_list')
            .insert({ user_id: userId, item_id: itemId, ...entryColumns(entry) })
        ).error,
      );
    }

    const tripIds = new Map<string, string>();
    for (const trip of data.trips ?? []) {
      const row = unwrap(
        await this.client
          .from('courses_trips')
          .insert({
            user_id: userId,
            number: trip.number,
            day: trip.day,
            store_id: trip.storeId ? (storeIds.get(trip.storeId) ?? null) : null,
            store_name: trip.storeName,
            total_cents: trip.totalCents,
            note: trip.note,
          })
          .select('id')
          .single(),
      ) as { id: string };
      tripIds.set(trip.id, row.id);
    }

    for (const ti of data.tripItems ?? []) {
      const tripId = tripIds.get(ti.tripId);
      if (!tripId) continue;
      check(
        (
          await this.client.from('courses_trip_items').insert({
            user_id: userId,
            trip_id: tripId,
            item_id: ti.itemId ? (itemIds.get(ti.itemId) ?? null) : null,
            name: ti.name,
            aisle: ti.aisle,
            quantity: ti.quantity,
            price_cents: ti.priceCents,
            typology: ti.typology ?? null,
            food_kind: ti.foodKind ?? null,
          })
        ).error,
      );
    }

    const templateIds = new Map<string, string>();
    for (const t of data.templates ?? []) {
      const row = unwrap(
        await this.client.from('courses_templates').insert({ user_id: userId, name: t.name, emoji: t.emoji, position: t.position }).select('id').single(),
      ) as { id: string };
      templateIds.set(t.id, row.id);
    }
    for (const l of data.templateLines ?? []) {
      const templateId = templateIds.get(l.templateId);
      const itemId = itemIds.get(l.itemId);
      if (!templateId || !itemId) continue;
      check(
        (
          await this.client
            .from('courses_template_lines')
            .insert({ user_id: userId, template_id: templateId, item_id: itemId, quantity: l.quantity, note: l.note, position: l.position })
        ).error,
      );
    }
  }
}
