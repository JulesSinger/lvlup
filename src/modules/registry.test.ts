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

  // La page d'accueil (26/10/2026) montre ce qu'un module fait chez un autre :
  // une phrase qui viserait un identifiant mal écrit disparaîtrait sans bruit.
  it('chaque lien annoncé sur la page d’accueil vise un autre module du registre', () => {
    const ids = new Set(MODULES.map((m) => m.id));
    for (const module of MODULES) {
      for (const link of module.landingLinks ?? []) {
        expect(ids.has(link.to), `${module.id} → ${link.to}`).toBe(true);
        expect(link.to).not.toBe(module.id);
        expect(link.text.length).toBeGreaterThan(10);
      }
    }
  });
});
