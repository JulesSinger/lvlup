import { describe, expect, it } from 'vitest';
import { ageAtFeat, ageLabel, ageOn, ageReachedIn, sinceLabel } from './age';

const BIRTH = '1999-03-12';

describe('l’âge qu’on avait', () => {
  it('années révolues, la veille et le jour de l’anniversaire', () => {
    expect(ageOn(BIRTH, '2017-03-11')).toBe(17);
    expect(ageOn(BIRTH, '2017-03-12')).toBe(18);
  });

  it('l’âge atteint une année donnée (en-tête de la frise)', () => {
    expect(ageReachedIn(BIRTH, 2014)).toBe(15);
  });

  it('au jour près, l’âge est exact', () => {
    const age = ageAtFeat(BIRTH, '2017-07-05', 'day');
    expect(age).toEqual({ years: 18, exact: true });
    expect(ageLabel(age!, 'day')).toBe('tu avais 18 ans');
  });

  it('une année qui englobe l’anniversaire : on dit l’âge atteint, sans deviner', () => {
    const age = ageAtFeat(BIRTH, '2014-01-01', 'year');
    expect(age).toEqual({ years: 15, exact: false });
    expect(ageLabel(age!, 'year')).toBe('l’année de tes 15 ans');
  });

  it('un mois : exact s’il ne contient pas l’anniversaire, sinon « le mois de tes… »', () => {
    expect(ageAtFeat(BIRTH, '2021-06-01', 'month')).toEqual({ years: 22, exact: true });
    const march = ageAtFeat(BIRTH, '2022-03-01', 'month');
    expect(march).toEqual({ years: 23, exact: false });
    expect(ageLabel(march!, 'month')).toBe('le mois de tes 23 ans');
  });

  it('sans date de naissance, ou avant elle, pas d’âge ; « 1 an » au singulier', () => {
    expect(ageAtFeat(null, '2017-07-05', 'day')).toBeNull();
    expect(ageAtFeat(BIRTH, '1998-01-01', 'year')).toBeNull();
    expect(ageLabel({ years: 1, exact: true }, 'day')).toBe('tu avais 1 an');
  });
});

describe('le temps écoulé, pas plus précis que la date', () => {
  const TODAY = '2026-09-30';

  it('au jour près : années, mois, jours', () => {
    expect(sinceLabel('2019-09-30', 'day', TODAY)).toBe('il y a 7 ans');
    expect(sinceLabel('2019-10-01', 'day', TODAY)).toBe('il y a 6 ans');
    expect(sinceLabel('2025-09-30', 'day', TODAY)).toBe('il y a 1 an');
    expect(sinceLabel('2026-06-15', 'day', TODAY)).toBe('il y a 3 mois');
    expect(sinceLabel('2026-09-12', 'day', TODAY)).toBe('il y a 18 jours');
    expect(sinceLabel('2026-09-29', 'day', TODAY)).toBe('hier');
    expect(sinceLabel(TODAY, 'day', TODAY)).toBe('aujourd’hui');
  });

  it('au mois près', () => {
    expect(sinceLabel('2026-09-01', 'month', TODAY)).toBe('ce mois-ci');
    expect(sinceLabel('2026-08-01', 'month', TODAY)).toBe('le mois dernier');
    expect(sinceLabel('2026-01-01', 'month', TODAY)).toBe('il y a 8 mois');
    expect(sinceLabel('2021-01-01', 'month', TODAY)).toBe('il y a 5 ans');
  });

  it('à l’année près', () => {
    expect(sinceLabel('2026-01-01', 'year', TODAY)).toBe('cette année');
    expect(sinceLabel('2025-01-01', 'year', TODAY)).toBe('l’an dernier');
    expect(sinceLabel('2014-01-01', 'year', TODAY)).toBe('il y a 12 ans');
  });
});
