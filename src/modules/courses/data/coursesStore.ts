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

/**
 * La part du module dans une sauvegarde. Le socle n'en connaît pas la
 * forme : il se contente d'assembler les sections que les modules lui
 * donnent (voir `core/data/backup.ts`).
 */
export interface CoursesBackup {
  items: Item[];
  stores: Store[];
  list: ListEntry[];
  trips: Trip[];
  tripItems: TripItem[];
}

/** Contrat de stockage du module courses (Comète). */
export interface CoursesStore {
  listItems(): Promise<Item[]>;
  createItem(input: ItemInput): Promise<Item>;
  updateItem(id: string, patch: Partial<ItemInput>): Promise<void>;
  /** Retire aussi l'article de la liste en cours ; l'historique le garde, figé. */
  deleteItem(id: string): Promise<void>;

  listStores(): Promise<Store[]>;
  createStore(name: string): Promise<Store>;
  renameStore(id: string, name: string): Promise<void>;
  /** Les courses passées gardent le nom figé du magasin. */
  deleteStore(id: string): Promise<void>;

  /** La liste en cours. */
  listEntries(): Promise<ListEntry[]>;
  addEntry(itemId: string, quantity?: string, note?: string): Promise<ListEntry>;
  updateEntry(id: string, patch: ListEntryPatch): Promise<void>;
  removeEntry(id: string): Promise<void>;

  /** Les courses faites, de la plus récente à la plus ancienne. */
  listTrips(): Promise<Trip[]>;
  /** Ce qui a été acheté, toutes courses confondues. */
  listTripItems(): Promise<TripItem[]>;
  /**
   * Termine une course d'un bloc : tout le plan s'applique, ou rien
   * (transaction côté Supabase). Un numéro de course déjà pris est refusé —
   * une même course ne peut pas être enregistrée deux fois.
   */
  closeTrip(plan: ClosePlan): Promise<Trip>;
  /** Supprime une course et ce qui y a été acheté ; la liste n'est pas touchée. */
  deleteTrip(id: string): Promise<void>;

  /** Sa section de la sauvegarde — le socle ne fait que l'assembler. */
  exportData(): Promise<CoursesBackup>;
  importData(data: CoursesBackup): Promise<void>;
}
