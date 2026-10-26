/**
 * Les outils de Calendar pour Claude (docs/connecteur-claude.md §14) — règles
 * pures, testées par Vitest (`src/modules/calendrier/lib/mcpTools.test.ts`),
 * qui compare chaque copie à la règle du module.
 *
 * Priorité n° 4 de l'analyse du 11/10/2026 : « qu'est-ce que j'ai demain ? »,
 * « mets le dentiste jeudi à 14 h », « décale le cours de mardi » — sans
 * ouvrir l'app. Une série répétée se modifie ou se supprime comme à l'écran :
 * cet événement, les suivants ou tous (`planEdit`, `planDelete`, recopiés).
 *
 * Les rappels sont **recalculés ici** après chaque écriture, comme l'écran le
 * fait à chaque chargement (`syncReminders`) : un rendez-vous noté par Claude
 * prévient à l'heure même si l'app n'est pas rouverte. Le serveur tourne en
 * UTC : les heures se lisent dans le fuseau de l'événement (`timezone`).
 *
 * Les calques des autres modules (tâches, séances, menu) ne sont pas rendus
 * ici : chacun a ses propres outils.
 */
import type { Tool, ToolResult } from './mcp.ts';
import { zonedDay, zonedInstant } from './zone.ts';
import { daysBetween, describeRecurrence, ruleDays, shiftDay, splitSeries, validateRecurrence, weekday, FREQUENCIES, type Recurrence } from './recurrence.ts';

export const EVENT_COLORS = ['bleu', 'vert', 'orange', 'rose', 'violet', 'gris'] as const;
export const TIMED_REMINDERS = [0, 5, 10, 15, 30, 60, 120, 1440] as const;
export const ALL_DAY_REMINDERS = [-480, 360] as const;
export const REMINDER_OFFSETS = [...ALL_DAY_REMINDERS, ...TIMED_REMINDERS] as const;
export const MAX_REMINDERS = 2;
export const REMINDER_HORIZON_DAYS = 30;
/** Au plus tant de jours lus d'un coup. */
export const READ_SPAN_MAX = 92;

export type EventColor = (typeof EVENT_COLORS)[number];

export interface CalendarEvent {
  id: string;
  title: string;
  allDay: boolean;
  startDay: string;
  endDay: string;
  startTime: string | null;
  endTime: string | null;
  timezone: string;
  recurrence: Recurrence | null;
  color: EventColor;
  location: string;
  note: string;
  reminders: number[] | null;
  /** « Travail » (14/10/2026), pour toute la série ; absent : personnel. */
  work?: boolean;
  /** Les variantes de la série (26/10/2026) ; absent : aucune. */
  variants?: EventVariant[];
  createdAt: string;
}

export type EventInput = Pick<CalendarEvent, 'title' | 'allDay' | 'startDay' | 'endDay' | 'startTime' | 'endTime'> &
  Partial<Pick<CalendarEvent, 'timezone' | 'recurrence' | 'color' | 'location' | 'note' | 'reminders' | 'work' | 'variants'>>;

export type EventOverride = Partial<
  Pick<CalendarEvent, 'title' | 'allDay' | 'startDay' | 'endDay' | 'startTime' | 'endTime' | 'color' | 'location' | 'note' | 'reminders'>
> & { variant?: string | null };

// --- Variantes (copie de `lib/variants.ts`) ------------------------------------

export interface EventVariant {
  id: string;
  name: string;
  color: EventColor | null;
  weekdays: number[];
}

export const VARIANTS_MAX = 6;
export const VARIANT_NAME_MAX = 40;

export function defaultVariantId(variants: readonly EventVariant[] | undefined, day: string): string | null {
  const wd = weekday(day);
  return (variants ?? []).find((v) => v.weekdays.includes(wd))?.id ?? null;
}

export function variantOf(variants: readonly EventVariant[] | undefined, day: string, chosen: string | null | undefined): EventVariant | null {
  const list = variants ?? [];
  if (chosen === null) return null;
  const picked = chosen === undefined ? undefined : list.find((v) => v.id === chosen);
  if (picked) return picked;
  const id = defaultVariantId(list, day);
  return list.find((v) => v.id === id) ?? null;
}

const foldName = (s: string) => s.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const nameWords = (s: string) => foldName(s).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function findVariant(variants: readonly EventVariant[] | undefined, name: string): EventVariant | undefined {
  const list = variants ?? [];
  return list.find((v) => foldName(v.name) === foldName(name)) ?? (nameWords(name) ? list.find((v) => nameWords(v.name) === nameWords(name)) : undefined);
}

export function validateVariants(variants: readonly EventVariant[] | undefined): string | null {
  const list = variants ?? [];
  if (list.length > VARIANTS_MAX) return `${VARIANTS_MAX} variantes au plus.`;
  const names = new Set<string>();
  const days = new Set<number>();
  for (const v of list) {
    if (!v.id || v.id.length > 40) return 'Une variante n’a pas d’identifiant.';
    const name = v.name.trim();
    if (!name) return 'Donne un nom à chaque variante.';
    if (name.length > VARIANT_NAME_MAX) return `Le nom d’une variante est trop long (${VARIANT_NAME_MAX} caractères au plus).`;
    if (names.has(foldName(name))) return `Deux variantes s’appellent « ${name} ».`;
    names.add(foldName(name));
    if (v.color !== null && !(EVENT_COLORS as readonly string[]).includes(v.color)) return 'Choisis la couleur d’une variante dans la liste.';
    for (const d of v.weekdays) {
      if (!Number.isInteger(d) || d < 0 || d > 6) return 'Un jour de variante n’existe pas.';
      if (days.has(d)) return 'Un même jour ne peut être d’office que dans une variante.';
      days.add(d);
    }
  }
  return null;
}

export const newVariantId = () => Math.random().toString(36).slice(2, 10);

