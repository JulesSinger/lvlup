import { feedingCheckins } from './counters';
import { DEFAULT_ACTIONS, JALON } from './types';
import type { Action, ActionInput, Checkin, Tier, TierInput, TierKind } from './types';

/**
 * Quantités et relevés.
 *
 * Le risque de tout ce lot tient en une phrase : si cocher « Sortie course »
 * ouvre un clavier numérique, on a remplacé un geste par trois et le taux de
 * check-in s'effondre. La règle est donc qu'**un appui enregistre l'action avec
 * sa valeur habituelle** — la saisie n'existe que pour corriger.
 *
 * Seule exception, le relevé (se peser) : il n'a pas de valeur habituelle qui
 * ait du sens, la saisie *est* le geste. Mais c'est un geste hebdomadaire, pas
 * un geste de 23 h.
 */

/** Trois natures d'action, exposées telles quelles dans l'éditeur. */
export type ActionNature = 'simple' | 'quantifiee' | 'releve';

/**
 * Un relevé rapporte peu : il entretient la série (se peser est une vraie
 * discipline) mais ne doit pas devenir une machine à points — sinon on farme
 * des PP sur une balance.
 */
export const MEASURE_PP = 5;

export function actionNature(action: Pick<Action, 'unit' | 'isMeasure'>): ActionNature {
  if (action.isMeasure) return 'releve';
  return action.unit.trim() === '' ? 'simple' : 'quantifiee';
}

/**
 * Champs à écrire quand on change la nature d'une action. On garde l'unité
 * déjà saisie en passant de quantifiée à relevé : c'est presque toujours la
 * même (kg, cm) et la retaper est une punition gratuite.
 */
export function natureFields(
  nature: ActionNature,
  action: Pick<Action, 'unit' | 'defaultValue' | 'pp'>,
): Partial<ActionInput> {
  switch (nature) {
    case 'simple':
      return { unit: '', defaultValue: null, isMeasure: false };
    case 'quantifiee':
      return {
        unit: action.unit.trim() || 'km',
        defaultValue: action.defaultValue ?? 1,
        isMeasure: false,
      };
    case 'releve':
      return {
        unit: action.unit.trim() || 'kg',
        defaultValue: null,
        isMeasure: true,
        // Décision 4 : un relevé entretient le streak, mais rapporte peu.
        pp: Math.min(action.pp, MEASURE_PP),
      };
  }
}

/**
 * Lecture d'un nombre tapé à la main. On accepte la virgule française, les
 * espaces (y compris insécables, que les claviers mobiles glissent tout seuls)
 * et on refuse tout le reste plutôt que d'enregistrer un `NaN`.
 */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[\s  ]/g, '').replace(',', '.');
  if (cleaned === '' || cleaned === '-' || cleaned === '.') return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Valeur enregistrée par un simple appui. `null` = rien à compter. */
export function tapValue(action: Action): number | null {
  if (action.isMeasure) return null; // la saisie est le geste
  return action.defaultValue;
}

/** Une action demande-t-elle une saisie avant d'être enregistrée ? */
export function needsInput(action: Action): boolean {
  return action.isMeasure;
}

export interface Reading {
  day: string;
  value: number;
}

/**
 * Les relevés qui alimentent un palier de mesure, un par jour.
 *
 * Deux pesées le même matin ne font pas deux points sur la courbe : on garde
 * la dernière, celle qu'on a corrigée.
 */
