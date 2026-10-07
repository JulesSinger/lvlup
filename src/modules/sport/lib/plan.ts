/**
 * Le générateur du plan marathon — bibliothèque pure (docs/etude-sport.md §4.3, §12).
 *
 * Des règles simples et écrites plutôt qu'un générateur « intelligent » : on
 * doit pouvoir lire pourquoi une semaine ressemble à ce qu'elle est.
 *
 * - **Par semaine, pas par jour** (Jules n'a pas de jours fixes) : chaque
 *   semaine liste ses 3 ou 4 séances dans un ordre conseillé — jamais deux
 *   séances dures d'affilée, la sortie longue en fin de semaine.
 * - **Trois temps** : une phase de **base** (endurance seule, le volume monte
 *   doucement), un **bloc spécifique** de quinze semaines (seuil, fractionné,
 *   sortie longue jusqu'à 30-32 km, allure marathon), puis deux semaines
 *   d'**affûtage** et la semaine de la course.
 * - **Le volume** part de ce que Jules court aujourd'hui (moyenne des quatre
 *   dernières semaines), monte d'au plus 8 % par semaine, et retombe d'un quart
 *   **une semaine sur quatre** pour récupérer. Base plafonnée aux trois quarts
 *   du pic ; dans le bloc spécifique, le plafond monte pas à pas jusqu'au pic,
 *   atteint la dernière semaine avant l'affûtage.
 * - **La sortie longue** ne gagne jamais plus de 2 km d'une semaine à l'autre :
 *   18 km au plus en base, puis un plafond qui monte jusqu'à 30 ou 32 km à la
 *   fin du bloc — deux ou trois très longues sorties, pas neuf.
 * - **Les allures** viennent d'un temps de référence récent (`trainingPaces`) ;
 *   sans référence, les séances se règlent en zones de fréquence cardiaque.
 */
import { daysBetween, mondayOf, shiftDay } from '../../../core/lib/day';
import { trainingPaces, type PaceRange, type Reference } from './pace';
import { MARATHON_M, type PlanSession, type PlanSessionDraft, type Run, type SessionKind } from './types';

export type PlanPhase = 'base' | 'specifique' | 'affutage' | 'course';

export const PHASE_LABELS: Record<PlanPhase, string> = {
  base: 'Base',
  specifique: 'Bloc spécifique',
  affutage: 'Affûtage',
  course: 'Semaine de la course',
};

export interface PlanOptions {
  /** Le jour où le plan commence : sa semaine 1 est celle de ce jour. */
  startDay: string;
  raceDay: string;
  raceTitle: string;
  sessionsPerWeek: number;
  reference: Reference | null;
  /** Le volume hebdomadaire moyen des quatre dernières semaines, en mètres. */
  currentWeeklyM: number;
  /** La plus longue sortie récente, en mètres. */
  longestRecentM: number;
}

/** Une séance générée, sans identifiant ni plan. */
export type SessionBody = Omit<PlanSessionDraft, 'id' | 'planId' | 'week' | 'position' | 'day'> & { day: string | null };

export interface PlanWeek {
  week: number;
  monday: string;
  phase: PlanPhase;
  /** Allégée pour récupérer (une semaine sur quatre). */
  recovery: boolean;
  volumeM: number;
  sessions: SessionBody[];
}

/** Le bloc spécifique : quinze semaines avant l'affûtage. */
export const SPECIFIC_WEEKS = 15;
/** Deux semaines d'affûtage, puis la semaine de la course. */
export const TAPER_WEEKS = 2;
const MIN_WEEKLY_M = 20_000;
const WEEKLY_GROWTH = 1.08;
const RECOVERY_FACTOR = 0.75;
const LONG_RUN_STEP_M = 2000;
/** La phase de base plafonne aux trois quarts du volume de pointe… */
const BASE_SHARE = 0.75;
/** … et sa sortie longue à 18 km : les plus longues sont pour le bloc spécifique. */
const BASE_LONG_M = 18_000;

/** Le volume de pointe et la plus longue sortie, selon le nombre de séances. */
function ceilings(sessionsPerWeek: number) {
  return sessionsPerWeek >= 4
    ? { peakM: 60_000, longMaxM: 32_000, longShare: 0.55 }
    : { peakM: 50_000, longMaxM: 30_000, longShare: 0.6 };
}

