import { newId } from '../../../core/data/coreStore';
import { readRaw, writeRaw } from '../../../core/data/localSnapshot';
import type {
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

interface Snapshot extends CoursesBackup {}

const arrayOf = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

/** Lecture des seules sections du module, sur le blob local partagé. */
function read(): Snapshot {
  const raw = readRaw();
  return {
    items: arrayOf<Item>(raw.coursesItems),
    stores: arrayOf<Store>(raw.coursesStores),
    list: arrayOf<ListEntry>(raw.coursesList),
    trips: arrayOf<Trip>(raw.coursesTrips),
    tripItems: arrayOf<TripItem>(raw.coursesTripItems),
  };
}

/** Écriture par fusion : les sections des autres modules sont préservées. */
function write(s: Snapshot) {
  writeRaw({
    ...readRaw(),
    coursesItems: s.items,
    coursesStores: s.stores,
    coursesList: s.list,
    coursesTrips: s.trips,
    coursesTripItems: s.tripItems,
  });
}

const now = () => new Date().toISOString();

/** Comète stockée dans le navigateur, sans compte ni serveur. */
export class LocalCourses implements CoursesStore {
  async listItems(): Promise<Item[]> {
    return read().items.slice();
  }

  async createItem(input: ItemInput): Promise<Item> {
    const s = read();
    const item: Item = {
      id: newId(),
      name: input.name,
      aisle: input.aisle ?? 'autre',
      recurrence: input.recurrence ?? null,
      defaultQuantity: input.defaultQuantity ?? '',
      lastTripNumber: null,
      createdAt: now(),
    };
    s.items.push(item);
    write(s);
    return item;
  }

  async updateItem(id: string, patch: Partial<ItemInput>) {
    const s = read();
    const item = s.items.find((i) => i.id === id);
    if (!item) return;
    Object.assign(item, patch);
    write(s);
  }

  async deleteItem(id: string) {
    const s = read();
    s.items = s.items.filter((i) => i.id !== id);
    // Comme côté base : `on delete cascade` sur la liste, `set null` sur
    // l'historique, qui garde le nom figé.
    s.list = s.list.filter((e) => e.itemId !== id);
    for (const ti of s.tripItems) if (ti.itemId === id) ti.itemId = null;
    write(s);
  }

  async listStores(): Promise<Store[]> {
    return read().stores.slice();
  }

  async createStore(name: string): Promise<Store> {
    const s = read();
    const store: Store = { id: newId(), name, createdAt: now() };
    s.stores.push(store);
    write(s);
    return store;
  }

  async renameStore(id: string, name: string) {
    const s = read();
    const store = s.stores.find((st) => st.id === id);
    if (!store) return;
    store.name = name;
    write(s);
  }

  async deleteStore(id: string) {
    const s = read();
    s.stores = s.stores.filter((st) => st.id !== id);
    for (const t of s.trips) if (t.storeId === id) t.storeId = null;
    write(s);
  }

  async listEntries(): Promise<ListEntry[]> {
    return read().list.slice();
  }

  async addEntry(itemId: string, quantity = '', note = ''): Promise<ListEntry> {
    const s = read();
    const entry: ListEntry = {
      id: newId(),
      itemId,
      quantity,
      note,
      checked: false,
      priceCents: null,
      createdAt: now(),
    };
    s.list.push(entry);
    write(s);
    return entry;
  }

  async updateEntry(id: string, patch: ListEntryPatch) {
    const s = read();
    const entry = s.list.find((e) => e.id === id);
    if (!entry) return;
    Object.assign(entry, patch);
    write(s);
  }

  async removeEntry(id: string) {
    const s = read();
    s.list = s.list.filter((e) => e.id !== id);
    write(s);
  }

  async listTrips(): Promise<Trip[]> {
    return read().trips.slice().sort((a, b) => b.number - a.number);
  }

  async listTripItems(): Promise<TripItem[]> {
    return read().tripItems.slice();
  }

  /**
   * Tout le plan dans une seule écriture du blob local : l'équivalent de la
   * transaction `courses_close_trip` côté Supabase.
   */
  async closeTrip(plan: ClosePlan): Promise<Trip> {
    const s = read();
    if (s.trips.some((t) => t.number === plan.trip.number)) {
      // Même règle que la contrainte unique côté base.
      throw new Error('Cette course est déjà enregistrée.');
    }
    const trip: Trip = { ...plan.trip, id: newId(), createdAt: now() };
    s.trips.push(trip);
    for (const ti of plan.items) s.tripItems.push({ ...ti, id: newId(), tripId: trip.id });

    const purchased = new Set(plan.purchasedItemIds);
    for (const item of s.items) if (purchased.has(item.id)) item.lastTripNumber = trip.number;

    const removed = new Set(plan.removeEntryIds);
    s.list = s.list.filter((e) => !removed.has(e.id));

    const onList = new Set(s.list.map((e) => e.itemId));
    for (const itemId of plan.addItemIds) {
      const item = s.items.find((i) => i.id === itemId);
      if (!item || onList.has(itemId)) continue; // jamais deux fois sur la liste
      s.list.push({
        id: newId(),
        itemId,
        quantity: item.defaultQuantity,
        note: '',
        checked: false,
        priceCents: null,
        createdAt: now(),
      });
      onList.add(itemId);
    }

    write(s);
    return trip;
  }

  async deleteTrip(id: string) {
    const s = read();
    s.trips = s.trips.filter((t) => t.id !== id);
    s.tripItems = s.tripItems.filter((ti) => ti.tripId !== id);
    write(s);
  }

  async exportData(): Promise<CoursesBackup> {
    const s = read();
    return {
      items: s.items.slice(),
      stores: s.stores.slice(),
      list: s.list.slice(),
      trips: s.trips.slice(),
      tripItems: s.tripItems.slice(),
    };
  }

  async importData(data: CoursesBackup) {
    write({
      items: data.items ?? [],
      stores: data.stores ?? [],
      list: data.list ?? [],
      trips: data.trips ?? [],
      tripItems: data.tripItems ?? [],
    });
  }
}
