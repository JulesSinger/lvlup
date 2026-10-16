/**
 * Le temps d'une recette — bibliothèque pure (docs/etude-recettes.md §20).
 *
 * Une étape ne porte pas d'heure : elle dit ce qui la déclenche (au
 * lancement, à la fin d'une autre, N minutes après le début d'une autre, ou
 * après l'étape d'avant). Les heures se **calculent** ici, en minutes depuis
 * le lancement, pour le plan comme pour l'écran « En cuisine », où les
 * heures réelles (commencée, finie) remplacent les prévues et décalent ce
 * qui en dépend.
 */
import { STATION_MAX, STEPS_MAX, type Step, type StepStart } from './types';

/** Une étape dont on n'a pas dit la durée compte pour une minute : visible sur le plan, sans rien fausser de beaucoup. */
export const DEFAULT_MINUTES = 1;
/** Un écart sous cette valeur (en minutes) ne compte pas : ni marge, ni chevauchement. */
const EPSILON = 0.01;

const ID = /^[a-z0-9]{1,16}$/;

/** Un identifiant d'étape, court : il vit dans le JSON des étapes. */
export function newStepId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Une étape relue quoi qu'en dise la base ou le connecteur : un texte, et des
 * champs de temps seulement s'ils sont bien formés — un champ douteux est
 * retiré, jamais deviné.
 */
export function cleanStep(raw: unknown): Step | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.text !== 'string') return null;
  const step: Step = { text: r.text };
  if (typeof r.id === 'string' && ID.test(r.id)) step.id = r.id;
  if (typeof r.station === 'string' && r.station.trim()) step.station = r.station.trim().slice(0, STATION_MAX);
  if (typeof r.minutes === 'number' && Number.isFinite(r.minutes) && r.minutes > 0 && r.minutes <= 1440) step.minutes = Math.round(r.minutes * 2) / 2;
  if (typeof r.hands === 'boolean') step.hands = r.hands;
  const start = cleanStart(r.start);
  if (start) step.start = start;
  return step;
}

function cleanStart(raw: unknown): StepStart | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  if (s.after === 'launch') return { after: 'launch' };
  if (typeof s.of !== 'string' || !ID.test(s.of)) return null;
  if (s.after === 'end') return { after: 'end', of: s.of };
  if (s.after === 'start' && typeof s.offset === 'number' && Number.isFinite(s.offset) && s.offset >= 0 && s.offset <= 1440) {
    return { after: 'start', of: s.of, offset: Math.round(s.offset * 2) / 2 };
  }
  return null;
}

export function cleanSteps(raw: unknown): Step[] {
  return (Array.isArray(raw) ? raw : []).map(cleanStep).filter((s): s is Step => s !== null).slice(0, STEPS_MAX);
}

/** Une recette est « minutée » dès qu'une étape a un poste ou une durée : elle a alors un plan. */
export function isTimed(steps: readonly Step[]): boolean {
  return steps.some((s) => (s.station ?? null) !== null || (s.minutes ?? null) !== null);
}

/** Les étapes, chacune avec un identifiant (pour que les autres puissent la désigner). */
export function withIds(steps: readonly Step[]): Step[] {
  const seen = new Set<string>();
  return steps.map((s) => {
    const id = s.id && !seen.has(s.id) ? s.id : newStepId();
    seen.add(id);
    return { ...s, id };
  });
}

/**
 * Le texte des étapes vient d'être retouché dans la fenêtre de la recette
 * (une zone de texte, recréée à chaque fois) : chaque étape reprend les
 * réglages de l'ancienne au même texte, sinon de l'ancienne à la même place.
 * Un renvoi vers une étape disparue est retiré (l'étape repart « après celle
 * d'avant »).
 */
export function mergeStepTiming(previous: readonly Step[], next: readonly Step[]): Step[] {
  const used = new Set<number>();
  const pick = (i: number) => {
    used.add(i);
    const { text: _text, ...timing } = previous[i];
    return timing;
  };
  const merged = next.map((step) => ({ step, timing: null as Omit<Step, 'text'> | null }));
  merged.forEach((m) => {
    const same = previous.findIndex((p, i) => !used.has(i) && p.text === m.step.text);
    if (same >= 0) m.timing = pick(same);
  });
  merged.forEach((m, i) => {
    if (!m.timing && i < previous.length && !used.has(i) && !next.some((n) => n.text === previous[i].text)) m.timing = pick(i);
  });
  const out = merged.map(({ step, timing }) => (timing ? { ...timing, text: step.text } : { text: step.text }));
  const ids = new Set(out.map((s) => s.id).filter(Boolean));
  return out.map((s) => {
    if (s.start && s.start.after !== 'launch' && !ids.has(s.start.of)) {
      const { start: _start, ...rest } = s;
      return rest;
    }
    return s;
  });
}

