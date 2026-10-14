/**
 * Lire un calendrier exporté au format iCalendar (`.ics`, RFC 5545) —
 * bibliothèque pure, testée (docs/etude-calendrier.md §20).
 *
 * Demande de Jules (14/10/2026) : importer son calendrier Apple dans Atlas
 * sans effacer ce qui y est déjà. L'app Calendrier du Mac exporte un `.ics`
 * par calendrier (*Fichier → Exporter*) ; ce module le traduit en événements
 * d'Atlas, que l'écran montre avant d'enregistrer.
 *
 * Les choix, dans l'ordre où ils comptent :
 *
 *  · **Rien n'est deviné.** Une répétition qu'Atlas ne sait pas reproduire
 *    (« le 1er et le 15 de chaque mois ») n'est pas approchée : l'événement
 *    entre une fois, et l'aperçu le dit.
 *  · **Les heures sont celles de l'appareil.** Atlas range une heure locale
 *    (`HH:MM`) avec un fuseau ; un rendez-vous à 9 h à New York devient
 *    l'heure correspondante à Paris. Une heure « flottante » (sans fuseau)
 *    reste telle quelle.
 *  · **Chaque événement garde son identifiant Apple** (`UID`) : réimporter le
 *    même fichier n'ajoute que ce qui est nouveau (`importEvents`).
 *  · Les invités, les réponses aux invitations et les pièces jointes, qu'Atlas
 *    n'a pas, sont ignorés.
 */
import { shiftDay, weekday } from '../../../core/lib/day';
import { NTH_VALUES, type Nth, type Recurrence } from '../../../core/lib/recurrence';
import { ALL_DAY_REMINDERS, MAX_REMINDERS, TIMED_REMINDERS, type EventInput, type EventOverride } from './types';
import { validateEvent } from './validation';

export const TITLE_MAX = 120;
export const LOCATION_MAX = 200;
export const NOTE_MAX = 2000;
export const UID_MAX = 300;

export interface ImportedException {
  occurrenceDay: string;
  kind: 'skip' | 'override';
  override?: EventOverride;
}

export interface ImportedEvent {
  /** L'identifiant de l'événement dans le calendrier d'origine */
  uid: string;
  event: EventInput;
  exceptions: ImportedException[];
}

export interface IcsImport {
  /** Le nom du calendrier (`X-WR-CALNAME`), s'il est donné */
  calendarName: string | null;
  events: ImportedEvent[];
  /** Ce qui n'a pas pu être repris tel quel, en toutes lettres, un par événement */
  warnings: string[];
}

// --- Lignes et propriétés ---------------------------------------------------------

interface Property {
  name: string;
  params: Record<string, string>;
  value: string;
}

/** Les lignes logiques : une ligne qui commence par une espace prolonge la précédente (RFC 5545 §3.1). */
function unfold(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/\n[ \t]/g, '')
    .split('\n')
    .filter((l) => l.length > 0);
}

function parseProperty(line: string): Property | null {
  let quoted = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') quoted = !quoted;
    else if (line[i] === ':' && !quoted) {
      colon = i;
      break;
    }
  }
  if (colon < 0) return null;
  const [rawName, ...rawParams] = line.slice(0, colon).split(';');
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name: rawName.toUpperCase(), params, value: line.slice(colon + 1) };
}

/** Le texte d'une propriété : `\n`, `\,`, `\;` et `\\` (RFC 5545 §3.3.11). */
export function unescapeText(value: string): string {
  return value.replace(/\\([nN,;\\])/g, (_m, c: string) => (c === 'n' || c === 'N' ? '\n' : c));
}

interface Component {
  type: string;
  props: Property[];
  children: Component[];
}

function parseComponents(text: string): Component[] {
  const root: Component = { type: 'ROOT', props: [], children: [] };
  const stack: Component[] = [root];
  for (const line of unfold(text)) {
    const p = parseProperty(line);
    if (!p) continue;
    const top = stack[stack.length - 1];
    if (p.name === 'BEGIN') {
      const c: Component = { type: p.value.trim().toUpperCase(), props: [], children: [] };
      top.children.push(c);
      stack.push(c);
    } else if (p.name === 'END') {
      if (stack.length > 1) stack.pop();
    } else {
      top.props.push(p);
    }
  }
  return root.children;
}

