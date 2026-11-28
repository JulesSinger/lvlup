import { newId } from '../../../core/data/coreStore';
import { readRaw, writeRaw } from '../../../core/data/localSnapshot';
import type {
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

interface Snapshot extends CoursesBackup {
  templates: ListTemplate[];
  templateLines: TemplateLine[];
}

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
    templates: arrayOf<ListTemplate>(raw.coursesTemplates),
    templateLines: arrayOf<TemplateLine>(raw.coursesTemplateLines),
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
    coursesTemplates: s.templates,
    coursesTemplateLines: s.templateLines,
  });
}

const now = () => new Date().toISOString();

/** Les bornes de `courses_templates_name_check`. */
function checkName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Donne un nom au modèle.');
  if (trimmed.length > 80) throw new Error('80 caractères au plus pour le nom du modèle.');
  return trimmed;
}

/** Comète stockée dans le navigateur, sans compte ni serveur. */
export class LocalCourses implements CoursesStore {
  async listItems(): Promise<Item[]> {
    return read().items.slice();
  }

  async createItem(input: ItemInput, id: string = newId()): Promise<Item> {
    const s = read();
    const existing = s.items.find((i) => i.id === id);
    if (existing) return existing; // rejoué : rien de plus
    const item: Item = {
      id,
      name: input.name,
      aisle: input.aisle ?? 'autre',
      recurrence: input.recurrence ?? null,
      defaultQuantity: input.defaultQuantity ?? '',
      lastTripNumber: null,
      typology: input.typology ?? null,
      foodKind: input.foodKind ?? null,
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

  async classifyTripItem(id: string, typology: Typology | null, foodKind: FoodKind | null) {
    const s = read();
    const line = s.tripItems.find((t) => t.id === id);
    if (!line) return;
    line.typology = typology;
    line.foodKind = typology === 'alimentation' ? foodKind : null;
    write(s);
  }

  async deleteItem(id: string) {
    const s = read();
    s.items = s.items.filter((i) => i.id !== id);
    // Comme côté base : `on delete cascade` sur la liste, `set null` sur
    // l'historique, qui garde le nom figé.
    s.list = s.list.filter((e) => e.itemId !== id);
    s.templateLines = s.templateLines.filter((l) => l.itemId !== id);
    for (const ti of s.tripItems) if (ti.itemId === id) ti.itemId = null;
    write(s);
  }

  async listStores(): Promise<Store[]> {
    return read().stores.slice();
  }

  async createStore(name: string, id: string = newId()): Promise<Store> {
    const s = read();
    const existing = s.stores.find((st) => st.id === id);
    if (existing) return existing;
    const store: Store = { id, name, createdAt: now() };
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

  async addEntry(itemId: string, quantity = '', note = '', id: string = newId()): Promise<ListEntry> {
    const s = read();
    const existing = s.list.find((e) => e.id === id);
    if (existing) return existing;
    const entry: ListEntry = {
      id,
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

  async listTemplates(): Promise<ListTemplate[]> {
    return read().templates.slice().sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt));
  }

  async listTemplateLines(): Promise<TemplateLine[]> {
    return read().templateLines.slice();
  }

  async createTemplate(name: string, emoji = '📋', id: string = newId()): Promise<ListTemplate> {
    const s = read();
    const existing = s.templates.find((t) => t.id === id);
    if (existing) return existing;
    const template: ListTemplate = { id, name: checkName(name), emoji: emoji || '📋', position: s.templates.reduce((m, t) => Math.max(m, t.position + 1), 0), createdAt: now() };
    s.templates.push(template);
    write(s);
    return template;
  }

  async updateTemplate(id: string, patch: TemplatePatch) {
    const s = read();
    const template = s.templates.find((t) => t.id === id);
    if (!template) return;
    Object.assign(template, patch.name !== undefined ? { ...patch, name: checkName(patch.name) } : patch);
    write(s);
  }

  async deleteTemplate(id: string) {
    const s = read();
    s.templates = s.templates.filter((t) => t.id !== id);
    s.templateLines = s.templateLines.filter((l) => l.templateId !== id);
    write(s);
  }

  async addTemplateLine(templateId: string, itemId: string, quantity = '', note = '', id: string = newId()): Promise<TemplateLine> {
    const s = read();
    const existing = s.templateLines.find((l) => l.id === id);
    if (existing) return existing;
    // Comme les clés étrangères côté base.
    if (!s.templates.some((t) => t.id === templateId)) throw new Error('Ce modèle n’existe plus.');
    if (!s.items.some((i) => i.id === itemId)) throw new Error('Cet article n’existe plus.');
    const line: TemplateLine = {
      id,
      templateId,
      itemId,
      quantity: quantity.slice(0, 30),
      note: note.slice(0, 200),
      position: s.templateLines.filter((l) => l.templateId === templateId).reduce((m, l) => Math.max(m, l.position + 1), 0),
    };
    s.templateLines.push(line);
    write(s);
    return line;
  }

  async updateTemplateLine(id: string, patch: TemplateLinePatch) {
    const s = read();
    const line = s.templateLines.find((l) => l.id === id);
    if (!line) return;
    Object.assign(line, patch);
    write(s);
  }

  async removeTemplateLine(id: string) {
    const s = read();
    s.templateLines = s.templateLines.filter((l) => l.id !== id);
    write(s);
  }

  async exportData(): Promise<CoursesBackup> {
    const s = read();
    return {
      templates: s.templates.slice(),
      templateLines: s.templateLines.slice(),
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
      templates: data.templates ?? [],
      templateLines: data.templateLines ?? [],
    });
  }
}
