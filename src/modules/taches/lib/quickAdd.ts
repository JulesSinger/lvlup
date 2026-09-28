/**
 * L'ajout rapide en langage naturel — bibliothèque pure (étape 2,
 * docs/etude-taches.md §4, décision du 27/09/2026 : dès la V1).
 *
 * « Appeler le garage demain 9h » → titre « Appeler le garage », prévue
 * demain à 9 h. « Impôts avant le 30 ! » → échéance le 30, importante.
 * « Ampoule #maison » → dans la liste Maison. « Sport tous les lundis 18h »
 * → répétée chaque lundi. « Anniversaire Léa 15 03 » → le prochain 15 mars,
 * répétée tous les ans (demande de Jules, 28/09/2026).
 *
 * Écrit à la main plutôt qu'avec `chrono-node`, essayé d'abord le
 * 28/09/2026 sur une batterie de phrases : il ne comprenait ni « le 5 » ni
 * « avant le 30 », et surtout lisait « après-demain » comme « demain » —
 * une date fausse, sans rien pour le signaler. Il embarquait en plus toutes
 * ses langues. Ici, chaque expression reconnue est testée, et l'écran
 * montre ce qui a été compris (`tokens`) avant d'enregistrer : un clic
 * l'annule (`ignore`), le texte retourne alors dans le titre.
 *
 * Tout se joue en jours locaux, par rapport à `today` : aucun fuseau.
 */
import { shiftDay, weekday } from '../../../core/lib/day';
import { ruleDays, WORKDAYS, type Nth, type Recurrence } from '../../../core/lib/recurrence';
import type { Priority } from './types';

export type TokenKind = 'day' | 'time' | 'duration' | 'due' | 'priority' | 'list' | 'repeat';

/** Un morceau du texte compris comme autre chose qu'un titre. */
export interface QuickToken {
  kind: TokenKind;
  /** Le texte d'origine, tel que tapé */
  text: string;
  start: number;
  end: number;
}

export interface QuickAdd {
  title: string;
  plannedDay: string | null;
  plannedTime: string | null;
  /** « 15h-16h30 », « pendant 1h30 » : la durée, en minutes, seulement avec une heure */
  durationMinutes: number | null;
  dueDay: string | null;
  priority: Priority;
  listId: string | null;
  /** La répétition comprise (« tous les lundis », « anniversaire … ») ; exige un jour prévu, toujours rempli alors */
  recurrence: Recurrence | null;
  tokens: QuickToken[];
}

// --- Le texte, sans accents ni majuscules, lettre pour lettre ----------------

/**
 * Le même texte, en minuscules et sans accents, **de la même longueur** : un
 * indice trouvé dans l'un vaut dans l'autre, ce qui permet de rendre le texte
 * tapé tel quel (majuscules, accents) dans le titre.
 */
function fold(text: string): string {
  let out = '';
  for (const c of text) {
    if (c === '’') {
      out += "'";
      continue;
    }
    const plain = c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    out += plain.length === c.length ? plain : c.toLowerCase().slice(0, c.length).padEnd(c.length, ' ');
  }
  return out;
}

// --- Les jours ------------------------------------------------------------------

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS: [string, number][] = [
  ['janvier', 1], ['janv', 1], ['fevrier', 2], ['fevr', 2], ['fev', 2], ['mars', 3], ['avril', 4], ['avr', 4],
  ['mai', 5], ['juin', 6], ['juillet', 7], ['juil', 7], ['aout', 8], ['septembre', 9], ['sept', 9],
  ['octobre', 10], ['oct', 10], ['novembre', 11], ['nov', 11], ['decembre', 12], ['dec', 12],
];
const NUMBERS: Record<string, number> = { un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10 };

const pad = (n: number) => String(n).padStart(2, '0');

/** Le jour, s'il existe (pas de 31 avril). */
function realDay(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1) return null;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d <= last ? `${y}-${pad(m)}-${pad(d)}` : null;
}

/** Le prochain « d m » à partir d'aujourd'hui inclus : cette année, sinon la suivante. */
function nextDayMonth(today: string, d: number, m: number): string | null {
  const y = Number(today.slice(0, 4));
  for (const year of [y, y + 1, y + 2, y + 3, y + 4]) {
    const day = realDay(year, m, d);
    if (day && day >= today) return day;
  }
  return null;
}

