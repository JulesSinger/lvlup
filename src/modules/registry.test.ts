import { describe, expect, it } from 'vitest';
import { MODULES } from './index';

/**
 * Le nom d'un module ne vit qu'à un endroit, sa déclaration (`label`,
 * CLAUDE.md §4). Ce qui l'affiche ailleurs doit le suivre : le renommage du
 * 28/09/2026 (Zénith → Objectifs, Polaris → Tâches…) a montré qu'un calque
 * d'Éclipse pouvait sinon garder l'ancien nom sans que rien ne casse.
 */
describe('le registre des modules', () => {
  it('chaque calque d’Éclipse porte l’identifiant et le nom de son module', () => {
    for (const module of MODULES) {
      for (const source of module.provides?.calendarSources ?? []) {
        expect([source.id, source.label]).toEqual([module.id, module.label]);
      }
    }
  });

  it('des noms et des icônes tous différents : on s’y retrouve d’un coup d’œil', () => {
    expect(new Set(MODULES.map((m) => m.label)).size).toBe(MODULES.length);
    expect(new Set(MODULES.map((m) => m.emoji)).size).toBe(MODULES.length);
  });
});
