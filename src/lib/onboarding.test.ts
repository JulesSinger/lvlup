import { beforeEach, describe, expect, it } from 'vitest';
import { adoptLegacyOnboarding, hasOnboarded, markOnboarded } from './onboarding';

/**
 * Le bug que ces tests empêchent de revenir : créer un compte tout neuf dans
 * un navigateur qui avait déjà servi sautait l'accompagnement. Le nouvel
 * arrivant tombait sur un écran vide sans savoir ce qu'est un palier — et
 * c'est exactement la personne à qui l'accompagnement était destiné.
 */

// Le module s'appuie sur localStorage ; en environnement Node on en fournit
// une version minimale plutôt que de tirer tout un DOM.
const memory = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => memory.get(k) ?? null,
  setItem: (k: string, v: string) => void memory.set(k, v),
  removeItem: (k: string) => void memory.delete(k),
  clear: () => memory.clear(),
  key: (i: number) => [...memory.keys()][i] ?? null,
  get length() {
    return memory.size;
  },
} as Storage;

beforeEach(() => memory.clear());

describe('le marqueur suit l’utilisateur, pas l’appareil', () => {
  it('un utilisateur qui n’a rien vu doit voir l’accompagnement', () => {
    expect(hasOnboarded('u1')).toBe(false);
  });

  it('une fois vu, il ne se represente plus', () => {
    markOnboarded('u1');
    expect(hasOnboarded('u1')).toBe(true);
  });

  it('le compte du voisin n’hérite de rien', () => {
    // Le cœur du bug : deux comptes dans le même navigateur.
    markOnboarded('u1');
    expect(hasOnboarded('u2')).toBe(false);
  });

  it('chacun garde son marqueur', () => {
    markOnboarded('u1');
    markOnboarded('u2');
    expect(hasOnboarded('u1')).toBe(true);
    expect(hasOnboarded('u2')).toBe(true);
  });
});

describe('récupération de l’ancien marqueur global', () => {
  it('le premier connecté hérite de l’ancien drapeau', () => {
    // On ne peut pas savoir à qui il appartenait : il n'a jamais porté
    // d'identité. L'attribuer à celui qui arrive est le meilleur pari.
    localStorage.setItem('zenith.onboarded', '1');
    expect(adoptLegacyOnboarding('u1')).toBe(true);
    expect(hasOnboarded('u1')).toBe(true);
  });

  it('et il ne sert qu’une seule fois', () => {
    localStorage.setItem('zenith.onboarded', '1');
    adoptLegacyOnboarding('u1');
    expect(adoptLegacyOnboarding('u2')).toBe(false);
    expect(hasOnboarded('u2')).toBe(false);
  });

  it('sans ancien drapeau, il n’invente rien', () => {
    expect(adoptLegacyOnboarding('u1')).toBe(false);
    expect(hasOnboarded('u1')).toBe(false);
  });

  it('l’ancien drapeau est effacé, pas seulement ignoré', () => {
    localStorage.setItem('zenith.onboarded', '1');
    adoptLegacyOnboarding('u1');
    expect(localStorage.getItem('zenith.onboarded')).toBeNull();
  });
});
