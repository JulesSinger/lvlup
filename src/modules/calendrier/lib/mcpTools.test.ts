import { describe, expect, it } from 'vitest';
import * as server from '../../../../supabase/functions/atlas-mcp/calendar.ts';
import { calendarTools, type CalendarData, type EventInput as ServerInput } from '../../../../supabase/functions/atlas-mcp/calendar.ts';
import { expandEvents } from './recurrence';
import { plannedReminders } from './reminders';
import { planDelete, planEdit, type OccurrenceValues } from './seriesEdit';
import * as types from './types';
import type { CalendarEvent, EventException } from './types';
import { validateEvent } from './validation';
import * as variants from './variants';

// Les outils de Calendar du connecteur (docs/connecteur-claude.md §14) : la fonction recopie les
// règles du module (occurrences, validation, séries, rappels) — chaque copie est comparée ici.

const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

const event = (extra: Partial<CalendarEvent>): CalendarEvent => ({
  id: uuid(),
  title: 'Cours',
  allDay: false,
  startDay: '2026-10-06',
  endDay: '2026-10-06',
  startTime: '18:00',
  endTime: '19:30',
  timezone: zone,
  recurrence: null,
  color: 'bleu',
  location: '',
  note: '',
  reminders: null,
  work: false,
  createdAt: '2026-10-01T00:00:00Z',
  ...extra,
});

const weekly = event({ title: 'Yoga', recurrence: { freq: 'weekly', interval: 1, byWeekday: [2] }, reminders: [15] });
const birthday = event({ title: 'Anniv', allDay: true, startTime: null, endTime: null, startDay: '2026-10-20', endDay: '2026-10-20', recurrence: { freq: 'yearly', interval: 1 } });
const trip = event({ title: 'Week-end', allDay: true, startTime: null, endTime: null, startDay: '2026-10-16', endDay: '2026-10-18' });
const night = event({ title: 'Soirée', startDay: '2026-10-10', endDay: '2026-10-11', startTime: '22:00', endTime: '02:00', reminders: [60, 1440] });
const events = [weekly, birthday, trip, night];
const exceptions: EventException[] = [
  { id: uuid(), eventId: weekly.id, occurrenceDay: '2026-10-13', kind: 'skip', override: null, createdAt: '' },
  { id: uuid(), eventId: weekly.id, occurrenceDay: '2026-10-20', kind: 'override', override: { startTime: '19:00', endTime: '20:00', title: 'Yoga (décalé)' }, createdAt: '' },
];

const values = (o: ReturnType<typeof expandEvents>[number]): OccurrenceValues => ({
  title: o.title,
  allDay: o.allDay,
  startDay: o.startDay,
  endDay: o.endDay,
  startTime: o.startTime,
  endTime: o.endTime,
  color: o.color,
  location: o.location,
  note: o.note,
  reminders: o.reminders,
});