/** « le 5 » : ce mois-ci si ce n'est pas passé, sinon le prochain mois qui a un 5. */
function nextDayOfMonth(today: string, d: number): string | null {
  let y = Number(today.slice(0, 4));
  let m = Number(today.slice(5, 7));
  for (let i = 0; i < 13; i++) {
    const day = realDay(y, m, d);
    if (day && day >= today) return day;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return null;
}

function addMonths(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(Math.min(d, last))}`;
}

const count = (word: string) => NUMBERS[word] ?? Number(word);

const L = '(?<![\\p{L}\\d])';
const R = '(?![\\p{L}\\d])';
const MONTH = MONTHS.map(([name]) => name).join('|');
const NUMBER = `\\d{1,2}|${Object.keys(NUMBERS).join('|')}`;

/** Chaque expression de jour : un motif (sur le texte replié) et le jour qu'il désigne. */
const DAY_PATTERNS: { source: string; resolve: (m: RegExpExecArray, today: string) => string | null }[] = [
  { source: `aujourd'hui|auj|ce soir|ce matin|cet apres-midi|cet aprem`, resolve: (_m, t) => t },
  { source: `apres[- ]demain`, resolve: (_m, t) => shiftDay(t, 2) },
  { source: `demain`, resolve: (_m, t) => shiftDay(t, 1) },
  {
    // « lundi », « le lundi », « ce lundi », « lundi prochain » : le prochain lundi, aujourd'hui exclu.
    source: `(?:ce |le )?(${WEEKDAYS.join('|')})(?: prochain)?`,
    resolve: (m, t) => shiftDay(t, ((WEEKDAYS.indexOf(m[1]) - weekday(t) + 6) % 7) + 1),
  },
  { source: `(?:la )?semaine prochaine`, resolve: (_m, t) => shiftDay(t, ((1 - weekday(t) + 6) % 7) + 1) },
  {
    source: `dans (${NUMBER}) (jours?|semaines?|mois)`,
    resolve: (m, t) => {
      const n = count(m[1]);
      if (m[2].startsWith('jour')) return shiftDay(t, n);
      if (m[2].startsWith('semaine')) return shiftDay(t, 7 * n);
      return addMonths(t, n);
    },
  },
  {
    // « le 15 mars », « 1er octobre », « 3 déc. 2027 »
    source: `(?:le )?(\\d{1,2})(?:er)? (${MONTH})\\.?(?: (\\d{4}))?`,
    resolve: (m, t) => {
      const month = MONTHS.find(([name]) => name === m[2])![1];
      return m[3] ? realDay(Number(m[3]), month, Number(m[1])) : nextDayMonth(t, Number(m[1]), month);
    },
  },
  {
    // « 3/10 », « le 03/10/2026 », « 3/10/27 »
    source: `(?:le )?(\\d{1,2})/(\\d{1,2})(?:/(\\d{2}|\\d{4}))?`,
    resolve: (m, t) => {
      if (!m[3]) return nextDayMonth(t, Number(m[1]), Number(m[2]));
      const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      return realDay(year, Number(m[2]), Number(m[1]));
    },
  },
  // « le 5 », « le 1er » : un jour du mois ; « le » est exigé, pour ne pas lire « 5 pommes ».
  // Jamais suivi d'un mois ni d'une barre : « le 31 avril », qui n'existe pas, n'est pas « le 31 ».
  { source: `le (\\d{1,2})(?:er)?(?! (?:${MONTH})${R})(?!/)`, resolve: (m, t) => nextDayOfMonth(t, Number(m[1])) },
];

// --- Les répétitions -----------------------------------------------------------

const WD = WEEKDAYS.join('|');
/** Tous les jours de la semaine cités dans un morceau : « lundis et jeudis » → [1, 4]. */
const weekdaysIn = (text: string) => [...new Set([...text.matchAll(new RegExp(`(${WD})`, 'g'))].map((m) => WEEKDAYS.indexOf(m[1])))];
/** Une suite de jours : « lundi », « lundis et jeudis », « lundi, mercredi et vendredi ». */
const WD_LIST = `(?:${WD})s?(?:(?:, | et )(?:${WD})s?)*`;

