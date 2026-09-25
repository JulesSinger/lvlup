import { describe, expect, it } from 'vitest';
import { dayLabel, rangeLabel, shiftDay, shortDayLabel } from './day';

describe('shiftDay', () => {
  it('traverse les fins de mois et d’année', () => {
    expect(shiftDay('2026-09-30', 1)).toBe('2026-10-01');
    expect(shiftDay('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('ne saute pas de jour au changement d’heure', () => {
    expect(shiftDay('2026-10-25', 1)).toBe('2026-10-26');
    expect(shiftDay('2026-03-29', -1)).toBe('2026-03-28');
  });
});

describe('dayLabel', () => {
  const today = '2026-09-25';

  it('nomme les jours proches comme on les dit', () => {
    expect(dayLabel('2026-09-25', today)).toBe('Aujourd’hui');
    expect(dayLabel('2026-09-24', today)).toBe('Hier');
    expect(dayLabel('2026-09-26', today)).toBe('Demain');
  });

  it('donne le jour de la semaine et la date au-delà', () => {
    expect(dayLabel('2026-09-21', today)).toBe('lundi 21 septembre');
  });

  it('précise l’année seulement quand ce n’est pas la même', () => {
    expect(dayLabel('2025-12-31', today)).toBe('mercredi 31 décembre 2025');
  });
});

describe('shortDayLabel', () => {
  it('abrège le jour de la semaine', () => {
    expect(shortDayLabel('2026-09-21')).toBe('lun 21');
  });
});

describe('rangeLabel', () => {
  it('dans un même mois', () => {
    expect(rangeLabel('2026-09-19', '2026-09-25')).toBe('du 19 au 25 septembre');
  });

  it('à cheval sur deux mois, puis sur deux années', () => {
    expect(rangeLabel('2026-09-29', '2026-10-05')).toBe('du 29 septembre au 5 octobre');
    expect(rangeLabel('2026-12-29', '2027-01-04')).toBe('du 29 décembre 2026 au 4 janvier 2027');
  });
});