export function measureSeries(
  tier: Tier,
  checkins: Checkin[],
  actions: Action[] = [],
): Reading[] {
  const byDay = new Map<string, Reading>();
  feedingCheckins(tier, checkins, actions)
    .filter((c) => typeof c.value === 'number')
    .sort((a, b) => a.day.localeCompare(b.day) || a.createdAt.localeCompare(b.createdAt))
    .forEach((c) => byDay.set(c.day, { day: c.day, value: c.value as number }));
  return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/**
 * Réglages par défaut d'une nature de palier.
 *
 * L'éditeur ne demande jamais « quelle unité ? » devant un champ vide : il
 * pose une valeur crédible et on la corrige. Choisir entre six natures est
 * déjà l'effort maximal qu'on peut demander à cet endroit.
 */
export function kindFields(
  kind: TierKind,
  tier: Pick<Tier, 'unit' | 'target'>,
): Partial<TierInput> {
  const keep = (fallback: string) => tier.unit.trim() || fallback;
  const target = (fallback: number) => Math.abs(tier.target ?? 0) || fallback;
  const ascending = { direction: 'hausse', mode: 'absolu' } as const;
  switch (kind) {
    case 'jalon':
      return { kind, target: null, unit: '', ...ascending };
    case 'compte':
      return { kind, target: target(30), unit: keep('jours'), ...ascending };
    case 'serie':
      return { kind, target: target(30), unit: keep('jours'), ...ascending };
    case 'cumul':
      return { kind, target: target(100), unit: keep('km'), ...ascending };
    case 'performance':
      return { kind, target: target(10), unit: keep('km'), ...ascending };
    case 'mesure':
      return {
        kind,
        target: -target(5),
        unit: keep('kg'),
        direction: 'baisse',
        mode: 'delta',
      };
  }
}

/**
 * Cible telle qu'on la tape : toujours positive.
 * « Perdre 5 kg » se stocke en `-5`, mais personne n'écrit « -5 » dans un
 * champ intitulé « perdre ».
 */
export function targetForInput(tier: Pick<Tier, 'target'>): number | null {
  return typeof tier.target === 'number' ? Math.abs(tier.target) : null;
}

/** Signe rétabli au moment d'enregistrer : seule une mesure en baisse est négative. */
export function targetForStore(
  raw: number,
  tier: Pick<Tier, 'kind' | 'mode' | 'direction'>,
): number {
  const value = Math.abs(raw);
  const descending = tier.kind === 'mesure' && tier.mode === 'delta' && tier.direction === 'baisse';
  return descending ? -value : value;
}

/**
 * Cible d'une mesure, ramenée à une valeur absolue.
 * En mode delta, « perdre 5 kg » n'oblige pas à nommer un poids d'arrivée :
 * la cible se déduit du premier relevé. Tant qu'il n'y en a pas, il n'y a rien
 * à tracer.
 */
export function measureTarget(tier: Tier, series: Reading[]): number | null {
  if (tier.kind !== 'mesure' || typeof tier.target !== 'number') return null;
  if (tier.mode === 'absolu') return tier.target;
  if (series.length === 0) return null;
  return series[0].value + tier.target;
}

/**
 * Ce qu'un intitulé de palier annonce déjà.
 *
 * « Courir 21,1 km » porte sa cible et son unité : les redemander dans un
 * formulaire, palier après palier, est le plus gros frottement de la création
 * d'objectif — et il tombe au pire moment, avant la première victoire.
 *
 * La règle est volontairement bête : **le premier nombre du titre est la
 * cible, le mot qui le suit est l'unité**. Mesurée sur les 66 paliers chiffrés
 * de la bibliothèque, elle tombe juste 63 fois — les trois exceptions étant
 * « Courir un semi-marathon » (aucun chiffre), « Nager 1 km sans pause »
 * (cible réelle 1000 m, l'auteur a changé d'unité) et « 1er versement ». Une
 * règle plus savante ne gagnerait que ces trois-là et perdrait en lisibilité.
 *
 * Ce qu'elle ne fait **jamais** : deviner la *nature* du palier. « 30 pompes
 * d'affilée » et « 30 séances » portent le même nombre et n'ont rien à voir —
 * l'un est une performance, l'autre un compte. Le nombre est dans le titre, la
 * nature n'y est pas ; c'est elle qu'on demande une fois pour tout l'objectif.
 *
 * Et elle ne devine jamais en silence : la valeur trouvée est affichée et
 * modifiable avant l'enregistrement.
 */
export interface GuessedAmount {
  target: number;
  /** Vide quand le titre ne dit pas en quoi on compte. */
  unit: string;
}

/** Suffixes ordinaux : « 1er versement » ne compte pas des « er ». */
const ORDINAL = /^(er|ère|re|ere|è|e|ème|eme|nd|nde)$/i;

export function guessAmount(title: string): GuessedAmount | null {
  // Les séparateurs de milliers, y compris l'espace insécable fine : « 10 000 ».
  const text = title.replace(/(\d)[\s  ](\d{3})\b/g, '$1$2');
  const match = /(\d+(?:[.,]\d+)?)\s*([^\s,.;:!?]*)/.exec(text);
  if (!match) return null;

  const target = Number(match[1].replace(',', '.'));
  if (!Number.isFinite(target)) return null;

  const suivant = match[2].toLowerCase().replace(/^[«»"']+|[«»"'’)]+$/g, '');
  const unit = suivant === '' || ORDINAL.test(suivant) || /\d/.test(suivant) ? '' : suivant;

  // Un millésime n'est pas une cible : « Marathon 2027 » ne vise pas 2027
  // unités. On ne l'écarte que si rien ne suit pour le démentir — « 2000 pas »
  // reste une cible.
  if (unit === '' && Number.isInteger(target) && target >= 1900 && target <= 2100) return null;

  return { target, unit: unit.slice(0, 16) };
}

/**
 * La nature d'un objectif — déduite, jamais stockée.
 *
 * Un objectif « se compte en kilomètres » ou « en jours » : c'est une
 * propriété de l'objectif entier, et l'utilisateur veut la voir et la changer
 * d'un coup. Mais rien n'est ajouté en base pour autant. Le type d'un objectif
 * **est** celui de ses paliers, comme le streak est celui de ses réalisations
 * et la grille celle de son historique : recalculé à chaque affichage, donc
 * jamais désynchronisé, et vrai rétroactivement pour les objectifs existants.
 *
 * Stocker un champ sur l'objectif aurait créé la seule chose que ce projet
 * évite partout : deux sources de vérité qui peuvent se contredire — un
 * objectif annonçant « cumul en km » au-dessus de paliers comptant des jours.
 */
export interface LadderKind {
  kind: TierKind;
  unit: string;
  /** Les paliers ne s'accordent pas : on l'affiche plutôt que de mentir. */
  mixed: boolean;
}

export function ladderKind(tiers: Pick<Tier, 'kind' | 'unit'>[]): LadderKind | null {
  const comptables = tiers.filter((t) => t.kind !== 'jalon');
  if (comptables.length === 0) return null;

  const compte = <T>(values: T[]): T => {
    const tally = new Map<T, number>();
    for (const v of values) tally.set(v, (tally.get(v) ?? 0) + 1);
    // À égalité, le premier de l'échelle l'emporte : c'est celui que
    // l'utilisateur a posé en premier.
    let best = values[0];
    for (const [v, n] of tally) if (n > (tally.get(best) ?? 0)) best = v;
    return best;
  };

  const kind = compte(comptables.map((t) => t.kind));
  const memeNature = comptables.filter((t) => t.kind === kind);
  const unit = compte(memeNature.map((t) => t.unit));
  const mixed =
    new Set(comptables.map((t) => t.kind)).size > 1 ||
    new Set(memeNature.map((t) => t.unit)).size > 1;

  return { kind, unit, mixed };
}

/**
 * Les champs d'un palier qui hérite de l'échelle à laquelle il s'ajoute.
 *
 * C'est ce qui fait qu'un palier ajouté six mois plus tard n'a pas besoin
 * d'être requalifié à la main : il prend la nature de l'objectif, et sa cible
 * se lit dans son propre intitulé.
 *
 * Règle de sûreté : **sans cible, on reste un jalon**. Un palier comptable
 * sans nombre afficherait une barre bloquée à zéro pour toujours — le mode
 * d'échec le plus silencieux du domaine, et celui contre lequel un test
 * protège déjà les modèles de la bibliothèque.
 */
export function inheritedTier(title: string, ladder: LadderKind | null): Partial<TierInput> {
  if (!ladder) return {};
  const guess = guessAmount(title);
  if (!guess) return {};
  const base = kindFields(ladder.kind, {
    unit: guess.unit || ladder.unit,
    target: guess.target,
  });
  // `kindFields` a déjà posé le sens et le mode propres à cette nature ; c'est
  // eux qui décident du signe de la cible (« perdre 5 kg » se stocke -5).
  const target = targetForStore(guess.target, {
    kind: ladder.kind,
    direction: base.direction ?? JALON.direction,
    mode: base.mode ?? JALON.mode,
  });
  return { ...base, target };
}

/**
 * Les actions dont un objectif a besoin pour que ses paliers puissent monter.
 *
 * Le piège que ceci ferme : un objectif naît avec deux actions génériques
 * **sans unité**. Créer à la main un palier « Courir 100 km » puis cocher
 * « Un vrai effort » trois jours de suite laisse le palier à **0 / 100**, pour
 * toujours, sans que rien ne le signale. C'est le même défaut contre lequel un
 * test protège les modèles de la bibliothèque — mais rien ne protégeait les
 * objectifs écrits à la main.
 *
 * Donc : dès qu'on sait en quoi l'objectif se compte, les actions naissent en
 * portant cette unité.
 *
 * - **jalon, compte, série** : rien à changer. On coche des journées, et toute
 *   action non-relevé les nourrit.
 * - **cumul, performance** : les actions portent l'unité et une valeur
 *   habituelle, sans quoi un appui n'enregistre aucune quantité.
 * - **mesure** : il faut en plus un relevé, seul capable d'alimenter la courbe.
 *
 * La valeur habituelle est une devinette assumée — un dixième de la plus
 * petite cible pour un cumul, la moitié pour une performance — affichée et
 * modifiable dans l'éditeur d'actions. Un champ vide serait pire : il ouvrirait
 * le clavier à chaque coche, ce que tout le lot « un appui reste un appui »
 * cherche justement à éviter.
 */
export function starterActions(
  kind: TierKind,
  unit: string,
  targets: number[] = [],
): ActionInput[] {
  const base = DEFAULT_ACTIONS.map((a) => ({ ...a }));
  const clean = unit.trim();
  if (!clean || kind === 'jalon' || kind === 'compte' || kind === 'serie') return base;

  if (kind === 'mesure') {
    return [
      ...base,
      { title: `Relevé (${clean})`, pp: MEASURE_PP, unit: clean, defaultValue: null, isMeasure: true },
    ];
  }

  const plusPetite = Math.min(...targets.map((t) => Math.abs(t)).filter((t) => t > 0));
  const reference = Number.isFinite(plusPetite) ? plusPetite : 10;
  const part = kind === 'performance' ? reference / 2 : reference / 10;
  const habituelle = Math.max(1, Math.round(part * 10) / 10);
  return base.map((a, i) => ({
    ...a,
    unit: clean,
    // Le « petit pas » vaut la moitié du vrai effort : la nuance existe déjà
    // dans les PP, elle doit exister dans la quantité annoncée.
    defaultValue: i === 0 ? habituelle : Math.max(1, Math.round((habituelle / 2) * 10) / 10),
    isMeasure: false,
  }));
}
