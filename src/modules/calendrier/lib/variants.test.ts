import { describe, expect, it } from 'vitest';
import { LocalCalendar } from '../data/localCalendar';
import { applyPlan } from '../data/applyPlan';
import { expandEvents } from './recurrence';
import { planEdit, type OccurrenceValues } from './seriesEdit';
import type { CalendarEvent, EventException } from './types';
import { defaultVariantId, findVariant, validateVariants, variantOf, type EventVariant } from './variants';

// En Node, un localStorage minimal pour le stockage local (même motif que les autres tests).
const memory = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
  key: (i: number) => [...memory.keys()][i] ?? null,
  get length() {
    return memory.size;
  },
} as Storage;

// « Travail », du lundi au vendredi : au bureau, sauf le télétravail du lundi et du vendredi (26/10/2026).
const bureau: EventVariant = { id: 'b', name: 'Bureau', color: null, weekdays: [2, 3, 4] };
const tt: EventVariant = { id: 'tt', name: '🏠 Télétravail', color: 'vert', weekdays: [1, 5] };

const work: CalendarEvent = {
  id: 'w',
  title: 'Travail',
  allDay: false,
  startDay: '2026-10-26', // un lundi
  endDay: '2026-10-26',
  startTime: '09:00',
  endTime: '18:00',
  timezone: 'Europe/Paris',
  recurrence: { freq: 'weekly', interval: 1, byWeekday: [1, 2, 3, 4, 5] },
  color: 'bleu',
  location: '',
  note: '',
  reminders: null,
  work: true,
  variants: [bureau, tt],
  createdAt: '',
};

const x = (day: string, override: EventException['override'], id = `x-${day}`): EventException => ({ id, eventId: work.id, occurrenceDay: day, kind: 'override', override, createdAt: '' });
const variantsOf = (exceptions: EventException[], from = '2026-10-26', to = '2026-10-30', events = [work]) =>
  expandEvents(events, exceptions, from, to).map((o) => `${o.startDay} ${o.variant?.name ?? '—'}`);

const values = (day: string, exceptions: EventException[] = []): OccurrenceValues => {
  const o = expandEvents([work], exceptions, day, day)[0];
  const { title, allDay, startDay, endDay, startTime, endTime, color, location, note, reminders } = o;
  return { title, allDay, startDay, endDay, startTime, endTime, color, location, note, reminders, work: o.work, variants: work.variants };
};

describe('les variantes d’une série', () => {
  it('celle des jours, sinon celle choisie, et aucune si on le dit', () => {
    expect(defaultVariantId(work.variants, '2026-10-26')).toBe('tt');
    expect(defaultVariantId(work.variants, '2026-10-27')).toBe('b');
    expect(defaultVariantId(work.variants, '2026-10-31')).toBeNull();
    expect(variantOf(work.variants, '2026-10-27', 'tt')?.name).toBe('🏠 Télétravail');
    expect(variantOf(work.variants, '2026-10-27', null)).toBeNull();
    // Une variante retirée depuis : on revient à la règle des jours.
    expect(variantOf(work.variants, '2026-10-27', 'disparue')?.id).toBe('b');
    expect(variantOf(undefined, '2026-10-27', undefined)).toBeNull();
    expect(findVariant(work.variants, ' 🏠 TELETRAVAIL ')?.id).toBe('tt');
  });

  it('se voit dans chaque occurrence ; un choix seul ne rend pas l’occurrence « modifiée »', () => {
    expect(variantsOf([])).toEqual(['2026-10-26 🏠 Télétravail', '2026-10-27 Bureau', '2026-10-28 Bureau', '2026-10-29 Bureau', '2026-10-30 🏠 Télétravail']);
    const exceptions = [x('2026-10-28', { variant: 'tt' }), x('2026-10-30', { variant: 'b', title: 'Travail (réunion)' })];
    expect(variantsOf(exceptions)).toEqual(['2026-10-26 🏠 Télétravail', '2026-10-27 Bureau', '2026-10-28 🏠 Télétravail', '2026-10-29 Bureau', '2026-10-30 Bureau']);
    const [wed, fri] = expandEvents([work], exceptions, '2026-10-28', '2026-10-30').filter((o) => o.startDay !== '2026-10-29');
    expect(wed).toMatchObject({ modified: false, title: 'Travail', color: 'bleu' });
    expect(fri).toMatchObject({ modified: true, title: 'Travail (réunion)' });
    expect('variant' in fri && typeof fri.variant === 'object').toBe(true);
  });

  it('refuse ce qui serait ambigu', () => {
    expect(validateVariants([bureau, tt])).toBeNull();
    expect(validateVariants([bureau, { ...tt, name: 'bureau' }])).toMatch(/Deux variantes/);
    expect(validateVariants([bureau, { ...tt, weekdays: [2] }])).toMatch(/même jour/);
    expect(validateVariants([{ ...bureau, name: '  ' }])).toMatch(/nom/);
    expect(validateVariants([{ ...bureau, weekdays: [7] }])).toMatch(/jour/);
    expect(validateVariants(Array.from({ length: 7 }, (_, i) => ({ id: `v${i}`, name: `V${i}`, color: null, weekdays: [] })))).toMatch(/6 variantes/);
  });
});

