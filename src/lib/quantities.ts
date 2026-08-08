import { feedingCheckins } from './counters';
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
