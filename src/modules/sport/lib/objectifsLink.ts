/**
 * Le lien avec Objectifs — bibliothèque pure (docs/etude-sport.md §6.1, §18).
 *
 * Objectifs n'accepte qu'une coche par action et par jour : Sport coche donc
 * l'action choisie **une fois par jour couru**, avec la quantité du jour
 * (deux sorties le même jour s'additionnent), sous la référence
 * « sport:jour:AAAA-MM-JJ ». Le module calcule ce qui doit être coché ; le
 * service d'Objectifs (`checkins`) écrit. Rejouer le calcul ne change rien.
 */
import type { CheckinRequest, RecordedCheckin } from '../../../core/lib/services';
import { formatDuration, formatKm } from './format';
import type { Run } from './types';

export const CHECKIN_PREFIX = 'sport:jour:';

/**
 * La quantité d'un jour dans l'unité de l'action : des km (un chiffre après
 * la virgule), des mètres, des minutes ou des heures ; rien pour une unité
 * qu'on ne sait pas remplir (« séance », « pas »…) — la coche compte alors
 * comme une réalisation, sans quantité.
 */
export function dayValue(runs: readonly Run[], unit: string): number | null {
  const m = runs.reduce((s, r) => s + r.distanceM, 0);
  const s = runs.reduce((a, r) => a + r.durationS, 0);
  const u = unit.trim().toLowerCase();
  if (u === 'km' || u.startsWith('kilom')) return Math.round(m / 100) / 10;
  if (u === 'm' || u.startsWith('mètre') || u.startsWith('metre')) return m;
  if (u === 'min' || u === 'mn' || u.startsWith('minute')) return Math.round(s / 60);
  if (u === 'h' || u.startsWith('heure')) return Math.round(s / 36) / 100;
  return null;
}

/** Les coches voulues : une par jour couru depuis la création de l'objectif. */
export function desiredCheckins(runs: readonly Run[], link: { actionId: string; unit: string; since: string }): CheckinRequest[] {
  const byDay = new Map<string, Run[]>();
  for (const r of runs) if (r.day >= link.since) byDay.set(r.day, [...(byDay.get(r.day) ?? []), r]);
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, these]) => ({
      ref: `${CHECKIN_PREFIX}${day}`,
      actionId: link.actionId,
      day,
      value: dayValue(these, link.unit),
      note: `${these.length > 1 ? `${these.length} sorties · ` : ''}${formatKm(these.reduce((s, r) => s + r.distanceM, 0))} en ${formatDuration(
        these.reduce((s, r) => s + r.durationS, 0),
      )} · d’après Sport`,
    }));
}

/**
 * Ce qu'il faut écrire pour passer de ce qui est coché à ce qui est voulu :
 * retirer les coches de jours sans sortie (sortie supprimée) ou posées sur
 * une autre action (le lien a changé), poser ou corriger les autres. Ce qui
 * est déjà juste n'est pas réécrit.
 */
export function linkPlan(desired: readonly CheckinRequest[], existing: readonly RecordedCheckin[]): { remove: string[]; record: CheckinRequest[] } {
  const wanted = new Map(desired.map((d) => [d.ref, d]));
  const have = new Map(existing.map((e) => [e.ref, e]));
  const remove = existing.filter((e) => !wanted.has(e.ref) || e.actionId !== wanted.get(e.ref)!.actionId).map((e) => e.ref);
  const record = desired.filter((d) => {
    const e = have.get(d.ref);
    return !e || e.actionId !== d.actionId || e.value !== d.value || e.note !== d.note;
  });
  return { remove, record };
}