describe('choisir la variante d’un jour, modifier la série', () => {
  it('« ce jour-là » : posée si elle diffère de celle des jours, retirée sinon', () => {
    expect(planEdit(work, [], '2026-10-27', values('2026-10-27'), { ...values('2026-10-27'), recurrence: work.recurrence, variantId: 'tt' }, 'this')).toEqual({
      setException: { eventId: 'w', occurrenceDay: '2026-10-27', kind: 'override', override: { variant: 'tt' } },
      deleteExceptions: [],
    });
    const chosen = [x('2026-10-27', { variant: 'tt' })];
    expect(planEdit(work, chosen, '2026-10-27', values('2026-10-27', chosen), { ...values('2026-10-27', chosen), recurrence: work.recurrence, variantId: 'b' }, 'this')).toEqual({
      deleteExceptions: ['x-2026-10-27'],
    });
    // Aucune variante ce jour-là : `null`, gardé.
    expect(planEdit(work, [], '2026-10-27', values('2026-10-27'), { ...values('2026-10-27'), recurrence: work.recurrence, variantId: null }, 'this').setException?.override).toEqual({ variant: null });
  });

  it('modifier autre chose ce jour-là garde la variante choisie', () => {
    const chosen = [x('2026-10-27', { variant: 'tt' })];
    const before = values('2026-10-27', chosen);
    expect(planEdit(work, chosen, '2026-10-27', before, { ...before, recurrence: work.recurrence, startTime: '10:00' }, 'this').setException?.override).toEqual({ startTime: '10:00', variant: 'tt' });
  });

  it('changer les variantes depuis une occurrence change la série', () => {
    const before = values('2026-10-27');
    const variants = [bureau, { ...tt, weekdays: [5] }];
    expect(planEdit(work, [], '2026-10-27', before, { ...before, recurrence: work.recurrence, variants }, 'this')).toEqual({ update: { id: 'w', patch: { variants } }, deleteExceptions: [] });
    expect(planEdit(work, [], '2026-10-27', before, { ...before, recurrence: work.recurrence, variants }, 'all')).toEqual({ update: { id: 'w', patch: { variants } }, deleteExceptions: [] });
  });

  it('« tous » sans décalage : seule l’exception du jour touché change', () => {
    const exceptions = [x('2026-10-27', { title: 'Travail (tôt)' })];
    const before = values('2026-10-27', exceptions);
    expect(planEdit(work, exceptions, '2026-10-27', before, { ...before, recurrence: work.recurrence, location: 'Lyon', variantId: 'tt' }, 'all')).toEqual({
      update: { id: 'w', patch: { location: 'Lyon' } },
      deleteExceptions: [],
      carry: [{ occurrenceDay: '2026-10-27', override: { title: 'Travail (tôt)', variant: 'tt' } }],
    });
  });

  it('couper ou décaler la série ne perd pas les jours choisis', async () => {
    const exceptions = [x('2026-10-28', { variant: 'tt' }), x('2026-11-04', { variant: null, note: 'congé' }), x('2026-10-20', { variant: 'tt' })];
    const before = values('2026-10-27', exceptions);
    // « Cet événement et les suivants », à 8 h : la nouvelle série reprend les choix d'après.
    const plan = planEdit(work, exceptions, '2026-10-27', before, { ...before, recurrence: work.recurrence, startTime: '08:00', variantId: 'tt' }, 'following');
    expect(plan.carry).toEqual([
      { occurrenceDay: '2026-10-27', override: { variant: 'tt' } },
      { occurrenceDay: '2026-10-28', override: { variant: 'tt' } },
      { occurrenceDay: '2026-11-04', override: { variant: null } },
    ]);
    // Et pour de vrai, par le stockage : les jours suivent la nouvelle série.
    localStorage.clear();
    const store = new LocalCalendar();
    const created = await store.createEvent({ ...work, startDay: '2026-10-19', endDay: '2026-10-19' });
    await store.setException(created.id, '2026-10-28', 'override', { variant: 'tt' });
    const own = await store.listExceptions();
    const b = { ...values('2026-10-27'), variants: created.variants };
    await applyPlan(store, planEdit(created, own, '2026-10-27', b, { ...b, recurrence: created.recurrence, startTime: '08:00' }, 'following'));
    const [events, after] = [await store.listEvents(), await store.listExceptions()];
    expect(events).toHaveLength(2);
    expect(variantsOf(after, '2026-10-26', '2026-10-28', events)).toEqual(['2026-10-26 🏠 Télétravail', '2026-10-27 Bureau', '2026-10-28 🏠 Télétravail']);
    expect(expandEvents(events, after, '2026-10-28', '2026-10-28')[0]).toMatchObject({ startTime: '08:00', eventId: events[1].id });
  });

  it('décaler toute la série d’un jour décale aussi les jours choisis', () => {
    const exceptions = [x('2026-10-28', { variant: 'tt' })];
    const before = values('2026-10-26', exceptions);
    const plan = planEdit(work, exceptions, '2026-10-26', before, { ...before, startDay: '2026-10-27', endDay: '2026-10-27', recurrence: work.recurrence }, 'all');
    expect(plan.deleteExceptions).toEqual(['x-2026-10-28']);
    expect(plan.carry).toEqual([{ occurrenceDay: '2026-10-29', override: { variant: 'tt' } }]);
  });
});
