/**
 * Modifier ou supprimer une occurrence d'une série — bibliothèque pure
 * (étape 4, docs/etude-calendrier.md §16). « Cet événement », « cet
 * événement et les suivants » ou « tous les événements » : chaque choix est
 * traduit ici en écritures (`SeriesPlan`) que l'écran applique ensuite par
 * le contrat de stockage, sans rien savoir de la règle.
 *
 * Le principe, pour « les suivants » et « tous » : on n'applique à la série
 * que **ce que l'utilisateur a changé** dans la fenêtre (la différence entre
 * ce qu'elle affichait et ce qu'on enregistre). Changer le titre d'une
 * occurrence déplacée à 19 h ne ramène donc pas toute la série à 19 h ; la
 * décaler d'un jour décale la série d'un jour.
 */
import { daysBetween, shiftDay } from './day';
import { baseOccurrence, splitSeries } from './recurrence';
import type { CalendarEvent, EventException, EventInput, EventOverride, ExceptionKind, Recurrence } from './types';
import { validateEvent } from './validation';

export const SCOPES = ['this', 'following', 'all'] as const;
export type Scope = (typeof SCOPES)[number];

/** Ce que la fenêtre montre d'une occurrence, exception appliquée. */
export type OccurrenceValues = Required<EventOverride>;

/** Les écritures à faire, dans cet ordre : créer, modifier, poser, retirer, supprimer. */
export interface SeriesPlan {
  create?: EventInput;
  update?: { id: string; patch: Partial<EventInput> };
  setException?: { eventId: string; occurrenceDay: string; kind: ExceptionKind; override?: EventOverride };
  /** Exceptions devenues sans objet */
  deleteExceptions: string[];
  deleteEvent?: string;
}

const OVERRIDABLE = ['title', 'allDay', 'startDay', 'endDay', 'startTime', 'endTime', 'color', 'location', 'note'] as const;
const PLAIN = ['title', 'color', 'location', 'note', 'allDay', 'startTime', 'endTime'] as const;

/** Une règle sans ses champs vides, jours de la semaine triés : deux règles égales s'écrivent pareil. */
function normalizeRule(rule: Recurrence | null | undefined): string {
  if (!rule) return 'null';
  return JSON.stringify({
    freq: rule.freq,
    interval: rule.interval || 1,
    byWeekday: rule.byWeekday && rule.byWeekday.length > 0 ? [...new Set(rule.byWeekday)].sort() : null,
    until: rule.until ?? null,
    count: rule.count ?? null,
  });
}

export const sameRule = (a: Recurrence | null | undefined, b: Recurrence | null | undefined) =>
  normalizeRule(a) === normalizeRule(b);

/** Une journée entière n'a pas d'heure : on le dit une fois pour toutes, avant de comparer. */
function normalize<T extends { allDay: boolean; startTime: string | null; endTime: string | null }>(v: T): T {
  return v.allDay ? { ...v, startTime: null, endTime: null } : v;
}

const exceptionsOf = (event: CalendarEvent, exceptions: readonly EventException[]) =>
  exceptions.filter((x) => x.eventId === event.id);

/**
 * La série telle que la veut la fenêtre : les champs changés s'appliquent,
 * les jours sont décalés d'autant que l'occurrence l'a été, et la durée en
 * jours ne change que si on l'a changée.
 */
function reshaped(event: CalendarEvent, from: string, before: OccurrenceValues, after: EventInput) {
  const b = normalize(before);
  const a = normalize({ ...before, ...after });
  const changed: Partial<EventInput> = {};
  for (const f of PLAIN) if (a[f] !== b[f]) (changed as Record<string, unknown>)[f] = a[f];

  const shift = daysBetween(b.startDay, a.startDay);
  const lengthBefore = daysBetween(b.startDay, b.endDay);
  const lengthAfter = daysBetween(a.startDay, a.endDay);
  const startDay = shiftDay(from, shift);
  const length = lengthAfter !== lengthBefore ? lengthAfter : daysBetween(event.startDay, event.endDay);
  return { changed, startDay, endDay: shiftDay(startDay, length), moved: shift !== 0 || length !== daysBetween(event.startDay, event.endDay) };
}