/** « premier », « 2e », « dernier »… : le rang d'un jour dans son mois. */
const RANKS: Record<string, Nth> = { premier: 1, '1er': 1, deuxieme: 2, second: 2, '2e': 2, '2eme': 2, troisieme: 3, '3e': 3, '3eme': 3, quatrieme: 4, '4e': 4, '4eme': 4, dernier: -1 };
const RANK = Object.keys(RANKS).join('|');
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** Chaque façon de dire une répétition, et la règle qu'elle donne. */
const REPEAT_PATTERNS: { source: string; rule: (m: RegExpExecArray) => Recurrence }[] = [
  // « tous les jours sauf le week-end », « … sauf samedi et dimanche », « en semaine », « du lundi au vendredi »
  { source: `tous les jours sauf (?:le |les )?(?:week-ends?|weekends?|we)`, rule: () => ({ freq: 'daily', interval: 1, byWeekday: [...WORKDAYS] }) },
  {
    source: `tous les jours sauf (?:le |les )?${WD_LIST}`,
    rule: (m) => {
      const skipped = weekdaysIn(m[0]);
      return { freq: 'daily', interval: 1, byWeekday: ALL_DAYS.filter((d) => !skipped.includes(d)) };
    },
  },
  { source: `en semaine|(?:les |tous les )?jours ouvres|du lundi au vendredi`, rule: () => ({ freq: 'daily', interval: 1, byWeekday: [...WORKDAYS] }) },
  { source: `(?:tous les|chaque) week-ends?|(?:tous les|chaque) weekends?`, rule: () => ({ freq: 'daily', interval: 1, byWeekday: [6, 0] }) },
  // « le premier lundi du mois », « chaque 3e mardi du mois », « le dernier vendredi de chaque mois »
  {
    source: `(?:le |chaque |tous les )?(${RANK}) (${WD})s? (?:du|de chaque) mois`,
    rule: (m) => ({ freq: 'monthly', interval: 1, byNthWeekday: { nth: RANKS[m[1]], weekday: WEEKDAYS.indexOf(m[2]) } }),
  },
  { source: `tous les jours|chaque jour|quotidiennement`, rule: () => ({ freq: 'daily', interval: 1 }) },
  { source: `tous les (${NUMBER}) jours`, rule: (m) => ({ freq: 'daily', interval: count(m[1]) }) },
  { source: `toutes les semaines|chaque semaine|hebdomadairement`, rule: () => ({ freq: 'weekly', interval: 1 }) },
  { source: `toutes les (${NUMBER}) semaines`, rule: (m) => ({ freq: 'weekly', interval: count(m[1]) }) },
  // « tous les lundis », « chaque lundi », « les lundis et jeudis » (le pluriel seul suffit ; « le lundi » reste un jour)
  { source: `(?:tous les|chaque) ${WD_LIST}|les (?:${WD})s(?:(?:, | et )(?:${WD})s?)*`, rule: (m) => ({ freq: 'weekly', interval: 1, byWeekday: weekdaysIn(m[0]) }) },
  { source: `un (${WD}) sur (deux|2)`, rule: (m) => ({ freq: 'weekly', interval: 2, byWeekday: weekdaysIn(m[0]) }) },
  { source: `tous les mois|chaque mois|mensuellement`, rule: () => ({ freq: 'monthly', interval: 1 }) },
  { source: `tous les (${NUMBER}) mois`, rule: (m) => ({ freq: 'monthly', interval: count(m[1]) }) },
  { source: `tous les ans|chaque annee|annuellement`, rule: () => ({ freq: 'yearly', interval: 1 }) },
  { source: `tous les (${NUMBER}) ans`, rule: (m) => ({ freq: 'yearly', interval: count(m[1]) }) },
];

/** « anniversaire », « anniv » : une date qui revient tous les ans. */
const BIRTHDAY = new RegExp(`${L}anniv(?:ersaire)?s?${R}`, 'u');

/**
 * Après « anniversaire » seulement, « 15 03 », « 15.03 » ou « 15-03 » sont une
 * date (et « 15 03 1990 » aussi, l'année de naissance ignorée) : ailleurs, ce
 * serait lire un numéro de téléphone comme une date.
 */
const BIRTHDAY_DATE = `(?:le )?(\\d{1,2})[ .-](\\d{1,2})(?:[ .\\/-](\\d{4}|\\d{2}))?`;