export interface EventException {
  id: string;
  eventId: string;
  occurrenceDay: string;
  kind: 'skip' | 'override';
  override: EventOverride | null;
  createdAt: string;
}

export interface CalendarSettings {
  timedReminders: number[];
  allDayReminders: number[];
}

export interface ReminderInput {
  ref: string;
  fireAt: string;
  title: string;
  body: string;
  url?: string;
}

// --- Occurrences (copie de `lib/recurrence.ts` du module) --------------------

export interface Occurrence {
  eventId: string;
  occurrenceDay: string;
  title: string;
  allDay: boolean;
  startDay: string;
  endDay: string;
  startTime: string | null;
  endTime: string | null;
  color: CalendarEvent['color'];
  location: string;
  note: string;
  reminders: number[] | null;
  recurring: boolean;
  modified: boolean;
  work: boolean;
  variant: EventVariant | null;
}

export const baseOccurrence = (event: CalendarEvent, day: string): Occurrence => occurrenceOf(event, day, null);

function occurrenceOf(event: CalendarEvent, day: string, override: EventOverride | null): Occurrence {
  const length = daysBetween(event.startDay, event.endDay);
  const base: Occurrence = {
    eventId: event.id,
    occurrenceDay: day,
    title: event.title,
    allDay: event.allDay,
    startDay: day,
    endDay: shiftDay(day, length),
    startTime: event.startTime,
    endTime: event.endTime,
    color: event.color,
    location: event.location,
    note: event.note,
    reminders: event.reminders ?? null,
    recurring: event.recurrence !== null,
    modified: override !== null,
    work: event.work ?? false,
    variant: variantOf(event.variants, day, override?.variant),
  };
  if (!override) return base;
  const { variant: _chosen, ...fields } = override;
  if (Object.keys(fields).length === 0) return { ...base, modified: false };
  const merged = { ...base, ...fields };
  if (merged.allDay) {
    merged.startTime = null;
    merged.endTime = null;
  }
  return merged;
}

const overlaps = (o: Occurrence, from: string, to: string) => o.startDay <= to && o.endDay >= from;

export function expandEvents(events: readonly CalendarEvent[], exceptions: readonly EventException[], from: string, to: string): Occurrence[] {
  const byEvent = new Map<string, Map<string, EventException>>();
  for (const x of exceptions) {
    if (!byEvent.has(x.eventId)) byEvent.set(x.eventId, new Map());
    byEvent.get(x.eventId)!.set(x.occurrenceDay, x);
  }

  const result: Occurrence[] = [];
  for (const event of events) {
    const own = byEvent.get(event.id) ?? new Map<string, EventException>();
    const length = daysBetween(event.startDay, event.endDay);
    const days = new Set(ruleDays(event, shiftDay(from, -length), to));
    for (const [day, x] of own) {
      if (x.kind === 'override' && !days.has(day) && ruleDays(event, day, day).includes(day)) days.add(day);
    }
    for (const day of days) {
      const x = own.get(day);
      if (x?.kind === 'skip') continue;
      const occurrence = occurrenceOf(event, day, x?.kind === 'override' ? x.override : null);
      if (overlaps(occurrence, from, to)) result.push(occurrence);
    }
  }

  return result.sort(
    (a, b) =>
      a.startDay.localeCompare(b.startDay) ||
      Number(b.allDay) - Number(a.allDay) ||
      (a.startTime ?? '').localeCompare(b.startTime ?? '') ||
      a.title.localeCompare(b.title, 'fr'),
  );
}

// --- Validation (copie de `lib/validation.ts`) --------------------------------

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateEvent(input: EventInput): string | null {
  if (!input.title.trim()) return 'Donne un titre à l’événement.';
  if (input.title.trim().length > 120) return 'Le titre est trop long (120 caractères au plus).';
  if (!DAY.test(input.startDay) || !DAY.test(input.endDay)) return 'Choisis les jours de début et de fin.';
  if (input.endDay < input.startDay) return 'La fin ne peut pas être avant le début.';
  if (!input.allDay) {
    if (!input.startTime || !input.endTime || !TIME.test(input.startTime) || !TIME.test(input.endTime)) {
      return 'Indique une heure de début et une heure de fin.';
    }
    if (input.endDay === input.startDay && input.endTime <= input.startTime) {
      return 'La fin doit être après le début (ou le lendemain, pour une soirée qui passe minuit).';
    }
  }
  const reminders = validateReminders(input.reminders ?? null);
  if (reminders) return reminders;
  const variants = validateVariants(input.variants);
  if (variants) return variants;
  return input.recurrence ? validateRecurrence(input.recurrence, input.startDay) : null;
}

export function validateReminders(reminders: readonly number[] | null): string | null {
  if (reminders === null) return null;
  if (reminders.length > MAX_REMINDERS) return `${MAX_REMINDERS} rappels au plus.`;
  if (new Set(reminders).size !== reminders.length) return 'Les deux rappels sont identiques.';
  if (reminders.some((r) => !(REMINDER_OFFSETS as readonly number[]).includes(r))) return 'Choisis un rappel dans la liste.';
  return null;
}

// --- Séries : cet événement, les suivants, tous (copie de `lib/seriesEdit.ts`) -

export const SCOPES = ['this', 'following', 'all'] as const;
export type Scope = (typeof SCOPES)[number];
/** Ce que la fenêtre montre d'une occurrence, exception appliquée. */
export type OccurrenceValues = Required<Omit<EventOverride, 'variant'>> & { work?: boolean; variants?: EventVariant[] };

/**
 * Ce qu'on enregistre : un événement, et la variante choisie pour le jour
 * touché (`variantId`, 26/10/2026) — absente, celle du jour ne change pas.
 */
export type EditInput = EventInput & { variantId?: string | null };