function checked(input: EventInput): EventInput {
  const problem = validateEvent(input);
  if (problem) throw new Error(problem);
  return input;
}

/**
 * Enregistrer les valeurs `after` d'une occurrence (le jour `occurrenceDay`
 * de la série), que la fenêtre affichait avec les valeurs `before`.
 * Lève une erreur lisible si la série qui en résulterait n'a pas de sens.
 */
export function planEdit(
  event: CalendarEvent,
  exceptions: readonly EventException[],
  occurrenceDay: string,
  before: OccurrenceValues,
  after: EventInput,
  scope: Scope,
): SeriesPlan {
  const own = exceptionsOf(event, exceptions);

  if (scope === 'this') {
    // L'exception décrit l'occurrence par rapport à la règle, pas par rapport
    // à ce qu'une exception précédente disait : elle la remplace entière.
    const base = normalize(baseOccurrence(event, occurrenceDay));
    const next = normalize({ ...before, ...after, recurrence: undefined });
    const override: EventOverride = {};
    for (const f of OVERRIDABLE) if (next[f] !== base[f]) (override as Record<string, unknown>)[f] = next[f];
    checked({ ...next, recurrence: null });
    const existing = own.find((x) => x.occurrenceDay === occurrenceDay);
    if (Object.keys(override).length === 0) return { deleteExceptions: existing ? [existing.id] : [] };
    return { setException: { eventId: event.id, occurrenceDay, kind: 'override', override }, deleteExceptions: [] };
  }

  const split = scope === 'following' ? splitSeries(event, occurrenceDay) : null;

  if (!split || split.before === null) {
    // « Tous », ou « les suivants » depuis la toute première : la série entière.
    const { changed, startDay, endDay, moved } = reshaped(event, event.startDay, before, after);
    const patch: Partial<EventInput> = { ...changed };
    if (moved) Object.assign(patch, { startDay, endDay });
    const ruleChanged = !sameRule(after.recurrence, event.recurrence);
    if (ruleChanged) patch.recurrence = after.recurrence ?? null;
    checked({ ...event, ...patch });
    // Décaler la série ou changer sa règle rend ses exceptions sans objet :
    // elles désignent des jours qui n'y sont plus.
    const stale = startDay !== event.startDay || ruleChanged ? own.map((x) => x.id) : [];
    return { update: { id: event.id, patch }, deleteExceptions: stale };
  }

  // « Cet événement et les suivants » : la série s'arrête la veille, une
  // nouvelle repart de cette occurrence avec les changements.
  const { changed, startDay, endDay } = reshaped(event, occurrenceDay, before, after);
  const recurrence = sameRule(after.recurrence, event.recurrence) ? split.after : (after.recurrence ?? null);
  const create = checked({
    title: event.title,
    allDay: event.allDay,
    startTime: event.startTime,
    endTime: event.endTime,
    color: event.color,
    location: event.location,
    note: event.note,
    timezone: event.timezone,
    ...changed,
    startDay,
    endDay,
    recurrence,
  });
  return {
    create,
    update: { id: event.id, patch: { recurrence: split.before } },
    deleteExceptions: own.filter((x) => x.occurrenceDay >= occurrenceDay).map((x) => x.id),
  };
}

/** Supprimer l'occurrence `occurrenceDay` d'une série, elle seule, avec les suivantes, ou toute la série. */
export function planDelete(
  event: CalendarEvent,
  exceptions: readonly EventException[],
  occurrenceDay: string,
  scope: Scope,
): SeriesPlan {
  if (scope === 'this') {
    return { setException: { eventId: event.id, occurrenceDay, kind: 'skip' }, deleteExceptions: [] };
  }
  const split = scope === 'following' ? splitSeries(event, occurrenceDay) : null;
  if (!split || split.before === null) return { deleteEvent: event.id, deleteExceptions: [] };
  return {
    update: { id: event.id, patch: { recurrence: split.before } },
    deleteExceptions: exceptionsOf(event, exceptions)
      .filter((x) => x.occurrenceDay >= occurrenceDay)
      .map((x) => x.id),
  };
}
