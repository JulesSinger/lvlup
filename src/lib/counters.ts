import { dayString } from './streak';
import type { Action, Checkin, Tier } from './types';

/**
 * Comptage des paliers.
 *
 * Tout est recalculé depuis l'historique, jamais stocké — comme le streak.
 * Trois conséquences qu'on ne veut surtout pas perdre :
 *  · aucune désynchronisation possible entre deux appareils ;
 *  · un import de sauvegarde retombe juste tout seul ;
 *  · une coche rétroactive (le rattrapage d'un oubli) répare le compte sans
 *    une ligne de logique supplémentaire.
 */

export interface TierProgress {
  /** Valeur atteinte, dans l'unité du palier */
  current: number;
  /** Cible à atteindre, toujours exprimée en absolu ici */
  target: number;
  /** Part du chemin parcouru, entre 0 et 1 */
  percent: number;
  /** La cible a-t-elle été atteinte, ne serait-ce qu'une fois ? */
  reached: boolean;
  /** Meilleure série (serie) ou meilleure valeur (performance) atteinte */
  best: number | null;
  /** Premier relevé, pour une mesure */
  baseline: number | null;
  /** Dernier relevé, pour une mesure */
  latest: number | null;
}

/** Un palier « jalon » n'a rien à compter : il se coche à la main. */
export function isCountable(tier: Tier): boolean {
  return tier.kind !== 'jalon' && typeof tier.target === 'number';
}

/**
 * Une action peut-elle alimenter ce palier, quand rien n'a été configuré ?
 *
 * Sans cette règle, ajouter « Me peser » à un objectif ferait exploser le
 * cumul « 100 km » de 78 kilomètres d'un coup, et ferait avancer d'un jour un
 * palier « 30 jours sans écran » — se peser n'est pas la discipline visée.
 * Deux mondes, donc, qui ne se mélangent jamais tout seuls : les efforts d'un
 * côté, les relevés de l'autre.
 *
 * Une action inconnue (supprimée, ou check-in antérieur aux actions) passe :
 * on ne sait rien d'elle, et l'historique ne se réécrit pas.
 */
function feedsByDefault(tier: Tier, action: Action | undefined): boolean {
  if (!action) return true;
  if (tier.kind === 'mesure') return action.isMeasure;
  return !action.isMeasure;
}

/**
 * Réalisations qui alimentent un palier.
 * `sources` vide signifie « toutes les actions compatibles de l'objectif » —
 * c'est le cas courant, et ça évite toute configuration. Une liste explicite
 * l'emporte toujours : elle est le choix de l'utilisateur.
 */
export function feedingCheckins(
  tier: Tier,
  checkins: Checkin[],
  actions: Action[] = [],
): Checkin[] {
  const sources = new Set(tier.sources);
  const byId = new Map(actions.map((a) => [a.id, a]));
  return checkins.filter((c) => {
    if (c.goalId !== tier.goalId) return false;
    if (sources.size > 0) return c.actionId !== null && sources.has(c.actionId);
    return feedsByDefault(tier, c.actionId ? byId.get(c.actionId) : undefined);
  });
}

/**
 * Quantité apportée par une réalisation.
 * À défaut de valeur relevée, on retombe sur la valeur habituelle de l'action —
 * c'est ce qui permet de cocher sans rien saisir tout en alimentant un cumul
 * en kilomètres.
 */
function contribution(checkin: Checkin, actions: Action[]): number {
  if (typeof checkin.value === 'number') return checkin.value;
  const action = actions.find((a) => a.id === checkin.actionId);
  if (action && typeof action.defaultValue === 'number') return action.defaultValue;
  return 0;
}

/** Jours distincts, triés, d'une liste de réalisations. */
function distinctDays(checkins: Checkin[]): string[] {
  return [...new Set(checkins.map((c) => c.day))].sort();
}

function daysBetween(a: string, b: string): number {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  // Midi local pour neutraliser les changements d'heure été/hiver.
  return Math.round(
    (new Date(yb, mb - 1, db, 12).getTime() - new Date(ya, ma - 1, da, 12).getTime()) / 86_400_000,
  );
}

/**
 * Série en cours et meilleure série.
 *
 * La série courante n'est pas cassée tant que la journée n'est pas finie :
 * si la dernière activité date d'hier, on est encore dans les temps. C'est la
 * même tolérance que le streak, et elle évite de voir son compteur retomber à
 * zéro à 8 h du matin.
 */
function seriesCounts(days: string[], today: string): { current: number; best: number } {
  if (days.length === 0) return { current: 0, best: 0 };

  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = daysBetween(days[i - 1], days[i]) === 1 ? run + 1 : 1;
    if (run > best) best = run;
  }

  const last = days[days.length - 1];
  const gap = daysBetween(last, today);
  const current = gap <= 1 ? run : 0;
  return { current, best };
}

/**
 * Où en est un palier comptable. `null` pour un jalon, qui n'a rien à compter.
 */
