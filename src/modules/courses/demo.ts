import { shiftDay } from '../../core/lib/day';
import type { ModuleDemo } from '../../core/lib/module';
import { coursesStore as store } from './data';
import { guessAisle } from './lib/aisles';
import { buildClosePlan } from './lib/trip';
import type { Item } from './lib/types';

/** Les articles d'exemple : le nom, la récurrence (toutes les N courses, ou ponctuel), la quantité, un prix en euros. */
const ITEMS: [string, number | null, string, number][] = [
  ['Lait demi-écrémé', 1, '2', 2.3],
  ['Pain de mie', 1, '', 1.9],
  ['Pâtes', 2, '', 1.2],
  ['Tomates', 1, '1 kg', 3.1],
  ['Lessive', 3, '', 9.5],
  ['Café', 2, '', 4.8],
  ['Yaourts nature', 1, '8', 2.6],
];

/**
 * La démo de Courses (15/10/2026) : deux courses déjà faites, rejouées par la
 * vraie règle de clôture (`buildClosePlan`) — d'où un historique, des prix, et
 * une liste où les habituels sont revenus d'eux-mêmes —, puis un article
 * ponctuel et une ligne déjà cochée dans le caddie.
 */
export const coursesDemo: ModuleDemo = {
  async seed(today) {
    const lidl = await store.createStore('Lidl');
    const carrefour = await store.createStore('Carrefour');
    const items: Item[] = [];
    for (const [name, recurrence, quantity] of ITEMS) items.push(await store.createItem({ name, aisle: guessAisle(name), recurrence, defaultQuantity: quantity }));
    const price = (itemId: string) => Math.round((ITEMS.find(([n]) => n === items.find((i) => i.id === itemId)?.name)?.[3] ?? 2) * 100);

    for (const [back, shop] of [[9, lidl], [3, carrefour]] as const) {
      const listed = new Set((await store.listEntries()).map((e) => e.itemId));
      for (const item of items) if (!listed.has(item.id)) await store.addEntry(item.id, item.defaultQuantity);
      for (const entry of await store.listEntries()) await store.updateEntry(entry.id, { checked: true, priceCents: price(entry.itemId) });
      const plan = buildClosePlan({
        items: await store.listItems(),
        entries: await store.listEntries(),
        trips: await store.listTrips(),
        day: shiftDay(today, -back),
        store: { id: shop.id, name: shop.name },
      });
      await store.closeTrip(plan);
    }

    const candles = await store.createItem({ name: 'Bougies d’anniversaire', aisle: guessAisle('Bougies'), recurrence: null });
    await store.addEntry(candles.id, '1 paquet', 'Pour samedi');
    const first = (await store.listEntries())[0];
    if (first) await store.updateEntry(first.id, { checked: true, priceCents: price(first.itemId) });
  },
  tour: [
    {
      target: '.courses-add',
      title: 'Ajouter un article',
      body: 'Tape « tomates » : le rayon est deviné, et un article déjà acheté est proposé avec sa quantité habituelle.',
    },
    {
      target: '.courses-line',
      title: 'Ta liste, par rayon',
      body: 'Coche en magasin, note le prix si tu veux. Les articles habituels reviennent tout seuls : à chaque course, ou toutes les 2, 3… courses.',
    },
    {
      target: '.courses-close-btn',
      title: 'Le panier, et terminer la course',
      body: 'Ce qui est déjà dans le caddie, et une estimation du reste. « Terminer la course » demande le magasin et le total du ticket : la course part dans l’historique, et peut devenir une dépense dans Budget.',
    },
    {
      target: '.courses-view-tabs',
      title: 'Historique et chiffres',
      body: 'Tes courses passées avec leurs prix, le panier moyen, le prix d’un article dans le temps, et la répartition par typologie.',
    },
    {
      title: 'À toi',
      body: 'Ce sont des exemples : coche, ajoute, termine la course. Rien n’est enregistré dans ton compte.',
    },
  ],
};
