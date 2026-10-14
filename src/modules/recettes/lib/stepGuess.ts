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

/** Ce qui cuit sans toi. */
const ALONE = /\b(cuire|cuisson|bouillir|ebullition|mijoter|revenir|dorer|saisir|griller|rotir|frem\w*|laisser|reposer|repos|enfourn\w*|prechauff\w*|reduire|dorer au four|refroidir|lever|mariner|infuser)\b/;
/** Ce qui t'occupe les mains : l'emporte sur `ALONE` (« remuer pendant la cuisson »). */
const HANDS = /\b(couper|emince\w*|hache\w*|eplucher|battre|fouette\w*|remuer|melange\w*|egoutte\w*|petri\w*|etaler|former|farcir|dresser|servir|monter|incorporer|napper|tailler)\b/;
/** « Pendant ce temps » : l'étape démarre avec celle d'avant. */
const MEANWHILE = /\b(pendant ce temps|en meme temps|pendant que|parallelement|en parallele|entre[- ]temps)\b/;
/** « Quand l'eau bout » : l'étape attend la fin de celle qui fait bouillir. */
const ONCE_BOILING = /\b(quand l'eau bout|une fois l'eau bouillante|des (l'|que l')ebullition|dans l'eau bouillante)\b/;
const BOILS = /\b(bouillir|ebullition)\b/;

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
    const timer = findTimers(text)[0];
    const minutes = step.minutes ?? (timer ? Math.max(1, Math.round(timer.seconds / 60)) : defaultMinutes(text, hands));
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
      if (busy && busy.end > sofar[i].start + 1e-6) out[i].start = { after: 'end', of: busy.key };
    }
  });
  return out;
}
