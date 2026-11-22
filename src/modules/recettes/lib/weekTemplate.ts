/**
 * La semaine type, et l'échange de deux repas — bibliothèque pure
 * (docs/etude-recettes.md §22).
 *
 * Jules n'aime ni cuisiner ni réfléchir à quoi manger : il décide une fois de
 * sa semaine, jour par jour, midi et soir ; elle se recopie dans le menu de
 * chaque semaine, où il échange deux repas d'un geste quand ses jours de
 * bureau ou sa fatigue changent la donne.
 */
import { mondayOf, shiftDay, weekday as jsWeekday } from '../../../core/lib/day';
import { fold } from './ingredients';
import { MEALS, WEEKDAYS, type Meal, type PlanEntry, type PlanEntryInput, type TemplateEntry, type Weekday } from './types';

export const WEEKDAY_NAMES: Record<Weekday, string> = {
  1: 'Lundi',
  2: 'Mardi',
  3: 'Mercredi',
  4: 'Jeudi',
  5: 'Vendredi',
  6: 'Samedi',
  7: 'Dimanche',
};

/** Le jour de la semaine d'une date : 1 = lundi … 7 = dimanche. */
export function weekdayOf(day: string): Weekday {
  return (((jsWeekday(day) + 6) % 7) + 1) as Weekday;
}

/** La date du jour `weekday` dans la semaine qui commence le lundi `monday`. */
export function dayOfWeekday(monday: string, weekday: Weekday): string {
  return shiftDay(monday, weekday - 1);
}

/** Les entrées d'une case de la semaine type, dans leur ordre. */
export function templateSlot(entries: readonly TemplateEntry[], weekday: Weekday, meal: Meal): TemplateEntry[] {
  return entries.filter((e) => e.weekday === weekday && e.meal === meal).sort((a, b) => a.position - b.position);
}

/**
 * Recopier la semaine type dans le menu de la semaine de `day`.
 *
 * **Une case déjà remplie est gardée telle quelle** : recopier deux fois ne
 * double rien, et un repas posé ou déplacé à la main n'est jamais écrasé.
 * Les jours avant `notBefore` (aujourd'hui, d'ordinaire) sont sautés : on ne
 * prévoit pas ce qu'on a déjà mangé.
 */
export function fromTemplate(
  template: readonly TemplateEntry[],
  day: string,
  existing: readonly Pick<PlanEntry, 'day' | 'meal'>[],
  notBefore?: string,
): PlanEntryInput[] {
  const monday = mondayOf(day);
  const filled = new Set(existing.map((e) => `${e.day}|${e.meal}`));
  const out: PlanEntryInput[] = [];
  for (const wd of WEEKDAYS) {
    const date = dayOfWeekday(monday, wd);
    if (notBefore && date < notBefore) continue;
    for (const meal of MEALS) {
      if (filled.has(`${date}|${meal}`)) continue;
      templateSlot(template, wd, meal).forEach((e, position) => {
        out.push({ day: date, meal, recipeId: e.recipeId, title: e.recipeId ? '' : e.title, servings: e.servings, leftovers: e.leftovers, position });
      });
    }
  }
  return out;
}

/** Où va une entrée quand on échange deux cases. */
export interface SlotMove<S> {
  id: string;
  slot: S;
  position: number;
}

/**
 * Échanger deux cases : tout ce qui est dans `a` passe dans `b`, et
 * inversement, chacun dans son ordre. Glisser sur une case vide revient à
 * déplacer. C'est le geste de Jules : « je suis au bureau mardi, je passe le
 * repas à cuisiner de mardi midi à mercredi midi » — celui de mercredi prend
 * la place libérée, rien ne se perd.
 */
export function swapSlots<S>(a: { slot: S; entries: readonly { id: string; position: number }[] }, b: { slot: S; entries: readonly { id: string; position: number }[] }): SlotMove<S>[] {
  const ordered = (list: readonly { id: string; position: number }[]) => [...list].sort((x, y) => x.position - y.position);
  return [
    ...ordered(a.entries).map((e, position) => ({ id: e.id, slot: b.slot, position })),
    ...ordered(b.entries).map((e, position) => ({ id: e.id, slot: a.slot, position })),
  ];
}

/** Ce qui fait « le même plat » : la même recette, ou le même titre écrit à la main. */
export function dishKey(e: { recipeId: string | null; title: string }): string {
  return e.recipeId ? `recette:${e.recipeId}` : `titre:${fold(e.title.trim())}`;
}

export interface Repeat {
  weekday: Weekday;
  meal: Meal;
  /** Le plat mangé deux repas de suite. */
  entry: TemplateEntry;
}

/**
 * Les repas qui suivent le même plat (demande de Jules : « ne pas enchaîner
 * plusieurs fois le même repas, je peux congeler »). La semaine se répète :
 * le dimanche soir précède le lundi midi. Une case vide sépare.
 */
export function consecutiveRepeats(template: readonly TemplateEntry[]): Repeat[] {
  const slots = WEEKDAYS.flatMap((wd) => MEALS.map((meal) => ({ weekday: wd, meal, entries: templateSlot(template, wd, meal) })));
  const out: Repeat[] = [];
  slots.forEach((current, i) => {
    const previous = slots[(i + slots.length - 1) % slots.length];
    if (previous === current) return;
    const before = new Set(previous.entries.map(dishKey));
    const same = current.entries.find((e) => before.has(dishKey(e)));
    if (same) out.push({ weekday: current.weekday, meal: current.meal, entry: same });
  });
  return out;
}

/** Combien de fois on cuisine, et combien de repas sont des restes. */
export function cookingSummary(entries: readonly { leftovers: boolean }[]): { cook: number; leftovers: number } {
  const leftovers = entries.filter((e) => e.leftovers).length;
  return { cook: entries.length - leftovers, leftovers };
}
