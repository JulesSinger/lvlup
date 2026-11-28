import type { ShoppingService } from '../../../core/lib/services';
import { guessAisle } from '../lib/aisles';
import { findItemLoosely } from '../lib/catalog';
import { joinNote, mergeQuantity, NOTE_MAX, QUANTITY_MAX } from '../lib/listMerge';
import type { CoursesStore } from './coursesStore';

const NAME_MAX = 80;

/** Pour les tests et les appels d'avant le 28/11/2026, qui la prenaient ici. */
export { mergeQuantity };

/**
 * Le service `shopping` que Courses rend aux autres modules
 * (`core/lib/services.ts`, docs/etude-recettes.md §18) : Recettes y envoie
 * les ingrédients que Jules a choisis. Courses range avec ses propres
 * règles : article retrouvé par son nom (au pluriel près) ou créé dans son
 * rayon deviné, une seule ligne par article sur la liste.
 */
export function createShoppingService(store: CoursesStore): ShoppingService {
  return {
    async add(lines) {
      let added = 0;
      let merged = 0;
      const items = await store.listItems();
      for (const line of lines) {
        const name = line.name.trim().slice(0, NAME_MAX);
        if (!name) continue;
        let item = findItemLoosely(items, name);
        if (!item) {
          item = await store.createItem({ name, aisle: guessAisle(name) });
          items.push(item);
        }
        const entry = (await store.listEntries()).find((e) => e.itemId === item.id);
        if (entry) {
          const next = mergeQuantity(entry.quantity, line.quantity.trim(), entry.note);
          // Déjà dans le panier : on le décoche, il en faut encore.
          await store.updateEntry(entry.id, { quantity: next.quantity, note: joinNote(next.note, line.note), checked: false });
          merged += 1;
        } else {
          await store.addEntry(item.id, line.quantity.trim().slice(0, QUANTITY_MAX) || item.defaultQuantity, line.note.slice(0, NOTE_MAX));
          added += 1;
        }
      }
      return { added, merged };
    },
  };
}
