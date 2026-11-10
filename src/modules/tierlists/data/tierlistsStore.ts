import type { ModuleDataStore } from '../../../core/lib/module';
import type { ImageSize, PreparedImage } from '../../../core/lib/images';
import type { ItemMove, Tier, TierInput, TierItem, ItemInput, TierList, TierListInput, TierPatch } from '../lib/types';

/** La part du module dans une sauvegarde. Les fichiers des images n'y sont pas (comme Recettes). */
export interface TierlistsBackup {
  lists: TierList[];
  tiers: Tier[];
  items: TierItem[];
}

/**
 * Le contrat de stockage de Tier lists, tenu par `LocalTierlists` (navigateur,
 * images dans IndexedDB) et `SupabaseTierlists` (tables `tierlists_*`, images
 * dans le bucket privé `tierlists`). Les écrans ne connaissent que lui.
 */
export interface TierlistsStore extends ModuleDataStore {
  listLists(): Promise<TierList[]>;
  /** Crée la liste et ses rangées de départ (S à D). */
  createList(input: TierListInput, id?: string): Promise<{ list: TierList; tiers: Tier[] }>;
  updateList(id: string, patch: Partial<TierListInput>): Promise<void>;
  /** La liste, ses rangées, ses éléments et les fichiers de leurs images. */
  deleteList(id: string): Promise<void>;

  listTiers(listId: string): Promise<Tier[]>;
  createTier(input: TierInput, id?: string): Promise<Tier>;
  updateTiers(patches: { id: string; patch: TierPatch }[]): Promise<void>;
  /** Ses éléments doivent être partis avant (`evacuatePlan`) ; sinon ils tombent dans la réserve. */
  deleteTier(id: string): Promise<void>;

  listItems(listId: string): Promise<TierItem[]>;
  /** Un élément, avec ou sans image ; l'image est envoyée avant que la ligne existe. */
  createItem(input: ItemInput, image?: PreparedImage, id?: string): Promise<TierItem>;
  updateItemLabel(id: string, label: string): Promise<void>;
  deleteItem(item: TierItem): Promise<void>;
  moveItems(moves: ItemMove[]): Promise<void>;
  imageBlob(item: TierItem, size: ImageSize): Promise<Blob>;

  exportData(): Promise<TierlistsBackup>;
  importData(data: TierlistsBackup): Promise<void>;
}