// --- Le calcul ---------------------------------------------------------------------------

/** Ce qui s'est vraiment passé, en minutes depuis le lancement (écran « En cuisine »). */
export interface Live {
  now: number;
  /** Clé de l'étape → minute où elle a commencé. */
  started: Readonly<Record<string, number>>;
  /** Clé de l'étape → minute où elle a été finie. */
  done: Readonly<Record<string, number>>;
}

export type StepState = 'pending' | 'running' | 'done';

export interface Slot {
  index: number;
  /** L'identifiant, ou `#3` pour une étape qui n'en a pas. */
  key: string;
  text: string;
  station: string | null;
  minutes: number;
  /** Une durée dite (sinon `DEFAULT_MINUTES`). */
  minutesKnown: boolean;
  hands: boolean;
  start: number;
  end: number;
  /** Sur le chemin qui fixe la durée totale. */
  critical: boolean;
  state: StepState;
  /** L'étape qui la déclenche, pour dire « quand l'eau bout ». */
  after: { key: string; kind: 'end' | 'start'; offset: number } | null;
}

export interface Schedule {
  slots: Slot[];
  total: number;
  /** Deux étapes « tu es dessus » en même temps. */
  conflicts: { a: string; b: string; from: number; to: number }[];
  /** Une boucle dans les renvois (A après B, B après A) : ces étapes sont parties du lancement. */
  loops: string[];
}

export const stepKey = (step: Step, index: number) => step.id ?? `#${index}`;

/**
 * Les heures de chaque étape. Sans `live`, le plan ; avec, l'état de la cuisine :
 * une étape commencée garde son heure réelle, une étape en retard part de
 * « maintenant », une étape finie s'arrête quand on l'a dit — et tout ce qui
 * en dépend suit.
 */
