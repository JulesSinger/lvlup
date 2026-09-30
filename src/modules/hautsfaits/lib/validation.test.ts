import { describe, expect, it } from 'vitest';
import type { FeatInput } from './types';
import { validateFeat } from './validation';

const TODAY = '2026-09-30';
const OK: FeatInput = { title: 'Semi-marathon de Paris', category: 'sport', dateStart: '2025-03-02', datePrecision: 'day' };
const check = (patch: Partial<FeatInput>) => validateFeat({ ...OK, ...patch }, TODAY);

describe('valider un haut fait', () => {
  it('un haut fait complet passe, période comprise', () => {
    expect(check({})).toBeNull();
    expect(check({ dateStart: '2021-01-01', datePrecision: 'month', dateEnd: '2021-06-01', dateEndPrecision: 'month' })).toBeNull();
  });

  it('un titre, une catégorie connue', () => {
    expect(check({ title: '   ' })).toBe('Donne un titre à ce haut fait.');
    expect(check({ title: 'x'.repeat(201) })).toMatch(/trop long/);
    expect(check({ category: 'loisirs' as never })).toBe('Choisis une catégorie.');
  });

  it('une vraie date, rangée au début de sa période', () => {
    expect(check({ dateStart: '2025-02-30' })).toBe('Date invalide.');
    expect(check({ dateStart: '2014-06-01', datePrecision: 'year' })).toBe('La date doit être rangée au début de sa période.');
    expect(check({ dateStart: '2018-06-15', datePrecision: 'month' })).toBe('La date doit être rangée au début de sa période.');
  });

  it('pas dans le futur ; l’année ou le mois en cours restent permis', () => {
    expect(check({ dateStart: '2026-10-01' })).toMatch(/déjà arrivé/);
    expect(check({ dateStart: '2026-01-01', datePrecision: 'year' })).toBeNull();
    expect(check({ dateStart: '2026-09-01', datePrecision: 'month' })).toBeNull();
  });

  it('une fin après le début, et différente de lui ; elle peut être prévue', () => {
    expect(check({ dateEnd: '2025-03-01', dateEndPrecision: 'day' })).toBe('La fin est avant le début.');
    expect(check({ dateEnd: '2025-03-02', dateEndPrecision: 'day' })).toMatch(/retire-la/);
    expect(check({ dateEnd: '2025-03-15', dateEndPrecision: 'month' })).toMatch(/rangée au début/);
    expect(check({ dateEndPrecision: 'day' })).toBe('Une précision de fin sans date de fin.');
    expect(check({ dateStart: '2026-09-01', datePrecision: 'month', dateEnd: '2027-02-01', dateEndPrecision: 'month' })).toBeNull();
  });

  it('les champs libres ont leur longueur', () => {
    expect(check({ highlight: 'x'.repeat(61) })).toMatch(/chiffre clé/);
    expect(check({ place: 'x'.repeat(121) })).toMatch(/lieu/);
    expect(check({ people: 'x'.repeat(201) })).toMatch(/Avec qui/);
    expect(check({ story: 'x'.repeat(4001) })).toMatch(/récit/);
  });
});