const prop = (c: Component, name: string) => c.props.find((p) => p.name === name);
const props = (c: Component, name: string) => c.props.filter((p) => p.name === name);

// --- Dates, heures, fuseaux --------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, '0');

/** L'écart (minutes) entre l'heure d'un fuseau et l'UTC à un instant donné. */
function zoneOffset(ms: number, timeZone: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date(ms))
      .map((x) => [x.type, x.value]),
  );
  const local = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  return Math.round((local - Math.floor(ms / 60_000) * 60_000) / 60_000);
}

function isTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** L'instant (ms UTC) d'une heure murale dans un fuseau. */
function wallToUtc(y: number, mo: number, d: number, h: number, mi: number, tz: string): number {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const first = zoneOffset(guess, tz);
  let t = guess - first * 60_000;
  const second = zoneOffset(t, tz);
  if (second !== first) t = guess - second * 60_000;
  return t;
}

/** Le jour et l'heure murale d'un instant, dans un fuseau. */
function utcToWall(ms: number, tz: string): { day: string; time: string } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      .formatToParts(new Date(ms))
      .map((x) => [x.type, x.value]),
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/** Un moment lu dans le fichier : une date seule (journée), ou un jour et une heure locale de l'appareil. */
export type Moment = { kind: 'date'; day: string } | { kind: 'time'; day: string; time: string };

/**
 * `DTSTART`, `DTEND`, `RECURRENCE-ID`, `EXDATE`… : une date (`VALUE=DATE`),
 * une heure UTC (`Z`), une heure dans un fuseau (`TZID`), ou une heure
 * flottante. Ramené à l'heure de l'appareil (`home`).
 */
export function readMoment(value: string, params: Record<string, string>, home: string): Moment | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, , z] = m;
  if (h === undefined || params.VALUE === 'DATE') return { kind: 'date', day: `${y}-${mo}-${d}` };
  const tz = z ? 'UTC' : params.TZID && isTimeZone(params.TZID) ? params.TZID : null;
  if (!tz) return { kind: 'time', day: `${y}-${mo}-${d}`, time: `${h}:${mi}` };
  const wall = utcToWall(wallToUtc(Number(y), Number(mo), Number(d), Number(h), Number(mi), tz), home);
  return { kind: 'time', ...wall };
}

/** Une durée (`-PT15M`, `P1D`, `PT1H30M`, `-P1W`) en minutes, signée. */
export function durationMinutes(value: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value.trim());
  if (!m || value.trim().replace(/^[+-]/, '') === 'P') return null;
  const [, sign, w, d, h, mi, s] = m;
  const total = Number(w ?? 0) * 7 * 1440 + Number(d ?? 0) * 1440 + Number(h ?? 0) * 60 + Number(mi ?? 0) + Math.round(Number(s ?? 0) / 60);
  return sign === '-' ? -total : total;
}

function addMinutes(day: string, time: string, minutes: number): { day: string; time: string } {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const days = Math.floor(total / 1440);
  const rest = total - days * 1440;
  return { day: shiftDay(day, days), time: `${pad(Math.floor(rest / 60))}:${pad(rest % 60)}` };
}

// --- Répétitions -------------------------------------------------------------------

const WEEKDAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/**
 * Une règle `RRULE` en règle d'Atlas, ou la raison pour laquelle elle ne
 * passe pas. Atlas sait : tous les N jours, semaines, mois, ans ; certains
 * jours de la semaine ; « le 3e mardi » ou « le dernier vendredi » du mois ;
 * une fin à une date ou après un nombre de fois.
 */