export function schedule(steps: readonly Step[], live?: Live): Schedule {
  const keys = steps.map(stepKey);
  const indexOf = new Map(keys.map((k, i) => [k, i]));
  const startAt = new Array<number | undefined>(steps.length);
  const endAt = new Array<number | undefined>(steps.length);
  const visiting = new Set<number>();
  const loops = new Set<string>();

  const link = (i: number): Slot['after'] => {
    const s = steps[i].start;
    if (s?.after === 'launch') return null;
    if (s && indexOf.has(s.of) && indexOf.get(s.of) !== i) {
      return { key: s.of, kind: s.after, offset: s.after === 'start' ? s.offset : 0 };
    }
    return i === 0 ? null : { key: keys[i - 1], kind: 'end', offset: 0 };
  };
  const minutesOf = (i: number) => steps[i].minutes ?? DEFAULT_MINUTES;
  /** Le poste occupé qui a retardé une étape : c'est lui qu'elle attend vraiment. */
  const waited: (Slot['after'] | undefined)[] = Array.from({ length: steps.length });
  const linkOf = (i: number): Slot['after'] => waited[i] ?? link(i);

  const resolve = (i: number): void => {
    if (startAt[i] !== undefined) return;
    if (visiting.has(i)) {
      loops.add(keys[i]);
      startAt[i] = 0;
      endAt[i] = minutesOf(i);
      return;
    }
    visiting.add(i);
    const key = keys[i];
    let start: number;
    if (live?.started[key] !== undefined) {
      start = live.started[key];
    } else {
      const l = link(i);
      let base = 0;
      if (l) {
        const j = indexOf.get(l.key)!;
        resolve(j);
        base = (l.kind === 'end' ? endAt[j]! : startAt[j]!) + l.offset;
      }
      // Sans départ dit, une étape attend aussi que son poste soit libre (16/10/2026) : « Égoutter
      // le riz » ne se fait pas avant la fin du riz, même si l'étape d'avant, ailleurs, finit plus tôt.
      const station = steps[i].station;
      if (!steps[i].start && station) {
        for (let j = 0; j < i; j++) {
          if (steps[j].station !== station) continue;
          resolve(j);
          if (endAt[j]! > base + EPSILON) {
            base = endAt[j]!;
            waited[i] = { key: keys[j], kind: 'end', offset: 0 };
          }
        }
      }
      // Une étape pas encore commencée ne commence pas dans le passé.
      start = live ? Math.max(base, live.now) : base;
    }
    let end = start + minutesOf(i);
    if (live) {
      const done = live.done[key];
      if (done !== undefined) end = Math.max(start, done);
      // Une étape où tu es dessus dure tant que tu ne l'as pas dite finie.
      else if (live.started[key] !== undefined && steps[i].hands) end = Math.max(end, live.now);
    }
    if (startAt[i] === undefined) {
      startAt[i] = start;
      endAt[i] = end;
    }
    visiting.delete(i);
  };
  steps.forEach((_, i) => resolve(i));

  const total = steps.length ? Math.max(...endAt.map((e) => e ?? 0)) : 0;

  // Les marges, à rebours : la plus tardive où chaque étape peut commencer sans retarder la fin.
  const latest = steps.map((_, i) => total - (endAt[i]! - startAt[i]!));
  for (let pass = 0; pass < steps.length + 1; pass++) {
    let changed = false;
    steps.forEach((_, d) => {
      const l = linkOf(d);
      if (!l || loops.has(keys[d])) return;
      const x = indexOf.get(l.key)!;
      const bound = l.kind === 'end' ? latest[d] - l.offset - (endAt[x]! - startAt[x]!) : latest[d] - l.offset;
      if (bound < latest[x] - EPSILON) {
        latest[x] = bound;
        changed = true;
      }
    });
    if (!changed) break;
  }

  const slots: Slot[] = steps.map((step, i) => {
    const key = keys[i];
    const state: StepState = !live
      ? 'pending'
      : live.done[key] !== undefined || (live.started[key] !== undefined && !step.hands && endAt[i]! <= live.now)
        ? 'done'
        : live.started[key] !== undefined
          ? 'running'
          : 'pending';
    return {
      index: i,
      key,
      text: step.text,
      station: step.station ?? null,
      minutes: minutesOf(i),
      minutesKnown: (step.minutes ?? null) !== null,
      hands: step.hands ?? false,
      start: startAt[i]!,
      end: endAt[i]!,
      critical: latest[i] - startAt[i]! < EPSILON,
      state,
      after: linkOf(i),
    };
  });

  const conflicts: Schedule['conflicts'] = [];
  const handsSlots = slots.filter((s) => s.hands && s.state !== 'done');
  handsSlots.forEach((a, n) => {
    for (const b of handsSlots.slice(n + 1)) {
      const from = Math.max(a.start, b.start);
      const to = Math.min(a.end, b.end);
      if (to - from > EPSILON) conflicts.push({ a: a.key, b: b.key, from, to });
    }
  });

  return { slots, total, conflicts, loops: [...loops] };
}

/** Le moment de lancer pour être à table à `target` : `target` moins la durée totale. */
export function launchTime(target: Date, totalMinutes: number): Date {
  return new Date(target.getTime() - Math.ceil(totalMinutes) * 60_000);
}

/** 0 → « 0 min » ; 90 → « 1 h 30 » ; 7.5 → « 7 min 30 ». */
export function minutesLabel(minutes: number): string {
  const m = Math.max(0, minutes);
  const h = Math.floor(m / 60);
  const rest = m - h * 60;
  const whole = Math.floor(rest);
  const sec = Math.round((rest - whole) * 60);
  if (h > 0) return `${h} h${whole ? ` ${String(whole).padStart(2, '0')}` : ''}`;
  return sec ? `${whole} min ${sec}` : `${whole} min`;
}

/** Le texte du déclencheur d'une étape : « au lancement », « à la fin de l'étape 1 »… */
export function startLabel(slot: Slot, slots: readonly Slot[]): string {
  if (!slot.after) return 'au lancement';
  const ref = slots.find((s) => s.key === slot.after!.key);
  const n = ref ? ref.index + 1 : '?';
  if (slot.after.kind === 'end') return ref && ref.index === slot.index - 1 ? 'après l’étape d’avant' : `à la fin de l’étape ${n}`;
  return slot.after.offset ? `${minutesLabel(slot.after.offset)} après le début de l’étape ${n}` : `en même temps que l’étape ${n}`;
}
