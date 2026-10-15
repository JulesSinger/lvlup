import { describe, expect, it } from 'vitest';
import { demoFromSearch, demoHref, exitDemoHref, todayString } from './demo';

describe('demoFromSearch', () => {
  it('lit le module de la démo dans l’adresse', () => {
    expect(demoFromSearch('?demo=taches')).toBe('taches');
    expect(demoFromSearch('?x=1&demo=recettes')).toBe('recettes');
  });

  it('ignore une adresse sans démo, ou un nom qui n’en est pas un', () => {
    expect(demoFromSearch('')).toBeNull();
    expect(demoFromSearch('?demo=../palier')).toBeNull();
    expect(demoFromSearch('?demo=')).toBeNull();
  });
});

describe('les adresses de la démo', () => {
  it('entrer, puis sortir sur le même module', () => {
    expect(demoHref('budget', { pathname: '/' })).toBe('/?demo=budget#/budget');
    expect(exitDemoHref('budget', { pathname: '/' })).toBe('/#/budget');
  });

  it('dit le jour en heure locale', () => {
    expect(todayString(new Date(2026, 9, 5, 23, 30))).toBe('2026-10-05');
  });
});