/** Arrondi au demi-kilomètre, jamais sous 4 km : une séance se dit en kilomètres ronds. */
const round500 = (m: number) => Math.max(4000, Math.round(m / 500) * 500);

/** Le nombre de semaines du plan, celle de la course comprise. */
export function planWeekCount(startDay: string, raceDay: string): number {
  return Math.floor(daysBetween(mondayOf(startDay), mondayOf(raceDay)) / 7) + 1;
}

/** La semaine du plan d'un jour (1 = celle du début) ; 0 ou moins avant le plan. */
export function weekOfPlan(startDay: string, day: string): number {
  return Math.floor(daysBetween(mondayOf(startDay), day) / 7) + 1;
}

/** Le lundi d'une semaine du plan. */
export function mondayOfWeek(startDay: string, week: number): string {
  return shiftDay(mondayOf(startDay), 7 * (week - 1));
}

/**
 * La phase d'une semaine du plan, et si elle est allégée — la règle du
 * générateur, partagée avec l'écran pour qu'ils ne puissent pas se
 * contredire (rien de cela n'est rangé : une séance ne connaît que sa semaine).
 */
export function weekPhase(week: number, total: number): { phase: PlanPhase; recovery: boolean } {
  const taperStart = Math.max(1, total - TAPER_WEEKS);
  const buildWeeks = taperStart - 1;
  const specificStart = Math.max(1, buildWeeks - SPECIFIC_WEEKS + 1);
  if (week >= total) return { phase: 'course', recovery: false };
  if (week >= taperStart) return { phase: 'affutage', recovery: false };
  // Une semaine sur quatre allège, sauf la dernière avant l'affûtage (le pic).
  return { phase: week >= specificStart ? 'specifique' : 'base', recovery: week % 4 === 0 && week !== buildWeeks };
}

/** Les séances de seuil du bloc spécifique, de la plus douce à la plus longue. */
const THRESHOLD = ['3 × 8 min', '3 × 10 min', '2 × 15 min', '4 × 8 min', '3 × 12 min', '2 × 20 min', '25 min continues'];
/** Le fractionné, à l'allure du 5 km. */
const INTERVALS = ['8 × 400 m', '6 × 800 m', '5 × 1 000 m', '10 × 400 m', '4 × 1 200 m', '6 × 1 000 m', '3 × 2 000 m'];

function paceFor(paces: ReturnType<typeof trainingPaces> | null, kind: Exclude<SessionKind, 'course'>): PaceRange | null {
  return paces ? paces[kind] : null;
}

function session(
  kind: SessionKind,
  title: string,
  distanceM: number | null,
  pace: PaceRange | null,
  hrZone: number | null,
  instructions: string,
): SessionBody {
  return {
    kind,
    title,
    distanceM,
    durationS: null,
    paceMinS: pace?.min ?? null,
    paceMaxS: pace?.max ?? null,
    hrZone,
    instructions,
    day: null,
  };
}