/** Ce qui fait d'un jour une échéance plutôt qu'un jour prévu. */
const DUE_PREFIX = /(?:avant|pour|d'ici|au plus tard)\s+$/;

const TIME_PATTERNS = [
  `(?:a |vers )?(\\d{1,2}) ?h(?: ?(\\d{2}))?`, // 9h, 9 h 30, à 18h30
  `(?:a |vers )?(\\d{1,2}):(\\d{2})`, // 18:30
].map((source) => new RegExp(`${L}${source}${R}`, 'gu'));

/** « de 15h à 16h30 », « 15h-16h », « entre 15h et 16h », « 15:00 – 16:30 » : une heure et une durée. */
const TIME_RANGES = [
  `(?:de |entre )?(\\d{1,2}) ?h(?: ?(\\d{2}))? ?(?:-|–|a|et) ?(\\d{1,2}) ?h(?: ?(\\d{2}))?`,
  `(?:de |entre )?(\\d{1,2}):(\\d{2}) ?(?:-|–|a|et) ?(\\d{1,2}):(\\d{2})`,
].map((source) => new RegExp(`${L}${source}${R}`, 'gu'));

/** « pendant 1h30 », « pendant 45 min », « pendant 2 heures » : une durée, en minutes. */
const DURATIONS = new RegExp(
  `${L}pendant (?:(\\d{1,2}) ?h(?: ?(\\d{2}))?|(\\d{1,3}) ?min(?:ute)?s?|(\\d{1,2}|une) heures?|une demi-heure)${R}`,
  'gu',
);

interface Candidate {
  kind: TokenKind;
  start: number;
  end: number;
  value: string;
  /** Une heure donnée par un intervalle (« 15h-16h30 ») porte sa durée */
  duration?: number;
  rule?: Recurrence;
  /** Compris, mais laissé dans le titre (« anniversaire » dit la répétition et reste le titre) */
  keep?: boolean;
}

/** Garde les candidats qui ne se chevauchent pas : le plus tôt, puis le plus long. */
function nonOverlapping(candidates: Candidate[]): Candidate[] {
  const kept: Candidate[] = [];
  for (const c of [...candidates].sort((a, b) => a.start - b.start || b.end - a.end)) {
    if (kept.every((k) => c.end <= k.start || c.start >= k.end)) kept.push(c);
  }
  return kept;
}

/**
 * Comprend une saisie rapide. `lists` : les listes, pour « #maison » ;
 * `ignore` : les sortes de morceaux que l'utilisateur a annulées, laissées
 * dans le titre.
 */
export function parseQuickAdd(
  text: string,
  today: string,
  lists: readonly { id: string; name: string }[] = [],
  ignore: ReadonlySet<TokenKind> = new Set(),
): QuickAdd {
  const folded = fold(text);
  const candidates: Candidate[] = [];
  const birthday = BIRTHDAY.exec(folded);
  const dayPatterns = birthday
    ? [...DAY_PATTERNS, { source: BIRTHDAY_DATE, resolve: (m: RegExpExecArray, t: string) => nextDayMonth(t, Number(m[1]), Number(m[2])) }]
    : DAY_PATTERNS;

  // Les répétitions, avant les jours : « tous les lundis » l'emporte sur « lundi », qu'il contient.
  for (const { source, rule } of REPEAT_PATTERNS) {
    const re = new RegExp(`${L}(?:${source})${R}`, 'gu');
    for (let m = re.exec(folded); m; m = re.exec(folded)) {
      const r = rule(m);
      if (r.interval >= 1 && r.interval <= 99) candidates.push({ kind: 'repeat', start: m.index, end: m.index + m[0].length, value: '', rule: r });
    }
  }

  // Les jours, et les échéances (un jour précédé de « avant », « pour »…).
  for (const { source, resolve } of dayPatterns) {
    const re = new RegExp(`${L}(?:${source})${R}`, 'gu');
    for (let m = re.exec(folded); m; m = re.exec(folded)) {
      const day = resolve(m, today);
      if (!day) continue;
      const prefix = DUE_PREFIX.exec(folded.slice(0, m.index));
      if (prefix) candidates.push({ kind: 'due', start: prefix.index, end: m.index + m[0].length, value: day });
      else candidates.push({ kind: 'day', start: m.index, end: m.index + m[0].length, value: day });
    }
  }

  for (const re of TIME_PATTERNS) {
    re.lastIndex = 0;
    for (let m = re.exec(folded); m; m = re.exec(folded)) {
      const h = Number(m[1]);
      const min = Number(m[2] ?? 0);
      if (h > 23 || min > 59) continue;
      candidates.push({ kind: 'time', start: m.index, end: m.index + m[0].length, value: `${pad(h)}:${pad(min)}` });
    }
  }

  for (const re of TIME_RANGES) {
    re.lastIndex = 0;
    for (let m = re.exec(folded); m; m = re.exec(folded)) {
      const [h1, m1, h2, m2] = [Number(m[1]), Number(m[2] ?? 0), Number(m[3]), Number(m[4] ?? 0)];
      if (h1 > 23 || h2 > 23 || m1 > 59 || m2 > 59) continue;
      // La fin avant le début : la soirée passe minuit (« 22h-1h »).
      const duration = (h2 * 60 + m2 - (h1 * 60 + m1) + 1440) % 1440;
      if (duration < 5) continue;
      candidates.push({ kind: 'time', start: m.index, end: m.index + m[0].length, value: `${pad(h1)}:${pad(m1)}`, duration });
    }
  }

  for (const m of folded.matchAll(DURATIONS)) {
    const minutes = m[1] !== undefined ? Number(m[1]) * 60 + Number(m[2] ?? 0) : m[3] !== undefined ? Number(m[3]) : m[4] !== undefined ? count(m[4]) * 60 : 30;
    if (minutes >= 5 && minutes <= 1440) candidates.push({ kind: 'duration', start: m.index!, end: m.index! + m[0].length, value: String(minutes) });
  }

  // « ! » importante, « !! » urgente — seuls, séparés du reste par des espaces.
  for (const m of folded.matchAll(/(?<!\S)(!{1,3})(?!\S)/gu)) {
    candidates.push({ kind: 'priority', start: m.index!, end: m.index! + m[0].length, value: m[1].length >= 2 ? 'urgente' : 'importante' });
  }

  // « #maison » : la liste dont le nom, replié et sans espaces, correspond — exactement, sinon par son début.
  const key = (name: string) => fold(name).replace(/\s+/g, '');
  for (const m of folded.matchAll(/(?<![\p{L}\d])#([\p{L}\d_-]+)/gu)) {
    const tag = m[1];
    const list = lists.find((l) => key(l.name) === tag) ?? lists.find((l) => key(l.name).startsWith(tag));
    if (list) candidates.push({ kind: 'list', start: m.index!, end: m.index! + m[0].length, value: list.id });
  }

  // Une seule chose de chaque sorte : la première ; les suivantes restent dans le titre.
  const tokens: Candidate[] = [];
  for (const c of nonOverlapping(candidates.filter((c) => !ignore.has(c.kind)))) {
    if (!tokens.some((t) => t.kind === c.kind)) tokens.push(c);
  }
  // Une durée sans heure ne veut rien dire : elle reste dans le titre.
  const timeToken = tokens.find((t) => t.kind === 'time');
  if (!timeToken) {
    const i = tokens.findIndex((t) => t.kind === 'duration');
    if (i >= 0) tokens.splice(i, 1);
  }
  // Un anniversaire se répète tous les ans sans qu'on le dise : le mot le porte, et reste dans le titre.
  if (birthday && !ignore.has('repeat') && !tokens.some((t) => t.kind === 'repeat') && tokens.some((t) => t.kind === 'day')) {
    tokens.push({ kind: 'repeat', start: birthday.index, end: birthday.index + birthday[0].length, value: '', rule: { freq: 'yearly', interval: 1 }, keep: true });
  }
  const value = (kind: TokenKind) => tokens.find((t) => t.kind === kind)?.value ?? null;
  const rule = tokens.find((t) => t.kind === 'repeat')?.rule ?? null;

  let title = '';
  let cursor = 0;
  for (const t of [...tokens].filter((t) => !t.keep).sort((a, b) => a.start - b.start)) {
    title += `${text.slice(cursor, t.start)} `;
    cursor = t.end;
  }
  title += text.slice(cursor);
  title = title.replace(/\s+/g, ' ').replace(/^[\s,;:–-]+|[\s,;:–-]+$/g, '');

  const plannedTime = value('time');
  const durationToken = value('duration');
  const durationMinutes = timeToken?.duration ?? (durationToken ? Number(durationToken) : null);
  let plannedDay = value('day');
  // Un anniversaire est toujours le prochain : « 15/03/1990 » est une date de naissance, pas un jour passé.
  if (birthday && plannedDay && plannedDay < today) {
    plannedDay = nextDayMonth(today, Number(plannedDay.slice(8)), Number(plannedDay.slice(5, 7)));
  }
  if (rule && !plannedDay) {
    // Une répétition a besoin d'un jour : le premier qui lui convient à partir d'aujourd'hui
    // (le premier jour cité, le prochain « 3e mardi »…), sinon aujourd'hui.
    plannedDay = ruleDays({ startDay: today, recurrence: rule }, today, shiftDay(today, 70))[0] ?? today;
  }
  return {
    title,
    // Une heure seule vaut pour aujourd'hui (« Réunion à 18h30 »).
    plannedDay: plannedDay ?? (plannedTime ? today : null),
    plannedTime,
    durationMinutes: plannedTime ? durationMinutes : null,
    dueDay: value('due'),
    priority: (value('priority') as Priority | null) ?? 'normale',
    listId: value('list'),
    recurrence: rule,
    tokens: tokens
      .sort((a, b) => a.start - b.start)
      .map(({ kind, start, end }) => ({ kind, start, end, text: text.slice(start, end) })),
  };
}