export function tierProgress(
  tier: Tier,
  actions: Action[],
  checkins: Checkin[],
  today: string = dayString(),
): TierProgress | null {
  if (!isCountable(tier)) return null;
  const target = tier.target as number;
  const feeding = feedingCheckins(tier, checkins, actions).filter((c) => c.day <= today);

  const empty: TierProgress = {
    current: 0,
    target,
    percent: 0,
    reached: false,
    best: null,
    baseline: null,
    latest: null,
  };

  switch (tier.kind) {
    // « 30 jours sans écran » et « 100 km » sont deux accumulations, mais on
    // n'y accumule pas la même chose. Deviner laquelle à partir du nom de
    // l'unité marchait pour « jours » et cassait pour « nuits » ou
    // « séances » — le palier le dit donc explicitement.
    case 'compte': {
      // Des jours distincts : deux actions cochées le même jour ne font pas
      // deux jours. Sous-compter vaut mieux que sur-compter, une cérémonie
      // offerte trop tôt dévalorise toutes les suivantes.
      const current = distinctDays(feeding).length;
      return {
        ...empty,
        current,
        percent: target === 0 ? 0 : Math.min(1, current / target),
        reached: current >= target,
      };
    }

    case 'cumul': {
      const current = feeding.reduce((sum, c) => sum + contribution(c, actions), 0);
      return {
        ...empty,
        current,
        percent: target === 0 ? 0 : Math.min(1, current / target),
        reached: current >= target,
      };
    }

    case 'serie': {
      const { current, best } = seriesCounts(distinctDays(feeding), today);
      // La série peut retomber, mais le record reste : ce qui a été tenu n'est
      // jamais effacé. C'est ce qui rend le mode série supportable.
      const peak = Math.max(current, best);
      return {
        ...empty,
        current,
        best,
        percent: target === 0 ? 0 : Math.min(1, current / target),
        reached: peak >= target,
      };
    }

    case 'performance': {
      // La meilleure valeur d'une SEULE séance — jamais une somme.
      const values = feeding
        .map((c) => contribution(c, actions))
        .filter((v) => Number.isFinite(v) && v !== 0);
      if (values.length === 0) return empty;
      const best = tier.direction === 'baisse' ? Math.min(...values) : Math.max(...values);
      const reached = tier.direction === 'baisse' ? best <= target : best >= target;
      return {
        ...empty,
        current: best,
        best,
        percent: target === 0 ? 0 : Math.min(1, tier.direction === 'baisse' ? target / best : best / target),
        reached,
      };
    }

    case 'mesure': {
      const relevés = feeding
        .filter((c) => typeof c.value === 'number')
        .sort((a, b) => a.day.localeCompare(b.day) || a.createdAt.localeCompare(b.createdAt));
      if (relevés.length === 0) return empty;

      const baseline = relevés[0].value as number;
      const latest = relevés[relevés.length - 1].value as number;
      // En delta, la cible est relative au premier relevé : « perdre 5 kg »
      // n'oblige pas à nommer un poids d'arrivée.
      const absolute = tier.mode === 'delta' ? baseline + target : target;

      const satisfied = (v: number) =>
        tier.direction === 'baisse' ? v <= absolute : v >= absolute;
      // « Atteint une fois » suffit : un palier gagné reste gagné, même si la
      // mesure repart dans l'autre sens la semaine suivante.
      const reached = relevés.some((c) => satisfied(c.value as number));

      const span = absolute - baseline;
      const done = latest - baseline;
      const percent = span === 0 ? (reached ? 1 : 0) : Math.max(0, Math.min(1, done / span));

      return {
        current: done,
        target: span,
        percent,
        reached,
        best: tier.direction === 'baisse'
          ? Math.min(...relevés.map((c) => c.value as number))
          : Math.max(...relevés.map((c) => c.value as number)),
        baseline,
        latest,
      };
    }

    default:
      return null;
  }
}

/**
 * Ce que la coche du jour ajouterait à un palier, s'il n'est pas déjà nourri
 * aujourd'hui. Sert au « +1 ce soir » qui relie explicitement le geste à la
 * marche qu'il fait monter.
 */
export function todayContribution(
  tier: Tier,
  actions: Action[],
  checkins: Checkin[],
  today: string = dayString(),
): number {
  if (!isCountable(tier)) return 0;
  if (tier.kind === 'mesure' || tier.kind === 'performance') return 0;

  const already = feedingCheckins(tier, checkins, actions).some((c) => c.day === today);
  if (already) return 0;

  if (tier.kind === 'cumul') {
    const sources = new Set(tier.sources);
    const candidates = actions.filter(
      (a) => a.goalId === tier.goalId && (sources.size === 0 || sources.has(a.id)),
    );
    return candidates.reduce((max, a) => Math.max(max, a.defaultValue ?? 0), 0);
  }
  return 1;
}

/** Formate une quantité sans décimale inutile : 8, 8,5, 78,1. */
export function formatAmount(value: number, unit = ''): string {
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toFixed(1).replace('.', ',');
  return unit ? `${text} ${unit}` : text;
}