/** Le plan entier, semaine par semaine. Refusé si la course tombe avant la fin de la première semaine. */
export function generatePlan(opts: PlanOptions): PlanWeek[] {
  const total = planWeekCount(opts.startDay, opts.raceDay);
  if (total < 2) throw new Error('La course est trop proche pour construire un plan.');
  const four = opts.sessionsPerWeek >= 4;
  const { peakM, longMaxM, longShare } = ceilings(opts.sessionsPerWeek);
  const paces = opts.reference ? trainingPaces(opts.reference) : null;

  const raceWeek = total;
  const taperStart = Math.max(1, raceWeek - TAPER_WEEKS);
  const buildWeeks = taperStart - 1;
  const specificStart = Math.max(1, buildWeeks - SPECIFIC_WEEKS + 1);

  const weeks: PlanWeek[] = [];
  let volume = Math.min(Math.max(opts.currentWeeklyM, MIN_WEEKLY_M), peakM * BASE_SHARE);
  let long = Math.min(Math.max(opts.longestRecentM, 10_000), BASE_LONG_M);
  let quality = 0;
  let specificIndex = 0;

  for (let week = 1; week <= total; week++) {
    const monday = mondayOfWeek(opts.startDay, week);

    if (week === raceWeek) {
      weeks.push({
        week,
        monday,
        phase: 'course',
        recovery: false,
        volumeM: 0,
        sessions: order([
          session('footing', 'Footing', 6000, paceFor(paces, 'footing'), 2, 'Tout en douceur : les jambes doivent arriver fraîches.'),
          session('allure', 'Rappel d’allure', 6000, paceFor(paces, 'allure'), 3, '15 min de footing, 3 × 1 km à allure marathon, 5 min au calme.'),
          { ...session('course', opts.raceTitle, MARATHON_M, paceFor(paces, 'allure'), null, 'Partir à l’allure prévue, pas plus vite : le marathon se joue après le 30e kilomètre.'), day: opts.raceDay },
        ]),
      });
      continue;
    }

    if (week >= taperStart) {
      // Affûtage : le volume redescend pour arriver frais, l'allure reste.
      const share = week === raceWeek - 1 ? 0.55 : 0.75;
      const weekVolume = Math.round(peakM * share);
      const taperLong = round500(week === raceWeek - 1 ? 14_000 : 20_000);
      const rest = weekVolume - taperLong;
      const sessions = [
        session('allure', 'Allure marathon', round500(rest * (four ? 0.4 : 0.5)), paceFor(paces, 'allure'), 3, '15 min de footing, 2 × 4 km à allure marathon (récup 3 min), 10 min au calme.'),
        session('footing', 'Footing', round500(rest * (four ? 0.3 : 0.5)), paceFor(paces, 'footing'), 2, 'En aisance, on peut parler.'),
        session('longue', 'Sortie longue', taperLong, paceFor(paces, 'longue'), 2, 'Sortie longue raccourcie : on garde le rythme, on enlève la fatigue.'),
      ];
      if (four) sessions.splice(1, 0, session('footing', 'Footing', round500(rest * 0.3), paceFor(paces, 'footing'), 2, 'En aisance, on peut parler.'));
      weeks.push({ week, monday, phase: 'affutage', recovery: false, volumeM: weekVolume, sessions: order(sessions) });
      continue;
    }

    const { phase, recovery } = weekPhase(week, total);
    // Dans le bloc spécifique, les plafonds montent pas à pas jusqu'à la dernière
    // semaine avant l'affûtage : le pic (volume et plus longue sortie) arrive à
    // la fin, pas neuf semaines d'affilée à 32 km.
    const progress = phase === 'specifique' ? (week - specificStart + 1) / (buildWeeks - specificStart + 1) : 0;
    const cap = BASE_SHARE * peakM + (1 - BASE_SHARE) * peakM * progress;
    if (week > 1 && !recovery) volume = Math.min(cap, volume * WEEKLY_GROWTH);
    const weekVolume = Math.round(recovery ? volume * RECOVERY_FACTOR : volume);

    const longCap = BASE_LONG_M + (longMaxM - BASE_LONG_M) * progress;
    if (week > 1 && !recovery) long = Math.min(long + LONG_RUN_STEP_M, longCap, weekVolume * longShare);
    const weekLong = round500(recovery ? long * RECOVERY_FACTOR : Math.min(long, weekVolume * longShare));
    const rest = Math.max(weekVolume - weekLong, 8000);

    let sessions: SessionBody[];
    if (phase === 'base') {
      const per = round500(rest / (four ? 3 : 2));
      sessions = [
        session('footing', 'Footing + lignes droites', per, paceFor(paces, 'footing'), 2, 'En aisance, puis 6 lignes droites de 20 s en accélérant, récupération en marchant.'),
        session('footing', 'Footing', per, paceFor(paces, 'footing'), 2, 'En aisance, on peut parler.'),
        session('longue', 'Sortie longue', weekLong, paceFor(paces, 'longue'), 2, 'Lentement : c’est la durée qui construit l’endurance, pas la vitesse.'),
      ];
      if (four) sessions.splice(1, 0, session('footing', 'Footing', per, paceFor(paces, 'footing'), 2, 'En aisance, on peut parler.'));
    } else {
      specificIndex += 1;
      // Le seuil et le fractionné alternent ; une semaine allégée garde la séance, plus courte.
      const threshold = specificIndex % 2 === 1;
      const q = Math.min(quality, (threshold ? THRESHOLD : INTERVALS).length - 1);
      if (threshold) quality += 1;
      const qualityDistance = round500(rest * (four ? 0.4 : 0.45));
      const qualitySession = threshold
        ? session('seuil', 'Seuil', qualityDistance, paceFor(paces, 'seuil'), 4, `15 min de footing, ${THRESHOLD[q]} à allure seuil (récup 2 min), 10 min au calme.`)
        : session('fractionne', 'Fractionné', qualityDistance, paceFor(paces, 'fractionne'), 5, `20 min de footing, ${INTERVALS[q]} à allure 5 km (récup = moitié du temps d’effort), 10 min au calme.`);
      // À partir de la cinquième semaine du bloc, une sortie longue sur deux
      // finit à allure marathon : de 6 à 14 km.
      const withPace = specificIndex >= 5 && specificIndex % 2 === 1 && !recovery;
      const mpKm = Math.min(14, 6 + 2 * Math.floor((specificIndex - 5) / 2));
      const longSession = withPace
        ? session('longue', 'Sortie longue avec allure marathon', weekLong, paceFor(paces, 'longue'), 2, `En aisance, puis les ${mpKm} derniers kilomètres à allure marathon${paces ? '' : ' (zone 3)'}.`)
        : session('longue', 'Sortie longue', weekLong, paceFor(paces, 'longue'), 2, 'Lentement : c’est la durée qui construit l’endurance, pas la vitesse.');
      const footing = round500((rest - qualityDistance) / (four ? 2 : 1));
      sessions = [qualitySession, session('footing', 'Footing', footing, paceFor(paces, 'footing'), 2, 'En aisance, on peut parler.'), longSession];
      if (four) sessions.splice(0, 0, session('footing', 'Footing', footing, paceFor(paces, 'footing'), 2, 'En aisance, on peut parler.'));
    }
    weeks.push({ week, monday, phase, recovery, volumeM: weekVolume, sessions: order(sessions) });
  }
  // Le volume affiché est celui des séances, arrondies : jamais un chiffre qui ne se retrouve pas dans la semaine.
  return weeks.map((w) => ({ ...w, volumeM: w.sessions.reduce((sum, x) => sum + (x.distanceM ?? 0), 0) }));
}