export function readRule(value: string, start: Moment, home: string): Recurrence | string {
  const parts = Object.fromEntries(
    value
      .split(';')
      .map((p) => p.split('='))
      .filter((p) => p.length === 2)
      .map(([k, v]) => [k.toUpperCase(), v]),
  );
  const FREQS: Record<string, Recurrence['freq']> = { DAILY: 'daily', WEEKLY: 'weekly', MONTHLY: 'monthly', YEARLY: 'yearly' };
  const freq = FREQS[parts.FREQ] as Recurrence['freq'] | undefined;
  if (!freq) return `répétition « ${parts.FREQ ?? '?'} » inconnue d’Atlas`;
  const known = new Set(['FREQ', 'INTERVAL', 'BYDAY', 'COUNT', 'UNTIL', 'WKST', 'BYMONTHDAY', 'BYMONTH', 'BYSETPOS']);
  const unknown = Object.keys(parts).filter((k) => !known.has(k));
  if (unknown.length) return `répétition trop fine pour Atlas (${unknown.join(', ')})`;

  const rule: Recurrence = { freq, interval: parts.INTERVAL ? Number(parts.INTERVAL) : 1 };
  const [, mo, d] = start.day.split('-').map(Number);

  // Ce que la date de début dit déjà (« chaque mois le 14 », « chaque année le 14 octobre ») passe.
  if (parts.BYMONTHDAY && !(freq === 'monthly' || freq === 'yearly')) return 'répétition trop fine pour Atlas (BYMONTHDAY)';
  if (parts.BYMONTHDAY && Number(parts.BYMONTHDAY) !== d) return 'répétition à plusieurs jours du mois, inconnue d’Atlas';
  if (parts.BYMONTH && !(freq === 'yearly' && Number(parts.BYMONTH) === mo)) return 'répétition à plusieurs mois, inconnue d’Atlas';

  if (parts.BYDAY) {
    const days = parts.BYDAY.split(',');
    const nthDay = days.length === 1 ? /^([+-]?\d)?([A-Z]{2})$/.exec(days[0]) : null;
    const setpos = parts.BYSETPOS ? Number(parts.BYSETPOS) : null;
    if (freq === 'monthly' && nthDay && (nthDay[1] || setpos !== null)) {
      const nth = Number(nthDay[1] ?? setpos);
      const wd = WEEKDAY_CODES.indexOf(nthDay[2]);
      if (!(NTH_VALUES as readonly number[]).includes(nth) || wd < 0) return 'répétition « le Ne jour du mois » inconnue d’Atlas';
      rule.byNthWeekday = { nth: nth as Nth, weekday: wd };
    } else if ((freq === 'weekly' || freq === 'daily') && days.every((x) => WEEKDAY_CODES.includes(x)) && setpos === null) {
      rule.byWeekday = days.map((x) => WEEKDAY_CODES.indexOf(x)).sort((a, b) => a - b);
      // « Chaque semaine le mardi », pour un événement qui commence un mardi : la règle simple suffit.
      if (freq === 'weekly' && rule.byWeekday.length === 1 && rule.byWeekday[0] === weekday(start.day)) delete rule.byWeekday;
    } else {
      return 'répétition par jours de la semaine trop fine pour Atlas';
    }
  } else if (parts.BYSETPOS) {
    return 'répétition trop fine pour Atlas (BYSETPOS)';
  }

  if (parts.COUNT) rule.count = Number(parts.COUNT);
  if (parts.UNTIL) {
    const until = readMoment(parts.UNTIL, /T/.test(parts.UNTIL) ? {} : { VALUE: 'DATE' }, home);
    if (!until) return 'fin de répétition illisible';
    rule.until = until.day;
  }
  return rule;
}

// --- Alertes ----------------------------------------------------------------------

/**
 * Les alertes d'un événement (`VALARM`) en rappels d'Atlas, celles qui ont un
 * équivalent : « 15 min avant », « 1 h avant », « 1 jour avant »… ; pour une
 * journée entière, « le jour même à 8 h » et « la veille à 18 h ». Les autres
 * sont laissées, et le disent. Aucune alerte = aucun rappel (pas le défaut).
 */
export function readAlarms(c: Component, allDay: boolean): { reminders: number[]; dropped: number } {
  const allowed: readonly number[] = allDay ? ALL_DAY_REMINDERS : TIMED_REMINDERS;
  const reminders: number[] = [];
  let dropped = 0;
  for (const alarm of c.children.filter((x) => x.type === 'VALARM')) {
    // « Aucune alerte » chez Apple : une alerte fictive (ACTION:NONE, déclenchée en 1976). Rien à reprendre, rien à dire.
    if (textOf(alarm, 'ACTION').toUpperCase() === 'NONE') continue;
    const trigger = prop(alarm, 'TRIGGER');
    if (!trigger || trigger.params.VALUE === 'DATE-TIME' || trigger.params.RELATED === 'END') {
      dropped++;
      continue;
    }
    const minutes = durationMinutes(trigger.value);
    // Atlas compte « avant » en positif ; une journée entière commence à minuit.
    const offset = minutes === null ? null : -minutes;
    if (offset !== null && allowed.includes(offset) && !reminders.includes(offset) && reminders.length < MAX_REMINDERS) reminders.push(offset);
    else dropped++;
  }
  return { reminders, dropped };
}