/** Les écritures à faire, dans cet ordre : créer, modifier, poser, retirer, supprimer. */
export interface SeriesPlan {
  create?: EventInput;
  update?: { id: string; patch: Partial<EventInput> };
  setException?: { eventId: string; occurrenceDay: string; kind: 'skip' | 'override'; override?: EventOverride };
  /** Exceptions devenues sans objet */
  deleteExceptions: string[];
  /**
   * Les variantes choisies à la main, posées APRÈS les retraits sur la série
   * nouvelle (`create`) s'il y en a une, sinon sur celle modifiée (`update`) :
   * décaler une série ou la couper ne doit pas perdre les jours de télétravail.
   */
  carry?: { occurrenceDay: string; override: EventOverride }[];
  deleteEvent?: string;
}

const OVERRIDABLE = ['title', 'allDay', 'startDay', 'endDay', 'startTime', 'endTime', 'color', 'location', 'note', 'reminders'] as const;
const PLAIN = ['title', 'color', 'location', 'note', 'allDay', 'startTime', 'endTime', 'reminders', 'work', 'variants'] as const;

/** Les rappels sont une liste : deux listes égales ne sont pas le même objet. */
const same = (a: unknown, b: unknown) => (Array.isArray(a) || Array.isArray(b) ? JSON.stringify(a ?? null) === JSON.stringify(b ?? null) : a === b);

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
  for (const f of PLAIN) if (!same(a[f], b[f])) (changed as Record<string, unknown>)[f] = a[f];

  const shift = daysBetween(b.startDay, a.startDay);
  const lengthBefore = daysBetween(b.startDay, b.endDay);
  const lengthAfter = daysBetween(a.startDay, a.endDay);
  const startDay = shiftDay(from, shift);
  const length = lengthAfter !== lengthBefore ? lengthAfter : daysBetween(event.startDay, event.endDay);
  return { changed, startDay, endDay: shiftDay(startDay, length), moved: shift !== 0 || length !== daysBetween(event.startDay, event.endDay) };
}

/**
 * Les variantes choisies à la main à partir de `fromDay`, reportées d'autant
 * de jours que la série a bougé (`shift`). Le jour touché prend `chosen` s'il
 * est dit. Un choix égal à celui des jours n'est pas reporté : il n'en est
 * pas un.
 */
function carried(
  own: readonly EventException[],
  fromDay: string,
  shift: number,
  variants: readonly EventVariant[] | undefined,
  touched: { day: string; chosen: string | null | undefined },
): { occurrenceDay: string; override: EventOverride }[] {
  const choices = new Map<string, string | null>();
  for (const x of own) {
    const v = x.kind === 'override' ? x.override?.variant : undefined;
    if (x.occurrenceDay >= fromDay && v !== undefined) choices.set(x.occurrenceDay, v);
  }
  if (touched.chosen !== undefined) choices.set(touched.day, touched.chosen);
  const out: { occurrenceDay: string; override: EventOverride }[] = [];
  for (const [day, variant] of [...choices].sort(([a], [b]) => a.localeCompare(b))) {
    const occurrenceDay = shiftDay(day, shift);
    if (variant !== defaultVariantId(variants, occurrenceDay)) out.push({ occurrenceDay, override: { variant } });
  }
  return out;
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
  { variantId: chosen, ...after }: EditInput,
  scope: Scope,
): SeriesPlan {
  const own = exceptionsOf(event, exceptions);
  const existing = own.find((x) => x.occurrenceDay === occurrenceDay);
  const variants = after.variants ?? event.variants;

  if (scope === 'this') {
    // L'exception décrit l'occurrence par rapport à la règle, pas par rapport
    // à ce qu'une exception précédente disait : elle la remplace entière.
    const base = normalize(baseOccurrence(event, occurrenceDay));
    const next = normalize({ ...before, ...after, recurrence: undefined });
    const override: EventOverride = {};
    for (const f of OVERRIDABLE) if (!same(next[f], base[f])) (override as Record<string, unknown>)[f] = next[f];
    // La variante du jour : celle choisie, sinon celle déjà choisie — jamais perdue en route.
    const variant = chosen !== undefined ? chosen : existing?.override?.variant;
    if (variant !== undefined && variant !== defaultVariantId(variants, occurrenceDay)) override.variant = variant;
    checked({ ...next, recurrence: null });
    // « Travail » et les variantes valent pour toute la série (14/10, 26/10/2026) :
    // changés sur une occurrence, ils changent la série.
    const patch: Partial<EventInput> = {};
    if (after.work !== undefined && after.work !== (event.work ?? false)) patch.work = after.work;
    if (after.variants !== undefined && !same(after.variants, event.variants ?? [])) patch.variants = after.variants;
    const series = Object.keys(patch).length > 0 ? { update: { id: event.id, patch } } : {};
    if (Object.keys(override).length === 0) return { ...series, deleteExceptions: existing ? [existing.id] : [] };
    return { ...series, setException: { eventId: event.id, occurrenceDay, kind: 'override', override }, deleteExceptions: [] };
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
    if (startDay !== event.startDay || ruleChanged) {
      const carry = carried(own, event.startDay, daysBetween(event.startDay, startDay), variants, { day: occurrenceDay, chosen });
      return { update: { id: event.id, patch }, deleteExceptions: own.map((x) => x.id), ...(carry.length ? { carry } : {}) };
    }
    // Les exceptions restent : seule celle du jour touché change, si sa variante change.
    const kept = existing?.kind === 'override' ? existing.override?.variant : undefined;
    if (chosen === undefined || chosen === (kept !== undefined ? kept : defaultVariantId(variants, occurrenceDay))) {
      return { update: { id: event.id, patch }, deleteExceptions: [] };
    }
    const { variant: _old, ...fields } = existing?.kind === 'override' ? (existing.override ?? {}) : {};
    const override: EventOverride = chosen === defaultVariantId(variants, occurrenceDay) ? fields : { ...fields, variant: chosen };
    if (Object.keys(override).length === 0) return { update: { id: event.id, patch }, deleteExceptions: existing ? [existing.id] : [] };
    return { update: { id: event.id, patch }, deleteExceptions: [], carry: [{ occurrenceDay, override }] };
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
    reminders: event.reminders ?? null,
    timezone: event.timezone,
    work: event.work ?? false,
    variants: event.variants ?? [],
    ...changed,
    startDay,
    endDay,
    recurrence,
  });
  const carry = carried(own, occurrenceDay, daysBetween(occurrenceDay, startDay), create.variants, { day: occurrenceDay, chosen });
  return {
    create,
    update: { id: event.id, patch: { recurrence: split.before } },
    deleteExceptions: own.filter((x) => x.occurrenceDay >= occurrenceDay).map((x) => x.id),
    ...(carry.length ? { carry } : {}),
  };
}

