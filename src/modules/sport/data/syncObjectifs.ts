import type { CheckinService } from '../../../core/lib/services';
import { CHECKIN_PREFIX, desiredCheckins, linkPlan } from '../lib/objectifsLink';
import type { Run } from '../lib/types';

export interface LinkResult {
  recorded: number;
  removed: number;
  /** Jours déjà cochés à la main dans Objectifs : laissés tels quels. */
  taken: number;
}

/**
 * Met les coches d'Objectifs d'accord avec les sorties (docs/etude-sport.md
 * §18). `actionId` null : le lien est défait, toutes les coches de Sport sont
 * retirées. Les retraits d'abord, pour qu'une coche qui change d'action ne
 * bute pas sur elle-même.
 */
export async function syncObjectifs(service: CheckinService, runs: Run[], actionId: string | null): Promise<LinkResult> {
  const existing = await service.list(CHECKIN_PREFIX);
  let desired: ReturnType<typeof desiredCheckins> = [];
  if (actionId) {
    const choice = (await service.actions()).find((a) => a.actionId === actionId);
    if (!choice) throw new Error('L’action d’Objectifs choisie n’existe plus (objectif archivé ?) : choisis-en une autre.');
    desired = desiredCheckins(runs, { actionId, unit: choice.unit, since: choice.since });
  }
  const { remove, record } = linkPlan(desired, existing);
  for (const ref of remove) await service.remove(ref);
  let taken = 0;
  for (const request of record) if ((await service.record(request)) === 'taken') taken += 1;
  return { recorded: record.length - taken, removed: remove.length, taken };
}
