import type { ExpenseRequest, ExpenseService } from '../../../core/lib/services';
import type { BudgetStore } from './budgetStore';

/**
 * Le service « dépenses » qu'Astra rend aux autres modules
 * (`core/lib/services.ts`) — né pour Comète : chaque course terminée devient
 * une dépense du budget (docs/etude-courses.md §18).
 *
 * La référence du demandeur (« comete:course:12 ») est rangée dans
 * `import_key`, la colonne qui rend déjà l'import bancaire rejouable sans
 * doublon (index unique `(user_id, import_key)`) : même garantie, sans
 * migration. Les empreintes bancaires ne portent jamais de préfixe
 * « module: », les deux ne peuvent pas se confondre.
 *
 * Si le relevé bancaire importé amène ensuite le même paiement, il apparaît
 * une seconde fois : c'est assumé (décision de Jules du 26/09/2026, il
 * supprime alors l'une des deux lignes).
 */

/** Le nom d'une catégorie, comparé sans casse ni accents. */
const key = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

export function createExpenseService(store: BudgetStore): ExpenseService {
  async function entriesWith(refs: readonly string[]) {
    const wanted = new Set(refs);
    return (await store.listEntries()).filter((e) => e.importKey !== null && wanted.has(e.importKey));
  }

  return {
    async record(request: ExpenseRequest) {
      if ((await entriesWith([request.ref])).length > 0) return; // déjà là : rejouer ne double rien
      const categories = await store.listCategories();
      const category = categories.find((c) => key(c.name) === key(request.categoryName));
      await store.createEntry({
        day: request.day,
        label: request.label,
        // Une dépense est négative dans Astra (docs/etude-astra.md §2).
        amountCents: -Math.abs(Math.round(request.amountCents)),
        // Catégorie inconnue : « à classer », jamais une catégorie devinée.
        categoryId: category?.id ?? null,
        source: 'manuelle',
        importKey: request.ref,
        note: request.note ?? '',
      });
    },

    async remove(ref: string) {
      for (const entry of await entriesWith([ref])) await store.deleteEntry(entry.id);
    },

    async recorded(refs: readonly string[]) {
      return new Set((await entriesWith(refs)).map((e) => e.importKey as string));
    },
  };
}
