import { describe, expect, it } from 'vitest';
import { displayUrl, looksLikePassword, safeHref, sortLinks, validateLink } from './links';
import type { ProjectLink } from './types';

const link = (id: string, kind: ProjectLink['kind'], position = 0): ProjectLink => ({ id, projectId: 'p', kind, label: id, url: '', login: '', note: '', position });

describe('les liens et les accès', () => {
  it('une adresse sans protocole s’ouvre en https ; javascript: jamais', () => {
    expect(safeHref('fleursdelou.fr')).toBe('https://fleursdelou.fr');
    expect(safeHref('http://x.fr')).toBe('http://x.fr');
    expect(safeHref('mailto:lou@x.fr')).toBe('mailto:lou@x.fr');
    expect(safeHref('javascript:alert(1)')).toBeNull();
    expect(safeHref('  ')).toBeNull();
    expect(displayUrl('https://www.figma.com/file/abc/')).toBe('www.figma.com/file/abc');
  });

  it('rangés par sorte, puis par position', () => {
    expect(sortLinks([link('ovh', 'domaine'), link('figma2', 'maquette', 1), link('figma1', 'maquette', 0)]).map((l) => l.id)).toEqual(['figma1', 'figma2', 'ovh']);
  });

  it('un mot de passe noté est refusé, une indication de rangement non', () => {
    expect(looksLikePassword('mdp : Fleurs2026!')).toBe(true);
    expect(looksLikePassword('Password=abc')).toBe(true);
    expect(looksLikePassword('mot de passe: tulipe')).toBe(true);
    expect(looksLikePassword('mot de passe dans Bitwarden')).toBe(false);
    expect(looksLikePassword('Pass Culture accepté')).toBe(false);
    expect(validateLink({ kind: 'hebergement', label: 'OVH', login: 'lou', note: 'mdp: secret' })).toMatch(/coffre-fort/);
    expect(validateLink({ kind: 'hebergement', label: 'OVH', login: 'lou@fleurs.fr', note: 'Bitwarden : Fleurs de Lou — OVH' })).toBeNull();
  });

  it('un nom, et une adresse web', () => {
    expect(validateLink({ kind: 'site', label: ' ' })).toMatch(/nom/);
    expect(validateLink({ kind: 'site', label: 'Site', url: 'ftp://x' })).toMatch(/adresses web/);
    expect(validateLink({ kind: 'site', label: 'Site', url: 'fleursdelou.fr' })).toBeNull();
  });
});
