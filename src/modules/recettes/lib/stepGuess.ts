/**
 * Proposer les temps d'une recette d'après son texte — bibliothèque pure
 * (docs/etude-recettes.md §20.3). Une proposition, jamais une vérité : la
 * fenêtre « Régler les temps » l'affiche « à vérifier », et rien n'est
 * enregistré sans qu'on le valide. Un champ déjà réglé n'est jamais remplacé.
 */
import { fold } from './ingredients';
import { schedule, withIds } from './schedule';
import { findTimers } from './timers';
import type { Step } from './types';

/** Comparé sans accents ni casse (`fold` ramène aussi l'apostrophe typographique). */
const has = (text: string, words: RegExp) => words.test(fold(text));

/** Le poste, d'après les ustensiles et les gestes nommés ; le premier trouvé dans cet ordre. */
const STATION_WORDS: [string, RegExp][] = [
  ['Four', /\b(four|enfourn\w*|prechauff\w*|gratin\w*|thermostat|plaque de cuisson)\b/],
  ['Micro-ondes', /\bmicro[- ]?ondes?\b/],
  ['Poêle', /\b(poele\w*|sauteuse|wok|plancha)\b/],
  ['Casserole', /\b(casserole|marmite|faitout|cocotte|eau (bouillante|salee)|ebullition|bouillir|pates|riz)\b/],
  ['Robot', /\b(robot|mixe\w*|blender|batteur|thermomix)\b/],
  ['Plan de travail', /\b(couper|emince\w*|hache\w*|eplucher|epluche\w*|detailler|rape\w*|battre|fouette\w*|melange\w*|saladier|tailler|laver|presse\w*|zeste\w*)\b/],
];

/** Ce qui cuit sans toi — ou ce qu'on attend (« sortir la viande 15 min avant »). */
const ALONE = /\b(\d+ ?(?:min|minutes) avant|cuire|cuisson|bouillir|ebullition|mijoter|revenir|dorer|saisir|griller|rotir|frem\w*|laisser|reposer|repos|enfourn\w*|prechauff\w*|reduire|dorer au four|refroidir|lever|mariner|infuser)\b/;
/** Ce qui t'occupe les mains : l'emporte sur `ALONE` (« remuer pendant la cuisson »). */
const HANDS = /\b(couper|emince\w*|hache\w*|eplucher|battre|fouette\w*|remuer|melange\w*|egoutte\w*|petri\w*|etaler|former|farcir|dresser|servir|monter|incorporer|napper|tailler)\b/;
/** « Pendant ce temps » : l'étape démarre avec celle d'avant. */
const MEANWHILE = /\b(pendant ce temps|en meme temps|pendant que|parallelement|en parallele|entre[- ]temps)\b/;
/** « Quand l'eau bout » : l'étape attend la fin de celle qui fait bouillir. */
const ONCE_BOILING = /\b(quand l'eau bout|une fois l'eau bouillante|des (l'|que l')ebullition|dans l'eau bouillante)\b/;
const BOILS = /\b(bouillir|ebullition)\b/;

/** Chauffer la matière grasse ou la poêle, avant d'y mettre quoi que ce soit : environ 2 minutes. */
const HEATS_PAN = /\b(faire chauffer|chauffer) (l'huile|le beurre|la poele|une poele|un filet d'huile|la matiere grasse)\b/;
const HEAT_MINUTES = 2;
/** « 6 à 7 min par face » : deux fois. */
const EACH_SIDE = /^\W*(par face|par cote|de chaque cote|sur chaque face|de chaque face|sur chaque cote)\b/;

/**
 * La durée de toute l'étape, en minutes, d'après son texte (16/10/2026 : un
 * plan où la poêle durait 4 min au lieu de 16 a fait lancer la viande trop
 * tard). Chaque durée écrite compte — « 2 min, puis… 3 min » = 5 —, une
 * fourchette pour son haut — on prévoit large —, « par face » deux fois, et
 * chauffer la poêle 2 min de plus. `null` sans aucune durée écrite.
 */
export function textMinutes(text: string): number | null {
  const timers = findTimers(text);
  if (timers.length === 0) return null;
  const folded = fold(text);
  let seconds = 0;
  for (const t of timers) {
    const range = /(\d+(?:[.,]\d+)?)\s*(?:à|a|-|–|ou)\s*(\d+(?:[.,]\d+)?)/.exec(fold(t.label));
    const upper = range ? (t.seconds * Number(range[2].replace(',', '.'))) / Number(range[1].replace(',', '.')) : t.seconds;
    seconds += EACH_SIDE.test(folded.slice(t.end, t.end + 30)) ? upper * 2 : upper;
  }
  const minutes = Math.max(1, Math.round(seconds / 60));
  return has(text, HEATS_PAN) ? minutes + HEAT_MINUTES : minutes;
}

/** Une durée devinée faute d'être écrite : l'eau met environ 8 minutes à bouillir, un geste environ 3. */
function defaultMinutes(text: string, hands: boolean): number | null {
  if (has(text, BOILS) && !has(text, ONCE_BOILING)) return 8;
  return hands ? 3 : null;
}

/**
 * Les étapes, avec ce que le texte laisse deviner : poste, durée, « tu es
 * dessus » ou non, et ce qui les déclenche. Les champs déjà présents restent.
 */
export function guessTiming(steps: readonly Step[]): Step[] {
  const out = withIds(steps);
  out.forEach((step, i) => {
    const text = step.text;
    const station = step.station ?? STATION_WORDS.find(([, re]) => has(text, re))?.[0] ?? null;
    const hands = step.hands ?? (has(text, HANDS) || !has(text, ALONE));
    const minutes = step.minutes ?? textMinutes(text) ?? defaultMinutes(text, hands);
    out[i] = { ...step, station, hands, minutes };
    if (step.start || i === 0) {
      if (i === 0 && !step.start) out[i].start = { after: 'launch' };
      return;
    }
    const previous = out[i - 1];
    if (has(text, ONCE_BOILING)) {
      const boiling = [...out.slice(0, i)].reverse().find((s) => has(s.text, BOILS));
      if (boiling) out[i].start = { after: 'end', of: boiling.id! };
    } else if (has(text, MEANWHILE)) {
      out[i].start = { after: 'start', of: previous.id!, offset: 0 };
    } else if (previous.hands === false && previous.station && station && previous.station !== station) {
      // Ce qui précède cuit tout seul, ailleurs : on passe à la suite sans attendre.
      out[i].start = { after: 'start', of: previous.id!, offset: 0 };
    }
    // Le poste doit être libre : « Égoutter » (casserole) attend la fin des pâtes, même si l'étape
    // d'avant (les œufs, sur le plan de travail) finit plus tôt.
    if (station) {
      const sofar = schedule(out.slice(0, i + 1)).slots;
      const busy = sofar.slice(0, i).filter((s) => s.station === station).sort((a, b) => b.end - a.end)[0];
      // Sans départ dit, l'étape partirait après celle d'avant : le plan attendrait aussi le poste
      // de lui-même, mais on l'écrit, pour que « Régler les temps » le dise et qu'il tienne si l'on
      // change l'étape d'avant.
      const own = out[i].start ? sofar[i].start : sofar[i - 1].end;
      if (busy && busy.end > own + 1e-6) out[i].start = { after: 'end', of: busy.key };
    }
  });
  return out;
}