describe('connecteur — Calendar : les copies suivent le module', () => {
  it('reprend les bornes', () => {
    expect(server.EVENT_COLORS).toEqual(types.EVENT_COLORS);
    expect(server.TIMED_REMINDERS).toEqual(types.TIMED_REMINDERS);
    expect(server.ALL_DAY_REMINDERS).toEqual(types.ALL_DAY_REMINDERS);
    expect(server.MAX_REMINDERS).toBe(types.MAX_REMINDERS);
  });

  it('déplie les occurrences pareil', () => {
    for (const [from, to] of [
      ['2026-10-01', '2026-10-31'],
      ['2026-10-11', '2026-10-11'],
      ['2027-10-01', '2027-10-31'],
    ]) {
      expect(server.expandEvents(events, exceptions, from, to)).toEqual(expandEvents(events, exceptions, from, to));
    }
  });

  it('valide pareil', () => {
    const inputs = [
      { title: '', allDay: true, startDay: '2026-10-01', endDay: '2026-10-01', startTime: null, endTime: null },
      { title: 'A', allDay: false, startDay: '2026-10-01', endDay: '2026-10-01', startTime: '10:00', endTime: '09:00' },
      { title: 'A', allDay: false, startDay: '2026-10-01', endDay: '2026-10-02', startTime: '22:00', endTime: '01:00' },
      { title: 'A', allDay: true, startDay: '2026-10-01', endDay: '2026-10-01', startTime: null, endTime: null, reminders: [15, 15] },
      { title: 'A', allDay: true, startDay: '2026-10-01', endDay: '2026-10-01', startTime: null, endTime: null, recurrence: { freq: 'weekly' as const, interval: 0 } },
    ];
    for (const input of inputs) expect(server.validateEvent(input as ServerInput)).toBe(validateEvent(input as types.EventInput));
  });

  it('modifie et supprime une série pareil', () => {
    const occurrence = expandEvents(events, exceptions, '2026-10-27', '2026-10-27').find((o) => o.eventId === weekly.id)!;
    const before = values(occurrence);
    const changes = [
      { ...before, title: 'Yoga doux', recurrence: weekly.recurrence },
      { ...before, startDay: '2026-10-28', endDay: '2026-10-28', recurrence: weekly.recurrence },
      { ...before, startTime: '07:00', endTime: '08:00', recurrence: { freq: 'weekly' as const, interval: 2, byWeekday: [2] } },
    ];
    for (const after of changes)
      for (const scope of ['this', 'following', 'all'] as const) {
        if (scope === 'this' && after.recurrence !== weekly.recurrence) continue;
        expect(server.planEdit(weekly, exceptions, '2026-10-27', before, after, scope)).toEqual(planEdit(weekly, exceptions, '2026-10-27', before, after, scope));
      }
    for (const scope of ['this', 'following', 'all'] as const) {
      expect(server.planDelete(weekly, exceptions, '2026-10-27', scope)).toEqual(planDelete(weekly, exceptions, '2026-10-27', scope));
      expect(server.planDelete(weekly, exceptions, '2026-10-06', scope)).toEqual(planDelete(weekly, exceptions, '2026-10-06', scope));
    }
  });

  it('pose les mêmes rappels, l’heure lue dans le fuseau de l’événement', () => {
    const settings = { timedReminders: [10], allDayReminders: [360] };
    const now = new Date('2026-10-05T12:00:00Z');
    expect(server.plannedReminders(events, exceptions, settings, now, zone)).toEqual(plannedReminders(events, exceptions, settings, now));
  });

  it('lit une heure de Paris quel que soit le fuseau du serveur, changement d’heure compris', () => {
    expect(server.zonedInstant('2026-10-24', '09:00', 'Europe/Paris').toISOString()).toBe('2026-10-24T07:00:00.000Z');
    expect(server.zonedInstant('2026-10-26', '09:00', 'Europe/Paris').toISOString()).toBe('2026-10-26T08:00:00.000Z');
    expect(server.zonedDay(new Date('2026-10-24T22:30:00Z'), 'Europe/Paris')).toBe('2026-10-25');
  });
});

function memory(initial: CalendarEvent[] = [], initialExceptions: EventException[] = []) {
  const list = initial.map((e) => ({ ...e }));
  const xs = initialExceptions.map((x) => ({ ...x }));
  let scheduled: server.ReminderInput[] = [];
  const data: CalendarData = {
    listEvents: async () => list.map((e) => ({ ...e })),
    listExceptions: async () => xs.map((x) => ({ ...x })),
    getSettings: async () => ({ timedReminders: [], allDayReminders: [] }),
    createEvent: async (input) => {
      const e = { id: uuid(), createdAt: '', timezone: 'Europe/Paris', recurrence: null, color: 'bleu', location: '', note: '', reminders: null, work: false, ...input } as CalendarEvent;
      list.push(e);
      return e;
    },
    updateEvent: async (id, patch) => {
      Object.assign(list.find((e) => e.id === id)!, patch);
    },
    deleteEvent: async (id) => {
      list.splice(
        list.findIndex((e) => e.id === id),
        1,
      );
    },
    setException: async (eventId, occurrenceDay, kind, override) => {
      const at = xs.findIndex((x) => x.eventId === eventId && x.occurrenceDay === occurrenceDay);
      if (at >= 0) xs.splice(at, 1);
      xs.push({ id: uuid(), eventId, occurrenceDay, kind, override: kind === 'override' ? (override ?? {}) : null, createdAt: '' });
    },
    deleteException: async (id) => {
      xs.splice(
        xs.findIndex((x) => x.id === id),
        1,
      );
    },
    scheduleReminders: async (r) => {
      scheduled = r;
    },
  };
  const call = async (name: string, args: Record<string, unknown>) => {
    const tool = calendarTools.find((t) => t.name === name)!;
    const result = await tool.run(args, { data, today: '2026-10-12', now: new Date('2026-10-12T08:00:00Z'), timezone: 'Europe/Paris' });
    return JSON.parse(result.text);
  };
  return { list, xs, call, scheduled: () => scheduled };
}

