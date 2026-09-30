import { describe, expect, it } from 'vitest';
import { hashFor, initialModule, routeFromHash } from './moduleRoute';

const IDS = ['objectifs', 'budget', 'hautsfaits'];

describe('le module dit par l’adresse', () => {
  it('#/budget ouvre Budget, #/ la liste', () => {
    expect(routeFromHash('#/budget', IDS)).toBe('budget');
    expect(routeFromHash('#/', IDS)).toBeNull();
    expect(routeFromHash('#/budget/', IDS)).toBe('budget');
  });

  it('un module inconnu, ou retiré du registre, vaut la liste', () => {
    expect(routeFromHash('#/sport', IDS)).toBeNull();
  });

  it('une adresse qui n’est pas à nous ne dit rien — celles de Supabase passent intactes', () => {
    expect(routeFromHash('', IDS)).toBeUndefined();
    expect(routeFromHash('#access_token=abc&type=recovery', IDS)).toBeUndefined();
    expect(routeFromHash('#budget', IDS)).toBeUndefined();
  });

  it('l’adresse d’un module, et celle de la liste', () => {
    expect(hashFor('budget')).toBe('#/budget');
    expect(hashFor(null)).toBe('#/');
    expect(routeFromHash(hashFor('hautsfaits'), IDS)).toBe('hautsfaits');
  });
});

describe('le module ouvert au démarrage', () => {
  it('l’adresse l’emporte sur le dernier module retenu', () => {
    expect(initialModule('#/budget', 'objectifs', IDS)).toBe('budget');
    expect(initialModule('#/', 'objectifs', IDS)).toBeNull();
  });

  it('sans adresse, le dernier module retenu ; sans lui, la liste', () => {
    expect(initialModule('', 'hautsfaits', IDS)).toBe('hautsfaits');
    expect(initialModule('', null, IDS)).toBeNull();
    expect(initialModule('#access_token=abc', 'budget', IDS)).toBe('budget');
  });

  it('un dernier module qui n’existe plus renvoie à la liste', () => {
    expect(initialModule('', 'sport', IDS)).toBeNull();
  });

  it('avec un seul module, on y entre toujours', () => {
    expect(initialModule('#/', null, ['objectifs'])).toBe('objectifs');
  });
});