const isHard = (kind: SessionKind) => kind !== 'footing';

/**
 * L'ordre conseillé d'une semaine : la séance la plus longue (ou la course) en
 * dernier, et jamais deux séances dures d'affilée — un footing s'intercale.
 */
export function order(sessions: SessionBody[]): SessionBody[] {
  const last = sessions.reduce((best, s) => (s.kind === 'course' || (best.kind !== 'course' && (s.distanceM ?? 0) > (best.distanceM ?? 0)) ? s : best));
  const others = sessions.filter((s) => s !== last);
  const hard = others.filter((s) => isHard(s.kind));
  const easy = others.filter((s) => !isHard(s.kind));
  // Alterner en partant de la fin : la longue, un footing, une dure, un footing…
  const tail: SessionBody[] = [last];
  let wantEasy = isHard(last.kind);
  while (hard.length + easy.length > 0) {
    const next = wantEasy ? easy.shift() ?? hard.shift() : hard.shift() ?? easy.shift();
    tail.unshift(next!);
    wantEasy = isHard(next!.kind);
  }
  return tail;
}

/** Les séances à ranger, avec leur identifiant, leur semaine et leur place. */
export function planDrafts(planId: string, weeks: PlanWeek[], newId: () => string): PlanSessionDraft[] {
  return weeks.flatMap((w) =>
    w.sessions.map((s, position) => ({ ...s, id: newId(), planId, week: w.week, position })),
  );
}

/**
 * La séance qu'une sortie a faite : dans sa semaine, parmi celles qu'aucune
 * autre sortie n'a déjà faites, la plus ressemblante (même sorte d'abord, puis
 * la distance la plus proche). `null` si rien ne ressemble assez — Jules
 * rattache alors à la main.
 */
export function matchSession(
  run: Pick<Run, 'day' | 'distanceM' | 'kind'>,
  startDay: string,
  sessions: PlanSession[],
  takenIds: ReadonlySet<string>,
): string | null {
  const week = weekOfPlan(startDay, run.day);
  let best: { id: string; score: number } | null = null;
  for (const s of sessions) {
    if (s.week !== week || takenIds.has(s.id)) continue;
    // Une séance datée (la course) ne se fait que ce jour-là.
    if (s.day && s.day !== run.day) continue;
    const target = s.distanceM ?? run.distanceM;
    const score = Math.abs(run.distanceM - target) / Math.max(target, 1) + (s.kind === run.kind ? 0 : 0.35);
    if (!best || score < best.score) best = { id: s.id, score };
  }
  return best && best.score <= 0.6 ? best.id : null;
}