// « Travail » du lundi au vendredi, télétravail d'office le lundi et le vendredi (26/10/2026).
const job = event({
  title: 'Travail',
  startDay: '2026-10-12',
  endDay: '2026-10-12',
  startTime: '09:00',
  endTime: '18:00',
  recurrence: { freq: 'weekly', interval: 1, byWeekday: [1, 2, 3, 4, 5] },
  variants: [
    { id: 'b', name: 'Bureau', color: null, weekdays: [] },
    { id: 'tt', name: '🏠 Télétravail', color: 'vert', weekdays: [1, 5] },
  ],
});
const jobExceptions: EventException[] = [
  { id: uuid(), eventId: job.id, occurrenceDay: '2026-10-14', kind: 'override', override: { variant: 'tt' }, createdAt: '' },
  { id: uuid(), eventId: job.id, occurrenceDay: '2026-10-16', kind: 'override', override: { variant: 'b', note: 'réunion' }, createdAt: '' },
];

describe('connecteur — Calendar : les variantes suivent le module', () => {
  it('mêmes bornes, mêmes règles', () => {
    expect([server.VARIANTS_MAX, server.VARIANT_NAME_MAX]).toEqual([variants.VARIANTS_MAX, variants.VARIANT_NAME_MAX]);
    for (const list of [job.variants, [{ id: 'a', name: 'A', color: null, weekdays: [1] }, { id: 'c', name: 'a', color: null, weekdays: [] }], [{ id: 'a', name: '', color: null, weekdays: [] }], [{ id: 'a', name: 'A', color: null, weekdays: [1] }, { id: 'c', name: 'C', color: null, weekdays: [1] }]])
      expect(server.validateVariants(list)).toBe(variants.validateVariants(list));
    for (const d of ['2026-10-12', '2026-10-13', '2026-10-18']) expect(server.defaultVariantId(job.variants, d)).toBe(variants.defaultVariantId(job.variants, d));
    for (const name of ['teletravail', '🏠 télétravail', ' BUREAU', '🏠', 'plage'])
      expect(server.findVariant(job.variants, name)).toEqual(variants.findVariant(job.variants, name));
    expect(variants.findVariant(job.variants, 'teletravail')?.id).toBe('tt');
  });

  it('déplie et modifie pareil', () => {
    expect(server.expandEvents([job], jobExceptions, '2026-10-12', '2026-10-30')).toEqual(expandEvents([job], jobExceptions, '2026-10-12', '2026-10-30'));
    const o = expandEvents([job], jobExceptions, '2026-10-14', '2026-10-14')[0];
    const before = { ...values(o), variants: job.variants };
    const changes = [
      { ...before, recurrence: job.recurrence, variantId: 'b' },
      { ...before, recurrence: job.recurrence, startTime: '08:00', variantId: null },
      { ...before, recurrence: job.recurrence, startDay: '2026-10-15', endDay: '2026-10-15' },
      { ...before, recurrence: job.recurrence, variants: [job.variants![1]] },
    ];
    for (const after of changes)
      for (const scope of ['this', 'following', 'all'] as const)
        expect(server.planEdit(job, jobExceptions, '2026-10-14', before, after, scope)).toEqual(planEdit(job, jobExceptions, '2026-10-14', before, after, scope));
  });
});

