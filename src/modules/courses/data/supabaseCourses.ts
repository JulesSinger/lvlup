import type { SupabaseClient } from '@supabase/supabase-js';
import { getClient, requireUserId, unwrap } from '../../../core/data/supabaseClient';
import type {
  Aisle,
  ClosePlan,
  Item,
  ItemInput,
  ListEntry,
  ListEntryPatch,
  Store,
  Trip,
  TripItem,
} from '../lib/types';
import type { CoursesBackup, CoursesStore } from './coursesStore';

interface ItemRow {
  id: string;
  name: string;
  aisle: Aisle;
  recurrence: number | null;
  default_quantity: string;
  last_trip_number: number | null;
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
}

const toItem = (r: ItemRow): Item => ({
  id: r.id,
  name: r.name,
  aisle: r.aisle,
  recurrence: r.recurrence,
  defaultQuantity: r.default_quantity,
  lastTripNumber: r.last_trip_number,
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
});

/** Colonnes d'un article, pour les seuls champs présents dans `patch`. */
function itemColumns(patch: Partial<ItemInput>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.aisle !== undefined) row.aisle = patch.aisle;
  if (patch.recurrence !== undefined) row.recurrence = patch.recurrence;
  if (patch.defaultQuantity !== undefined) row.default_quantity = patch.defaultQuantity;
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
    return (unwrap(await this.client.from('courses_items').select('*')) as ItemRow[]).map(toItem);
  }

  async createItem(input: ItemInput): Promise<Item> {
    const userId = await this.requireUserId();
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

  async deleteItem(id: string) {
    // `on delete cascade` retire l'article de la liste ; `set null` le
    // détache de l'historique, qui garde son nom figé.
    check((await this.client.from('courses_items').delete().eq('id', id)).error);
  }

  async listStores(): Promise<Store[]> {
    return (unwrap(await this.client.from('courses_stores').select('*')) as StoreRow[]).map(toStore);
  }

  async createStore(name: string): Promise<Store> {
    const userId = await this.requireUserId();
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
    return (unwrap(await this.client.from('courses_list').select('*')) as EntryRow[]).map(toEntry);
  }

  async addEntry(itemId: string, quantity = '', note = ''): Promise<ListEntry> {
    const userId = await this.requireUserId();
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
    const rows = unwrap(
      await this.client.from('courses_trips').select('*').order('number', { ascending: false }),
    ) as TripRow[];
    return rows.map(toTrip);
  }

  async listTripItems(): Promise<TripItem[]> {
    return (unwrap(await this.client.from('courses_trip_items').select('*')) as TripItemRow[]).map(toTripItem);
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

  async exportData(): Promise<CoursesBackup> {
    return {
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
          })
        ).error,
      );
    }
  }
}
