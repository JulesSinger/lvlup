import type { CalendarSource } from '../../../core/lib/services';
import { mealAt, menuMarks } from '../lib/calendarMarks';
import { nextPosition } from '../lib/menu';
import type { RecettesStore } from './recettesStore';

/**
 * Le calque de Recettes que Calendar affiche (`core/lib/services.ts`) : le
 * menu de la semaine. Glisser un repas à un autre jour (ou sur une heure du
 * soir) le déplace chez Recettes ; c'est Recettes qui écrit.
 */
export function createCalendarSource(store: RecettesStore): CalendarSource {
  return {
    id: 'recettes',
    label: 'Recettes',
    color: '#eba95c',
    defaultVisible: true,
    async marksBetween(from, to) {
      const [entries, recipes] = await Promise.all([store.listPlan(from, to), store.listRecipes()]);
      return menuMarks(entries, recipes, from, to);
    },
    async moveMark(markId, to) {
      const id = markId.replace(/^plan:/, '');
      const entry = (await store.listPlan('0001-01-01', '9999-12-31')).find((e) => e.id === id);
      if (!entry) throw new Error('Ce repas n’est plus au menu.');
      const meal = mealAt(to.time, entry.meal);
      const sameSlot = await store.listPlan(to.day, to.day);
      await store.updatePlanEntry(id, { day: to.day, meal, position: nextPosition(sameSlot.filter((e) => e.id !== id), to.day, meal) });
    },
  };
}