describe('connecteur — Calendar : les outils', () => {
  it('les variantes : les définir, les lire, choisir celle de certains jours (26/10/2026)', async () => {
    const m = memory();
    await expect(m.call('calendrier_ajouter', { title: 'X', day: '2026-10-12', variants: [{ name: 'A' }] })).rejects.toThrow(/répété/);
    await m.call('calendrier_ajouter', {
      title: 'Travail',
      day: '2026-10-12',
      start_time: '09:00',
      end_time: '18:00',
      repeat: { freq: 'weekly', by_weekday: [1, 2, 3, 4, 5] },
      variants: [{ name: 'Bureau' }, { name: '🏠 Télétravail', color: 'vert', weekdays: [5, 1] }],
    });
    const series = m.list[0];
    expect(series.variants).toEqual([
      { id: expect.any(String), name: 'Bureau', color: null, weekdays: [] },
      { id: expect.any(String), name: '🏠 Télétravail', color: 'vert', weekdays: [1, 5] },
    ]);
    const read = async () =>
      (await m.call('calendrier_evenements', { from: '2026-10-12', to: '2026-10-16' })).events.map((e: { day: string; variant?: string }) => `${e.day} ${e.variant ?? '—'}`);
    expect(await read()).toEqual(['2026-10-12 🏠 Télétravail', '2026-10-13 —', '2026-10-14 —', '2026-10-15 —', '2026-10-16 🏠 Télétravail']);

    const res = await m.call('calendrier_variante', { event_id: series.id, days: ['2026-10-14', '2026-10-13'], variant: 'télétravail ' });
    expect(res.message).toMatch(/« 🏠 Télétravail », les 2026-10-13, 2026-10-14/);
    await m.call('calendrier_variante', { event_id: series.id, days: ['2026-10-16'], variant: 'bureau' });
    await m.call('calendrier_variante', { event_id: series.id, days: ['2026-10-12'], variant: null });
    expect(await read()).toEqual(['2026-10-12 —', '2026-10-13 🏠 Télétravail', '2026-10-14 🏠 Télétravail', '2026-10-15 —', '2026-10-16 Bureau']);
    await m.call('calendrier_variante', { event_id: series.id, days: ['2026-10-12', '2026-10-13'], reset: true });
    expect(await read()).toEqual(['2026-10-12 🏠 Télétravail', '2026-10-13 —', '2026-10-14 🏠 Télétravail', '2026-10-15 —', '2026-10-16 Bureau']);
    // Un choix seul n'est pas une occurrence modifiée, et le reste de l'événement ne bouge pas.
    const wed = (await m.call('calendrier_evenements', { from: '2026-10-14', to: '2026-10-14' })).events[0];
    expect(wed).toMatchObject({ title: 'Travail', start_time: '09:00', variant: '🏠 Télétravail' });
    expect(wed.modified_occurrence).toBeUndefined();

    await expect(m.call('calendrier_variante', { event_id: series.id, days: ['2026-10-17'], variant: 'Bureau' })).rejects.toThrow(/pas une occurrence/);
    await expect(m.call('calendrier_variante', { event_id: series.id, days: ['2026-10-15'], variant: 'Plage' })).rejects.toThrow(/Bureau, 🏠 Télétravail/);

    // Redéfinir les variantes garde celles qui gardent leur nom, et leurs jours choisis.
    const ttId = series.variants![1].id;
    await m.call('calendrier_modifier', { event_id: series.id, occurrence_day: '2026-10-15', scope: 'tous', variants: [{ name: '🏠 Télétravail', weekdays: [1] }] });
    expect(m.list[0].variants).toEqual([{ id: ttId, name: '🏠 Télétravail', color: null, weekdays: [1] }]);
    expect(await read()).toEqual(['2026-10-12 🏠 Télétravail', '2026-10-13 —', '2026-10-14 🏠 Télétravail', '2026-10-15 —', '2026-10-16 —']);
  });

  it('ajoute un rendez-vous d’une heure, et pose son rappel à l’heure de Paris', async () => {
    const m = memory();
    const res = await m.call('calendrier_ajouter', { title: 'Dentiste', day: '2026-10-15', start_time: '14h', reminders: [30], location: 'Annecy' });
    expect(res.event).toMatchObject({ title: 'Dentiste', day: '2026-10-15', start_time: '14:00', end_time: '15:00', location: 'Annecy' });
    expect(m.list[0]).toMatchObject({ allDay: false, timezone: 'Europe/Paris', reminders: [30] });
    expect(m.scheduled()).toEqual([
      expect.objectContaining({ ref: `event:${m.list[0].id}:2026-10-15:30`, fireAt: '2026-10-15T11:30:00.000Z', body: 'Aujourd’hui, 14 h – 15 h · Annecy' }),
    ]);
  });

  it('ajoute une journée entière, une soirée qui passe minuit, une série', async () => {
    const m = memory();
    await m.call('calendrier_ajouter', { title: 'Vacances', day: '2026-10-24', end_day: '2026-10-31' });
    await m.call('calendrier_ajouter', { title: 'Concert', day: '2026-10-17', start_time: '21:00', end_time: '01:00' });
    await m.call('calendrier_ajouter', { title: 'Piscine', day: '2026-10-14', start_time: '12:15', duration_minutes: 45, repeat: { freq: 'weekly', by_weekday: [3] } });
    expect(m.list[0]).toMatchObject({ allDay: true, startDay: '2026-10-24', endDay: '2026-10-31', startTime: null });
    expect(m.list[1]).toMatchObject({ startDay: '2026-10-17', endDay: '2026-10-18', endTime: '01:00' });
    expect(m.list[2]).toMatchObject({ endTime: '13:00', recurrence: { freq: 'weekly', interval: 1, byWeekday: [3] } });
    const read = await m.call('calendrier_evenements', { from: '2026-10-12', to: '2026-10-25' });
    expect(read.events.filter((e: { title: string }) => e.title === 'Piscine').map((e: { occurrence_day: string }) => e.occurrence_day)).toEqual(['2026-10-14', '2026-10-21']);
    expect(read.events.find((e: { title: string }) => e.title === 'Piscine').repeat).toBe('Toutes les semaines le mercredi');
  });

  it('refuse ce qui n’a pas de sens', async () => {
    const m = memory();
    await expect(m.call('calendrier_ajouter', { title: 'X', day: '2026-13-01' })).rejects.toThrow(/AAAA-MM-JJ/);
    await expect(m.call('calendrier_ajouter', { title: 'X', day: '2026-10-01', start_time: '25:00' })).rejects.toThrow(/HH:MM/);
    await expect(m.call('calendrier_ajouter', { title: 'X', day: '2026-10-01', reminders: [7] })).rejects.toThrow(/rappel/);
  });

  it('déplace un événement simple, en gardant sa durée', async () => {
    const e = event({ title: 'Réunion', startDay: '2026-10-13', endDay: '2026-10-13', startTime: '10:00', endTime: '11:30' });
    const m = memory([e]);
    await m.call('calendrier_modifier', { event_id: e.id, day: '2026-10-14', start_time: '15:00' });
    expect(m.list[0]).toMatchObject({ startDay: '2026-10-14', endDay: '2026-10-14', startTime: '15:00', endTime: '16:30' });
  });

  it('modifie une occurrence, les suivantes, ou toute la série', async () => {
    const m = memory([weekly]);
    await expect(m.call('calendrier_modifier', { event_id: weekly.id, title: 'X' })).rejects.toThrow(/occurrence_day/);
    await expect(m.call('calendrier_modifier', { event_id: weekly.id, occurrence_day: '2026-10-14', scope: 'tous', title: 'X' })).rejects.toThrow(/occurrence/);
    await m.call('calendrier_modifier', { event_id: weekly.id, occurrence_day: '2026-10-13', scope: 'cet_evenement', start_time: '19:00' });
    expect(m.xs).toEqual([expect.objectContaining({ occurrenceDay: '2026-10-13', kind: 'override', override: { startTime: '19:00', endTime: '20:30' } })]);
    await m.call('calendrier_modifier', { event_id: weekly.id, occurrence_day: '2026-10-27', scope: 'les_suivants', title: 'Yoga doux' });
    expect(m.list).toHaveLength(2);
    expect(m.list[0].recurrence).toMatchObject({ until: '2026-10-26' });
    expect(m.list[1]).toMatchObject({ title: 'Yoga doux', startDay: '2026-10-27' });
    await m.call('calendrier_modifier', { event_id: m.list[1].id, occurrence_day: '2026-11-03', scope: 'tous', location: 'Salle 2' });
    expect(m.list[1]).toMatchObject({ location: 'Salle 2', startDay: '2026-10-27' });
  });

  it('retrouve une occurrence déplacée à un autre jour', async () => {
    const m = memory([weekly]);
    await m.call('calendrier_modifier', { event_id: weekly.id, occurrence_day: '2026-10-13', scope: 'cet_evenement', day: '2026-10-15' });
    await m.call('calendrier_modifier', { event_id: weekly.id, occurrence_day: '2026-10-13', scope: 'cet_evenement', title: 'Yoga du jeudi' });
    expect(m.xs).toEqual([expect.objectContaining({ occurrenceDay: '2026-10-13', override: { title: 'Yoga du jeudi', startDay: '2026-10-15', endDay: '2026-10-15' } })]);
  });

  it('supprime une occurrence, puis toute la série', async () => {
    const m = memory([weekly]);
    await m.call('calendrier_supprimer', { event_id: weekly.id, occurrence_day: '2026-10-20', scope: 'cet_evenement' });
    expect(m.xs).toEqual([expect.objectContaining({ occurrenceDay: '2026-10-20', kind: 'skip' })]);
    const read = await m.call('calendrier_evenements', { from: '2026-10-19', to: '2026-10-21' });
    expect(read.events).toEqual([]);
    await m.call('calendrier_supprimer', { event_id: weekly.id, occurrence_day: '2026-10-06', scope: 'tous' });
    expect(m.list).toEqual([]);
  });
});
