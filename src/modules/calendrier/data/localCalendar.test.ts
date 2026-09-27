import { beforeEach, describe, expect, it } from 'vitest';
import type { EventInput } from '../lib/types';
import { LocalCalendar } from './localCalendar';

/**
 * Le module s'appuie sur localStorage ; en environnement Node on en fournit
 * une version minimale — même motif que les autres modules.
 */
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

const dentist: EventInput = {
  title: 'Dentiste',
  allDay: false,
  startDay: '2026-09-29',
  endDay: '2026-09-29',
  startTime: '14:00',
  endTime: '14:30',
};

describe('LocalCalendar', () => {
  let store: LocalCalendar;

  beforeEach(() => {
    memory.clear();
    store = new LocalCalendar();
  });

  it('crée un événement horaire avec ses valeurs par défaut', async () => {
    const event = await store.createEvent(dentist);
    expect(event).toMatchObject({ recurrence: null, color: 'bleu', location: '', note: '', startTime: '14:00' });
    expect(event.timezone.length).toBeGreaterThan(0);
    expect(await store.listEvents()).toEqual([event]);
  });

  it('une journée entière n’a jamais d’heure, même si on lui en donne', async () => {
    const event = await store.createEvent({ ...dentist, title: 'Vacances', allDay: true, endDay: '2026-10-04' });
    expect([event.startTime, event.endTime]).toEqual([null, null]);
    const timed = await store.createEvent(dentist);
    await store.updateEvent(timed.id, { allDay: true });
    const updated = (await store.listEvents()).find((e) => e.id === timed.id);
    expect([updated?.startTime, updated?.endTime]).toEqual([null, null]);
  });

  it('garde une règle de récurrence telle quelle', async () => {
    const sport = await store.createEvent({
      ...dentist,
      title: 'Sport',
      recurrence: { freq: 'weekly', interval: 1, byWeekday: [2, 4], until: '2026-12-31' },
    });
    expect((await store.listEvents())[0].recurrence).toEqual(sport.recurrence);
  });

  it('une seule exception par occurrence : la reposer la remplace', async () => {
    const sport = await store.createEvent({ ...dentist, recurrence: { freq: 'weekly', interval: 1 } });
    await store.setException(sport.id, '2026-10-06', 'skip');
    const moved = await store.setException(sport.id, '2026-10-06', 'override', { startTime: '19:00', endTime: '20:00' });
    const exceptions = await store.listExceptions();
    expect(exceptions).toEqual([moved]);
    expect(moved.override).toEqual({ startTime: '19:00', endTime: '20:00' });
  });

  it('une suppression n’a pas de champs remplacés', async () => {
    const sport = await store.createEvent({ ...dentist, recurrence: { freq: 'daily', interval: 1 } });
    expect((await store.setException(sport.id, '2026-10-01', 'skip')).override).toBeNull();
  });

  it('supprimer une série emporte ses exceptions, pas celles des autres', async () => {
    const a = await store.createEvent({ ...dentist, recurrence: { freq: 'daily', interval: 1 } });
    const b = await store.createEvent({ ...dentist, recurrence: { freq: 'daily', interval: 1 } });
    await store.setException(a.id, '2026-10-01', 'skip');
    const keep = await store.setException(b.id, '2026-10-01', 'skip');
    await store.deleteEvent(a.id);
    expect(await store.listExceptions()).toEqual([keep]);
  });

  it('retire une exception', async () => {
    const a = await store.createEvent({ ...dentist, recurrence: { freq: 'daily', interval: 1 } });
    const x = await store.setException(a.id, '2026-10-01', 'skip');
    await store.deleteException(x.id);
    expect(await store.listExceptions()).toEqual([]);
  });

  it('la sauvegarde fait l’aller-retour sans rien perdre', async () => {
    const a = await store.createEvent({ ...dentist, recurrence: { freq: 'monthly', interval: 1, count: 6 } });
    await store.setException(a.id, '2026-11-29', 'override', { title: 'Dentiste (décalé)' });
    const backup = await store.exportData();
    memory.clear();
    await store.importData(backup);
    expect(await store.exportData()).toEqual(backup);
  });

  it('préserve les sections des autres modules dans le blob local partagé', async () => {
    localStorage.setItem('palier.v1', JSON.stringify({ coursesItems: [{ id: 'x' }] }));
    await store.createEvent(dentist);
    const raw = JSON.parse(localStorage.getItem('palier.v1') ?? '{}');
    expect(raw.coursesItems).toEqual([{ id: 'x' }]);
    expect(raw.calendarEvents).toHaveLength(1);
  });
});
