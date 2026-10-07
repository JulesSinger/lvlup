import { describe, expect, it } from 'vitest';
import { hrZones, suggestedHrMax, zoneOf } from './zones';

describe('les zones de fréquence cardiaque', () => {
  it('Karvonen : sur la réserve cardiaque quand la FC de repos est connue', () => {
    const zones = hrZones({ hrMax: 190, hrRest: 50 })!;
    // Réserve 140 : zone 2 de 50 + 0,6 × 140 = 134 à 50 + 0,7 × 140 − 1 = 147.
    expect(zones[1]).toEqual({ zone: 2, min: 134, max: 147 });
    expect(zones[4]).toEqual({ zone: 5, min: 176, max: 190 });
    expect(zoneOf(140, zones)).toBe(2);
    expect(zoneOf(148, zones)).toBe(3);
    expect(zoneOf(195, zones)).toBe(5);
    expect(zoneOf(100, zones)).toBeNull();
  });

  it('sans FC de repos, des parts de la FC maximale', () => {
    const zones = hrZones({ hrMax: 200, hrRest: null })!;
    expect(zones[0]).toEqual({ zone: 1, min: 100, max: 119 });
  });

  it('rien sans FC maximale', () => {
    expect(hrZones({ hrMax: null, hrRest: 50 })).toBeNull();
    expect(zoneOf(150, null)).toBeNull();
  });

  it('propose la plus haute FC vue, jamais une valeur inventée', () => {
    expect(suggestedHrMax([{ maxHr: 181 }, { maxHr: null }, { maxHr: 188 }])).toBe(188);
    expect(suggestedHrMax([{ maxHr: null }])).toBeNull();
  });
});