// --- Les événements ----------------------------------------------------------------

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
/** « 1er novembre 2026 », pour les remarques de l'aperçu. */
const frenchDay = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return `${d === 1 ? '1er' : d} ${MONTHS[m - 1]} ${y}`;
};

const clip = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`);

interface Timing {
  allDay: boolean;
  startDay: string;
  endDay: string;
  startTime: string | null;
  endTime: string | null;
}

/** Début et fin d'un `VEVENT`, à l'heure de l'appareil. */
function readTiming(c: Component, home: string): Timing | null {
  const dtstart = prop(c, 'DTSTART');
  const start = dtstart && readMoment(dtstart.value, dtstart.params, home);
  if (!start) return null;
  const dtend = prop(c, 'DTEND');
  const end = dtend ? readMoment(dtend.value, dtend.params, home) : null;
  const duration = prop(c, 'DURATION');
  const minutes = duration ? durationMinutes(duration.value) : null;

  if (start.kind === 'date') {
    // La fin d'une journée entière est exclusive : un événement du 14 finit « le 15 ».
    let last = start.day;
    if (end?.kind === 'date' && end.day > start.day) last = shiftDay(end.day, -1);
    else if (minutes !== null && minutes >= 1440) last = shiftDay(start.day, Math.ceil(minutes / 1440) - 1);
    return { allDay: true, startDay: start.day, endDay: last, startTime: null, endTime: null };
  }
  let stop: { day: string; time: string };
  if (end?.kind === 'time') stop = { day: end.day, time: end.time };
  else if (minutes !== null) stop = addMinutes(start.day, start.time, minutes);
  else stop = addMinutes(start.day, start.time, 60);
  // Une fin égale au début (un rappel posé comme un événement) : un quart d'heure, pour exister à l'écran.
  if (stop.day < start.day || (stop.day === start.day && stop.time <= start.time)) stop = addMinutes(start.day, start.time, 15);
  return { allDay: false, startDay: start.day, endDay: stop.day, startTime: start.time, endTime: stop.time };
}

const textOf = (c: Component, name: string) => {
  const p = prop(c, name);
  return p ? unescapeText(p.value).trim() : '';
};

function baseFields(c: Component) {
  return {
    title: clip(textOf(c, 'SUMMARY') || 'Sans titre', TITLE_MAX),
    location: clip(textOf(c, 'LOCATION'), LOCATION_MAX),
    note: clip([textOf(c, 'DESCRIPTION'), textOf(c, 'URL')].filter(Boolean).join('\n\n'), NOTE_MAX),
  };
}

const cancelled = (c: Component) => textOf(c, 'STATUS').toUpperCase() === 'CANCELLED';

/** Le jour d'une occurrence désignée (`RECURRENCE-ID`, `EXDATE`). */
function occurrenceDays(p: Property, home: string): string[] {
  return p.value
    .split(',')
    .map((v) => readMoment(v, p.params, home))
    .filter((m): m is Moment => m !== null)
    .map((m) => m.day);
}

/**
 * Lit un fichier `.ics` entier. `home` est le fuseau de l'appareil (celui où
 * Atlas range ses heures) ; `color` la couleur choisie pour ce calendrier.
 */
export function parseIcs(text: string, home: string, color: EventInput['color'] = 'bleu'): IcsImport {
  const calendars = parseComponents(text).filter((c) => c.type === 'VCALENDAR');
  const vevents = calendars.flatMap((cal) => cal.children.filter((c) => c.type === 'VEVENT'));
  const calendarName = calendars.map((c) => textOf(c, 'X-WR-CALNAME')).find(Boolean) ?? null;
  const warnings: string[] = [];

  const masters = vevents.filter((c) => !prop(c, 'RECURRENCE-ID'));
  const overrides = vevents.filter((c) => prop(c, 'RECURRENCE-ID'));
  const events: ImportedEvent[] = [];
  const seen = new Set<string>();

  const build = (c: Component, uid: string): ImportedEvent | null => {
    const timing = readTiming(c, home);
    const fields = baseFields(c);
    if (!timing) {
      warnings.push(`« ${fields.title} » : date illisible, laissé de côté.`);
      return null;
    }
    const alarms = readAlarms(c, timing.allDay);
    const event: EventInput = { ...fields, ...timing, color, timezone: home, recurrence: null, reminders: alarms.reminders };
    if (alarms.dropped > 0) warnings.push(`« ${fields.title} » : ${alarms.dropped > 1 ? 'des alertes sans équivalent' : 'une alerte sans équivalent'} dans Atlas, laissée${alarms.dropped > 1 ? 's' : ''} de côté.`);
    return { uid: clip(uid, UID_MAX), event, exceptions: [] };
  };

  for (const c of masters) {
    if (cancelled(c)) continue;
    const uid = textOf(c, 'UID') || `sans-uid:${textOf(c, 'SUMMARY')}:${prop(c, 'DTSTART')?.value ?? ''}`;
    if (seen.has(uid)) continue;
    seen.add(uid);
    const imported = build(c, uid);
    if (!imported) continue;
    const rrule = prop(c, 'RRULE');
    const dtstart = prop(c, 'DTSTART')!;
    const start = readMoment(dtstart.value, dtstart.params, home)!;
    if (rrule) {
      const rule = readRule(rrule.value, start, home);
      if (typeof rule === 'string') {
        warnings.push(`« ${imported.event.title} » : ${rule} — importé une seule fois, le ${frenchDay(imported.event.startDay)}.`);
      } else {
        imported.event.recurrence = rule;
        // Les occurrences supprimées…
        for (const ex of props(c, 'EXDATE')) {
          for (const day of occurrenceDays(ex, home)) imported.exceptions.push({ occurrenceDay: day, kind: 'skip' });
        }
        // … et celles modifiées, dans des VEVENT à part qui portent le même UID.
        for (const o of overrides.filter((x) => textOf(x, 'UID') === uid)) {
          const day = occurrenceDays(prop(o, 'RECURRENCE-ID')!, home)[0];
          if (!day) continue;
          if (cancelled(o)) {
            imported.exceptions.push({ occurrenceDay: day, kind: 'skip' });
            continue;
          }
          const timing = readTiming(o, home);
          if (!timing) continue;
          const fields = baseFields(o);
          const base = imported.event;
          const length = Math.round((Date.parse(base.endDay) - Date.parse(base.startDay)) / 86_400_000);
          const expected = { ...base, startDay: day, endDay: shiftDay(day, length) };
          const next = { ...fields, ...timing };
          const override: EventOverride = {};
          for (const key of ['title', 'location', 'note', 'allDay', 'startDay', 'endDay', 'startTime', 'endTime'] as const) {
            if (next[key] !== expected[key]) (override as Record<string, unknown>)[key] = next[key];
          }
          if (Object.keys(override).length) imported.exceptions.push({ occurrenceDay: day, kind: 'override', override });
        }
      }
    }
    // La règle d'Atlas vérifiée une dernière fois : une incohérence retire la répétition, jamais l'événement.
    if (validateEvent(imported.event)) {
      if (imported.event.recurrence) {
        warnings.push(`« ${imported.event.title} » : répétition refusée par Atlas — importé une seule fois.`);
        imported.event.recurrence = null;
        imported.exceptions = [];
      }
      if (validateEvent(imported.event)) {
        warnings.push(`« ${imported.event.title} » : ${validateEvent(imported.event)} Laissé de côté.`);
        continue;
      }
    }
    events.push(imported);
  }

  // Une occurrence modifiée dont la série n'est pas dans le fichier : un événement à part.
  for (const o of overrides) {
    const uid = textOf(o, 'UID');
    if (seen.has(uid) || cancelled(o)) continue;
    const recid = prop(o, 'RECURRENCE-ID')!.value;
    const imported = build(o, `${uid}#${recid}`);
    if (imported && !validateEvent(imported.event)) events.push(imported);
  }

  return { calendarName, events, warnings };
}
