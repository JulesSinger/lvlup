import { describe, expect, it } from 'vitest';
import { validatePlan, validateRun, validateSettings } from './validation';

const RUN = { startedAt: '2026-10-06T07:00:00Z', day: '2026-10-06', distanceM: 10_000, durationS: 3000 };
const PLAN = { title: 'Marathon d’Annecy', raceDistanceM: 42_195, raceDay: '2027-04-25', startDay: '2026-10-12' };

describe('validation', () => {
  it('une sortie', () => {
    expect(validateRun(RUN)).toBeNull();
    expect(validateRun({ ...RUN, distanceM: 600_000 })).toMatch(/distance/);
    expect(validateRun({ ...RUN, durationS: 0 })).toMatch(/durée/);
    expect(validateRun({ ...RUN, day: '06/10/2026' })).toMatch(/Jour/);
    expect(validateRun({ ...RUN, avgHr: 260 })).toMatch(/fréquence/);
    expect(validateRun({ ...RUN, avgHr: 170, maxHr: 160 })).toMatch(/moyenne/);
    expect(validateRun({ ...RUN, effort: 11 })).toMatch(/ressenti/);
  });

  it('un plan', () => {
    expect(validatePlan(PLAN)).toBeNull();
    expect(validatePlan({ ...PLAN, title: '  ' })).toMatch(/nom/);
    expect(validatePlan({ ...PLAN, startDay: '2027-05-01' })).toMatch(/avant la course/);
    expect(validatePlan({ ...PLAN, sessionsPerWeek: 7 })).toMatch(/séances/);
    expect(validatePlan({ ...PLAN, referenceDistanceM: 10_000 })).toMatch(/référence/);
  });

  it('les réglages de fréquence cardiaque', () => {
    expect(validateSettings({ hrMax: 190, hrRest: 50 })).toBeNull();
    expect(validateSettings({ hrMax: 190, hrRest: 195 })).toMatch(/repos/);
    expect(validateSettings({ hrMax: 300, hrRest: null })).toMatch(/maximale/);
  });
});