export function planDelete(event: CalendarEvent, exceptions: readonly EventException[], occurrenceDay: string, scope: Scope): SeriesPlan {
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

// --- Rappels (copie de `lib/reminders.ts`, l'heure lue dans le fuseau de l'événement) --

export { zonedDay, zonedInstant };

const TEXT_MAX = 1000;
const clip = (text: string) => (text.length <= TEXT_MAX ? text : `${text.slice(0, TEXT_MAX - 1).trimEnd()}…`);

export function hourLabel(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

export function effectiveReminders(reminders: readonly number[] | null, allDay: boolean, settings: CalendarSettings): number[] {
  const allowed: readonly number[] = allDay ? ALL_DAY_REMINDERS : TIMED_REMINDERS;
  const defaults = allDay ? settings.allDayReminders : settings.timedReminders;
  if (reminders === null) return [...new Set(defaults)];
  const fitting = reminders.filter((r) => allowed.includes(r));
  if (reminders.length > 0 && fitting.length === 0) return [...new Set(defaults)];
  return [...new Set(fitting)];
}

function dayLabel(day: string, from: string): string {
  const gap = daysBetween(from, day);
  if (gap === 0) return 'Aujourd’hui';
  if (gap === 1) return 'Demain';
  const [y, m, d] = day.split('-').map(Number);
  const label = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function bodyOf(o: Occurrence, fireDay: string): string {
  const when = o.allDay
    ? `${dayLabel(o.startDay, fireDay)}, toute la journée`
    : `${dayLabel(o.startDay, fireDay)}, ${hourLabel(o.startTime!)} – ${hourLabel(o.endTime!)}`;
  return clip(o.location ? `${when} · ${o.location}` : when);
}

/** Les rappels à venir de tout le calendrier, comme `plannedReminders` du module. */
export function plannedReminders(
  events: readonly CalendarEvent[],
  exceptions: readonly EventException[],
  settings: CalendarSettings,
  now: Date,
  homeZone: string,
  horizonDays = REMINDER_HORIZON_DAYS,
): ReminderInput[] {
  const today = zonedDay(now, homeZone);
  const last = shiftDay(today, horizonDays);
  const zoneOf = new Map(events.map((e) => [e.id, e.timezone || homeZone]));
  const reminders: ReminderInput[] = [];

  for (const o of expandEvents(events, exceptions, today, last)) {
    const zone = zoneOf.get(o.eventId) ?? homeZone;
    const start = zonedInstant(o.startDay, o.allDay ? '00:00' : o.startTime!, zone);
    for (const offset of effectiveReminders(o.reminders, o.allDay, settings)) {
      const at = new Date(start.getTime() - offset * 60_000);
      if (at <= now) continue;
      reminders.push({
        ref: `event:${o.eventId}:${o.occurrenceDay}:${offset}`,
        fireAt: at.toISOString(),
        title: clip(o.title),
        body: bodyOf(o, zonedDay(at, zone)),
        url: '/#/calendrier',
      });
    }
  }

  return reminders.sort((a, b) => a.fireAt.localeCompare(b.fireAt) || a.ref.localeCompare(b.ref));
}

// --- Les outils ---------------------------------------------------------------

export interface CalendarData {
  listEvents(): Promise<CalendarEvent[]>;
  listExceptions(): Promise<EventException[]>;
  getSettings(): Promise<CalendarSettings>;
  createEvent(input: EventInput): Promise<CalendarEvent>;
  updateEvent(id: string, patch: Partial<EventInput>): Promise<void>;
  deleteEvent(id: string): Promise<void>;
  setException(eventId: string, occurrenceDay: string, kind: 'skip' | 'override', override?: EventOverride): Promise<void>;
  deleteException(id: string): Promise<void>;
  /** Remplace les rappels à venir du calendrier (`coreStore.scheduleReminders('calendrier', …)`). */
  scheduleReminders(reminders: ReminderInput[]): Promise<void>;
}

export interface CalendarContext {
  data: CalendarData;
  today: string;
  now: Date;
  /** Le fuseau de Jules : celui des nouveaux événements. */
  timezone: string;
}

class Refused extends Error {}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (value: unknown): ToolResult => ({ text: JSON.stringify(value, null, 2) });

function id(v: unknown): string {
  if (typeof v !== 'string' || !UUID.test(v)) throw new Refused('event_id invalide : prends-le dans calendrier_evenements.');
  return v.toLowerCase();
}

function day(v: unknown, what: string): string {
  if (typeof v !== 'string' || !DAY.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) throw new Refused(`${what} s’écrit AAAA-MM-JJ.`);
  return v;
}

function time(v: unknown, what: string): string {
  if (typeof v !== 'string') throw new Refused(`${what} s’écrit HH:MM.`);
  const t = v.trim().replace(/h/i, ':').replace(/:$/, ':00');
  const padded = /^\d:/.test(t) ? `0${t}` : t;
  if (!TIME.test(padded)) throw new Refused(`${what} s’écrit HH:MM (24 h).`);
  return padded;
}

function str(v: unknown, what: string, max: number): string {
  if (v === null) return '';
  if (typeof v !== 'string') throw new Refused(`${what} doit être un texte.`);
  if (v.trim().length > max) throw new Refused(`${what} : ${max} caractères au plus.`);
  return v.trim();
}

/** `repeat` dans la forme des autres outils → la règle du moteur commun. `null` = ne se répète plus. */
export function readRepeat(v: unknown, startDay: string): Recurrence | null {
  if (v === null) return null;
  if (typeof v !== 'object' || Array.isArray(v)) throw new Refused('repeat : un objet { freq, interval, … }, ou null.');
  const o = v as Record<string, unknown>;
  if (!(FREQUENCIES as readonly string[]).includes(String(o.freq))) throw new Refused(`repeat.freq : ${FREQUENCIES.join(', ')}.`);
  const rule: Recurrence = { freq: o.freq as Recurrence['freq'], interval: o.interval === undefined ? 1 : Number(o.interval) };
  if (Array.isArray(o.by_weekday)) rule.byWeekday = o.by_weekday.map(Number);
  if (o.nth !== undefined && o.nth_weekday !== undefined) rule.byNthWeekday = { nth: Number(o.nth) as 1, weekday: Number(o.nth_weekday) };
  if (o.until !== undefined && o.until !== null) rule.until = day(o.until, 'repeat.until');
  if (o.count !== undefined && o.count !== null) rule.count = Number(o.count);
  const problem = validateRecurrence(rule, startDay);
  if (problem) throw new Refused(problem);
  return rule;
}

function readReminders(v: unknown): number[] | null {
  if (v === null) return null;
  if (!Array.isArray(v)) throw new Refused('reminders : une liste de minutes avant (ex. [15]), [] pour aucun, null pour ceux par défaut.');
  const list = v.map(Number);
  const problem = validateReminders(list);
  if (problem) throw new Refused(`${problem} Valeurs : ${REMINDER_OFFSETS.join(', ')} (−480 = le jour même à 8 h, 360 = la veille à 18 h, pour une journée entière).`);
  return list;
}

/**
 * Les variantes données par Claude : `[{ name, color?, weekdays? }]`, la liste
 * entière. Une variante qui garde son nom garde son identifiant — et donc les
 * jours qui l'ont déjà prise.
 */
export function readVariants(v: unknown, existing: readonly EventVariant[] | undefined): EventVariant[] {
  if (!Array.isArray(v)) throw new Refused('variants : une liste de { name, color?, weekdays? }.');
  const out = v.map((raw): EventVariant => {
    if (!raw || typeof raw !== 'object') throw new Refused('variants : chaque variante est un objet { name, color?, weekdays? }.');
    const r = raw as Record<string, unknown>;
    const name = str(r.name, 'Le nom d’une variante', VARIANT_NAME_MAX).trim();
    const color = r.color === undefined || r.color === null ? null : readColor(r.color);
    const weekdays = r.weekdays === undefined ? [] : r.weekdays;
    if (!Array.isArray(weekdays) || weekdays.some((d) => !Number.isInteger(d))) throw new Refused('weekdays : des jours de 0 (dimanche) à 6 (samedi).');
    return { id: findVariant(existing, name)?.id ?? newVariantId(), name, color, weekdays: [...new Set(weekdays as number[])].sort() };
  });
  const problem = validateVariants(out);
  if (problem) throw new Refused(problem);
  return out;
}

function readColor(v: unknown): EventColor {
  if (!(EVENT_COLORS as readonly string[]).includes(String(v))) throw new Refused(`color : ${EVENT_COLORS.join(', ')}.`);
  return v as EventColor;
}

/** Une heure + des minutes, avec le jour qui suit si l'on passe minuit. */
function addMinutes(dayStr: string, hhmm: string, minutes: number): { day: string; time: string } {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const days = Math.floor(total / 1440);
  const rest = total - days * 1440;
  return { day: shiftDay(dayStr, days), time: `${String(Math.floor(rest / 60)).padStart(2, '0')}:${String(rest % 60).padStart(2, '0')}` };
}

/**
 * Les champs demandés appliqués à des valeurs de départ (celles de
 * l'occurrence, ou rien pour un nouvel événement). Changer le jour déplace
 * aussi la fin d'autant ; une heure de début sans fin donne une heure ; sans
 * heure du tout, c'est une journée entière.
 */
export function applyFields(start: OccurrenceValues, args: Record<string, unknown>): OccurrenceValues {
  const v = { ...start };
  const has = (k: string) => args[k] !== undefined;
  if (has('title')) v.title = str(args.title, 'Le titre', 120);
  if (has('location')) v.location = str(args.location, 'Le lieu', 200);
  if (has('note')) v.note = str(args.note, 'La note', 2000);
  if (has('color')) v.color = readColor(args.color);
  if (has('reminders')) v.reminders = readReminders(args.reminders);
  if (has('day')) {
    const length = daysBetween(v.startDay, v.endDay);
    v.startDay = day(args.day, 'day');
    v.endDay = shiftDay(v.startDay, length);
  }
  if (has('end_day')) v.endDay = day(args.end_day, 'end_day');
  if (args.all_day === true) {
    v.allDay = true;
    v.startTime = null;
    v.endTime = null;
  } else if (has('start_time') || has('end_time') || args.all_day === false) {
    const lengthMin = v.allDay || !v.startTime || !v.endTime ? 60 : daysBetween(v.startDay, v.endDay) * 1440 + minutesOf(v.endTime) - minutesOf(v.startTime);
    v.allDay = false;
    if (has('start_time')) v.startTime = time(args.start_time, 'start_time');
    if (!v.startTime) throw new Refused('Donne une heure de début (start_time), ou all_day: true.');
    if (has('end_time')) v.endTime = time(args.end_time, 'end_time');
    if (has('duration_minutes') || !has('end_time')) {
      const minutes = has('duration_minutes') ? Number(args.duration_minutes) : lengthMin;
      if (!Number.isInteger(minutes) || minutes < 5 || minutes > 7 * 1440) throw new Refused('duration_minutes : de 5 minutes à 7 jours.');
      const end = addMinutes(v.startDay, v.startTime, minutes);
      v.endDay = has('end_day') ? v.endDay : end.day;
      v.endTime = end.time;
    } else if (!has('end_day') && v.endTime! <= v.startTime) {
      // 22:00 → 01:00 : la fin est le lendemain.
      v.endDay = shiftDay(v.startDay, 1);
    } else if (!has('end_day')) {
      v.endDay = v.startDay;
    }
  }
  return v;
}

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const occurrenceOut = (o: Occurrence, events: readonly CalendarEvent[]) => {
  const e = events.find((x) => x.id === o.eventId);
  return {
    event_id: o.eventId,
    occurrence_day: o.recurring ? o.occurrenceDay : undefined,
    title: o.title,
    day: o.startDay,
    end_day: o.endDay !== o.startDay ? o.endDay : undefined,
    all_day: o.allDay || undefined,
    start_time: o.startTime ?? undefined,
    end_time: o.endTime ?? undefined,
    location: o.location || undefined,
    note: o.note || undefined,
    color: o.color,
    reminders: o.reminders ?? 'défaut',
    repeat: e?.recurrence ? describeRecurrence(e.recurrence, e.startDay) : undefined,
    modified_occurrence: o.modified || undefined,
    variant: o.variant?.name,
    variants: e?.variants?.length ? e.variants.map((v) => ({ name: v.name, color: v.color ?? undefined, weekdays: v.weekdays.length ? v.weekdays : undefined })) : undefined,
  };
};

/** Applique un plan dans l'ordre de l'écran : créer, modifier, poser, retirer, supprimer. */
async function applyPlan(data: CalendarData, plan: SeriesPlan, timezone: string): Promise<CalendarEvent | null> {
  const created = plan.create ? await data.createEvent({ timezone, ...plan.create }) : null;
  if (plan.update) await data.updateEvent(plan.update.id, plan.update.patch);
  if (plan.setException) await data.setException(plan.setException.eventId, plan.setException.occurrenceDay, plan.setException.kind, plan.setException.override);
  for (const x of plan.deleteExceptions) await data.deleteException(x);
  const target = created?.id ?? plan.update?.id;
  if (target) for (const c of plan.carry ?? []) await data.setException(target, c.occurrenceDay, 'override', c.override);
  if (plan.deleteEvent) await data.deleteEvent(plan.deleteEvent);
  return created;
}

/** Les rappels recalculés après une écriture ; un échec n'annule pas l'écriture, il est dit. */
async function resync(ctx: CalendarContext): Promise<string | undefined> {
  try {
    const [events, exceptions, settings] = await Promise.all([ctx.data.listEvents(), ctx.data.listExceptions(), ctx.data.getSettings()]);
    await ctx.data.scheduleReminders(plannedReminders(events, exceptions, settings, ctx.now, ctx.timezone));
    return undefined;
  } catch (err) {
    return `Les rappels n’ont pas pu être recalculés (${err instanceof Error ? err.message : 'erreur'}) : ils le seront à la prochaine ouverture de Calendar.`;
  }
}

const SCOPE_IN: Record<string, Scope> = { cet_evenement: 'this', les_suivants: 'following', tous: 'all' };

/** L'événement et l'occurrence visés ; une série demande le jour et la portée. */
async function target(args: Record<string, unknown>, data: CalendarData) {
  const eventId = id(args.event_id);
  const [events, exceptions] = await Promise.all([data.listEvents(), data.listExceptions()]);
  const event = events.find((e) => e.id === eventId);
  if (!event) throw new Refused('Aucun événement avec cet identifiant.');
  if (!event.recurrence) return { event, exceptions, occurrenceDay: event.startDay, scope: 'all' as Scope };
  if (args.occurrence_day === undefined) throw new Refused('Événement répété : donne occurrence_day (le jour de l’occurrence visée, rendu par calendrier_evenements) et scope.');
  const occurrenceDay = day(args.occurrence_day, 'occurrence_day');
  if (!ruleDays(event, occurrenceDay, occurrenceDay).includes(occurrenceDay)) throw new Refused('Ce jour n’est pas une occurrence de la série.');
  const scope = SCOPE_IN[String(args.scope)];
  if (!scope) throw new Refused('Événement répété : scope = cet_evenement, les_suivants ou tous. Demande à l’utilisateur si ce n’est pas clair.');
  return { event, exceptions, occurrenceDay, scope };
}

const FIELDS = {
  title: { type: 'string', maxLength: 120 },
  day: { type: 'string', description: 'AAAA-MM-JJ, le jour (de début).' },
  end_day: { type: 'string', description: 'AAAA-MM-JJ, pour un événement sur plusieurs jours.' },
  all_day: { type: 'boolean', description: 'Journée entière (par défaut sans heure).' },
  start_time: { type: 'string', description: 'HH:MM, heure locale.' },
  end_time: { type: 'string', description: 'HH:MM ; sinon une heure (ou duration_minutes).' },
  duration_minutes: { type: 'integer' },
  location: { type: 'string', maxLength: 200 },
  note: { type: 'string', maxLength: 2000 },
  color: { type: 'string', enum: [...EVENT_COLORS] },
  reminders: {
    type: ['array', 'null'],
    items: { type: 'integer', enum: [...REMINDER_OFFSETS] },
    maxItems: 2,
    description: 'Minutes avant (avec une heure : 0, 5, 10, 15, 30, 60, 120, 1440 ; journée entière : −480 = le jour même à 8 h, 360 = la veille à 18 h). [] = aucun, null = ceux des réglages.',
  },
  repeat: {
    type: ['object', 'null'],
    description: 'Répétition : { freq: daily|weekly|monthly|yearly, interval?, by_weekday? (0 = dimanche, 1 = lundi … 6 = samedi), nth? (1-4 ou -1) + nth_weekday?, until? (AAAA-MM-JJ), count? }. null = ne se répète plus.',
  },
  variants: {
    type: 'array',
    maxItems: VARIANTS_MAX,
    description:
      'Seulement pour un événement répété : ses variantes, la liste ENTIÈRE (elle remplace l’ancienne ; [] = aucune), pour toute la série. Chacune { name (« Bureau », « 🏠 Télétravail »), color? (une couleur de la liste, sinon celle de l’événement), weekdays? (jours où elle est prise d’office, 0 = dimanche … 6 = samedi ; un jour dans une seule variante) }. Une variante qui garde son nom garde les jours déjà choisis. Le choix d’un jour précis : calendrier_variante.',
    items: { type: 'object', properties: { name: { type: 'string', maxLength: VARIANT_NAME_MAX }, color: { type: ['string', 'null'], enum: [...EVENT_COLORS, null] }, weekdays: { type: 'array', items: { type: 'integer', minimum: 0, maximum: 6 } } }, required: ['name'] },
  },
};

export const calendarTools: Tool<CalendarContext>[] = [
  {
    name: 'calendrier_evenements',
    title: 'Lire le calendrier',
    description:
      'Les événements de Calendar entre deux jours (aujourd’hui et les 13 jours suivants par défaut), séries répétées dépliées. Une occurrence d’une série porte occurrence_day, à rendre pour la modifier. Les tâches, les séances de sport et le menu sont dans leurs propres outils.',
    inputSchema: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' }, query: { type: 'string', description: 'Mots du titre, du lieu ou de la note.' } } },
    annotations: { readOnlyHint: true },
    async run(args, { data, today }) {
      const from = args.from === undefined ? today : day(args.from, 'from');
      const to = args.to === undefined ? shiftDay(from, 13) : day(args.to, 'to');
      if (to < from) throw new Refused('to avant from.');
      if (daysBetween(from, to) > READ_SPAN_MAX) throw new Refused(`${READ_SPAN_MAX} jours au plus à la fois.`);
      const [events, exceptions] = await Promise.all([data.listEvents(), data.listExceptions()]);
      const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const words = typeof args.query === 'string' ? fold(args.query).split(/\s+/).filter(Boolean) : [];
      const found = expandEvents(events, exceptions, from, to).filter((o) => words.every((w) => fold(`${o.title} ${o.location} ${o.note}`).includes(w)));
      return json({ from, to, events: found.map((o) => occurrenceOut(o, events)) });
    },
  },
  {
    name: 'calendrier_ajouter',
    title: 'Ajouter un événement',
    description:
      'Ajoute un événement : un rendez-vous (day + start_time, une heure par défaut), une journée entière (day seul), plusieurs jours (end_day), ou une série (repeat). Les rappels suivent les réglages si reminders n’est pas donné.',
    inputSchema: { type: 'object', properties: FIELDS, required: ['title', 'day'] },
    annotations: {},
    async run(args, ctx) {
      const startDay = day(args.day, 'day');
      const empty: OccurrenceValues = {
        title: '',
        allDay: true,
        startDay,
        endDay: startDay,
        startTime: null,
        endTime: null,
        color: 'bleu',
        location: '',
        note: '',
        reminders: null,
      };
      const v = applyFields(empty, args);
      const input: EventInput = { ...v, timezone: ctx.timezone, recurrence: args.repeat === undefined ? null : readRepeat(args.repeat, v.startDay) };
      if (args.variants !== undefined) {
        if (!input.recurrence) throw new Refused('Les variantes sont pour un événement répété (repeat).');
        input.variants = readVariants(args.variants, []);
      }
      const problem = validateEvent(input);
      if (problem) throw new Refused(problem);
      const created = await ctx.data.createEvent(input);
      const warning = await resync(ctx);
      return json({ message: 'Événement ajouté.', event: occurrenceOut(baseOccurrence(created, created.startDay), [created]), warning });
    },
  },
  {
    name: 'calendrier_modifier',
    title: 'Modifier un événement',
    description:
      'Change un événement : titre, jour (le déplace), heures, lieu, note, couleur, rappels, répétition, variantes (la liste, pour toute la série). Pour une série : occurrence_day et scope (cet_evenement, les_suivants, tous) — comme dans l’app, seul ce qui change est appliqué à la série. Ne donne que les champs à changer.',
    inputSchema: {
      type: 'object',
      properties: {
        event_id: { type: 'string' },
        occurrence_day: { type: 'string' },
        scope: { type: 'string', enum: Object.keys(SCOPE_IN) },
        ...FIELDS,
      },
      required: ['event_id'],
    },
    annotations: { idempotentHint: true },
    async run(args, ctx) {
      const { event, exceptions, occurrenceDay, scope } = await target(args, ctx.data);
      // L'occurrence telle qu'à l'écran, exception comprise — même déplacée à un autre jour.
      const own = exceptions.find((x) => x.eventId === event.id && x.occurrenceDay === occurrenceDay);
      if (own?.kind === 'skip') throw new Refused('Cette occurrence a été supprimée.');
      const occurrence = occurrenceOf(event, occurrenceDay, own?.kind === 'override' ? own.override : null);
      const before: OccurrenceValues = {
        title: occurrence.title,
        allDay: occurrence.allDay,
        startDay: occurrence.startDay,
        endDay: occurrence.endDay,
        startTime: occurrence.startTime,
        endTime: occurrence.endTime,
        color: occurrence.color,
        location: occurrence.location,
        note: occurrence.note,
        reminders: occurrence.reminders,
        variants: event.variants ?? [],
      };
      const values = applyFields(before, args);
      if (args.variants !== undefined) values.variants = readVariants(args.variants, event.variants);
      if (args.repeat !== undefined && scope === 'this') throw new Refused('Changer la répétition vaut pour les suivants ou toute la série, pas pour un seul événement.');
      const recurrence = args.repeat === undefined ? event.recurrence : readRepeat(args.repeat, scope === 'following' ? values.startDay : event.startDay);
      if (args.variants !== undefined && !recurrence) throw new Refused('Les variantes sont pour un événement répété.');
      let plan: SeriesPlan;
      try {
        plan = planEdit(event, exceptions, occurrenceDay, before, { ...values, recurrence }, scope);
      } catch (err) {
        throw new Refused(err instanceof Error ? err.message : 'Modification impossible.');
      }
      await applyPlan(ctx.data, plan, event.timezone);
      const warning = await resync(ctx);
      return json({ message: scope === 'this' ? 'Cet événement est modifié.' : scope === 'following' ? 'Cet événement et les suivants sont modifiés.' : 'Événement modifié.', warning });
    },
  },
  {
    name: 'calendrier_variante',
    title: 'Choisir la variante de certains jours',
    description:
      'Pour un événement répété qui a des variantes (« Travail » au bureau ou en télétravail…) : choisit la variante de un ou plusieurs jours, pour ces jours seulement — le reste de l’événement ne change pas, rien à demander sur la portée. variant = le nom d’une variante, ou null = sans variante ce jour-là ; reset: true = revenir à la variante prévue par ses jours. Les variantes et leurs jours d’office se règlent avec calendrier_modifier (variants).',
    inputSchema: {
      type: 'object',
      properties: {
        event_id: { type: 'string' },
        days: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 31, description: 'AAAA-MM-JJ, des occurrences de la série (occurrence_day).' },
        variant: { type: ['string', 'null'] },
        reset: { type: 'boolean' },
      },
      required: ['event_id', 'days'],
    },
    annotations: { idempotentHint: true },
    async run(args, ctx) {
      const eventId = id(args.event_id);
      const [events, exceptions] = await Promise.all([ctx.data.listEvents(), ctx.data.listExceptions()]);
      const event = events.find((e) => e.id === eventId);
      if (!event) throw new Refused('Aucun événement avec cet identifiant.');
      if (!event.recurrence || !event.variants?.length) throw new Refused('Cet événement n’a pas de variantes : ajoute-les d’abord (calendrier_modifier, variants, scope tous).');
      if (!Array.isArray(args.days) || args.days.length === 0 || args.days.length > 31) throw new Refused('days : de 1 à 31 jours.');
      const reset = args.reset === true;
      let chosen: string | null = null;
      if (!reset) {
        if (args.variant === undefined) throw new Refused('Donne variant (un nom, ou null pour aucune) ou reset: true.');
        if (args.variant !== null) {
          const found = findVariant(event.variants, str(args.variant, 'variant', VARIANT_NAME_MAX));
          if (!found) throw new Refused(`Variante inconnue. Celles de « ${event.title} » : ${event.variants.map((v) => v.name).join(', ')}.`);
          chosen = found.id;
        }
      }
      const days = [...new Set(args.days.map((d) => day(d, 'days')))].sort();
      for (const d of days) {
        if (!ruleDays(event, d, d).includes(d)) throw new Refused(`Le ${d} n’est pas une occurrence de « ${event.title} ».`);
        const own = exceptions.find((x) => x.eventId === event.id && x.occurrenceDay === d);
        if (own?.kind === 'skip') throw new Refused(`L’occurrence du ${d} a été supprimée.`);
      }
      for (const d of days) {
        const own = exceptions.find((x) => x.eventId === event.id && x.occurrenceDay === d);
        const o = occurrenceOf(event, d, own?.kind === 'override' ? own.override : null);
        const before: OccurrenceValues = {
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
        };
        const variantId = reset ? defaultVariantId(event.variants, d) : chosen;
        await applyPlan(ctx.data, planEdit(event, exceptions, d, before, { ...before, recurrence: event.recurrence, variantId }, 'this'), event.timezone);
      }
      const what = reset ? 'la variante prévue par ses jours' : chosen === null ? 'sans variante' : `« ${findVariant(event.variants, String(args.variant))!.name} »`;
      return json({ message: `« ${event.title} » : ${what}, ${days.length === 1 ? `le ${days[0]}` : `les ${days.join(', ')}`}.` });
    },
  },
  {
    name: 'calendrier_supprimer',
    title: 'Supprimer un événement',
    description:
      'Supprime un événement ; pour une série, occurrence_day et scope (cet_evenement, les_suivants, tous). Demande confirmation avant, en disant ce qui sera supprimé.',
    inputSchema: {
      type: 'object',
      properties: { event_id: { type: 'string' }, occurrence_day: { type: 'string' }, scope: { type: 'string', enum: Object.keys(SCOPE_IN) } },
      required: ['event_id'],
    },
    annotations: { destructiveHint: true },
    async run(args, ctx) {
      const { event, exceptions, occurrenceDay, scope } = await target(args, ctx.data);
      await applyPlan(ctx.data, planDelete(event, exceptions, occurrenceDay, scope), event.timezone);
      const warning = await resync(ctx);
      const message =
        scope === 'this'
          ? `L’occurrence du ${occurrenceDay} de « ${event.title} » est supprimée.`
          : scope === 'following'
            ? `« ${event.title} » est supprimé à partir du ${occurrenceDay}.`
            : `« ${event.title} » est supprimé.`;
      return json({ message, warning });
    },
  },
];
