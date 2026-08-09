import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Le garde-fou entre modules.
 *
 * Atlas est construit par plusieurs conversations sans mémoire partagée, une
 * par module. Une convention écrite dans `CLAUDE.md` ne survit pas à trois
 * agents : elle est lue, comprise à moitié, puis contournée par commodité.
 * Une convention **vérifiée par un test** survit, parce qu'elle casse le build.
 *
 * Ce fichier est donc la version exécutable de `CLAUDE.md`. Quand une règle
 * change, elle change ici en même temps que là-bas — sinon l'un des deux ment.
 *
 * Les listes d'exemption ci-dessous rendent la dette **visible et nommée**
 * plutôt que tacite. Un nouveau module n'y entre jamais : elles ne peuvent que
 * se vider.
 */

const SRC = new URL('..', import.meta.url).pathname;
const MODULES_DIR = join(SRC, 'modules');

/** Modules antérieurs à une règle. À vider, jamais à allonger. */
const LEGACY = {
  /** `e2e-check.mjs` est encore à la racine et couvre socle + objectifs mêlés. */
  sansSuiteE2E: ['objectifs'],
  /** Ses classes datent d'avant la règle de préfixe (`.goal-`, `.heat-`, `.tier-`…). */
  sansPrefixeCSS: ['objectifs'],
};

/**
 * Plafond de couplage d'`App.tsx`.
 *
 * `App.tsx` porte encore tout l'écran du module objectifs, ce qui devra être
 * extrait pour qu'il devienne la coquille du hub. En attendant, ce plafond
 * empêche la situation d'empirer : un agent peut réduire ce nombre, jamais
 * l'augmenter. Objectif final : 0.
 */
const PLAFOND_IMPORTS_MODULE_DANS_APP = 22;

function modules(): string[] {
  return readdirSync(MODULES_DIR).filter((name) => {
    const p = join(MODULES_DIR, name);
    return statSync(p).isDirectory() && !name.startsWith('_');
  });
}

function lire(...parts: string[]): string {
  return readFileSync(join(...parts), 'utf8');
}

/** Tous les fichiers de code d'un dossier, en profondeur. */
function fichiers(dir: string, exts = ['.ts', '.tsx']): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...fichiers(p, exts));
    else if (exts.some((e) => name.endsWith(e))) out.push(p);
  }
  return out;
}

const ids = modules();

describe('conventions des modules', () => {
  it('il y a au moins un module', () => {
    expect(ids.length).toBeGreaterThan(0);
  });

  describe.each(ids)('module « %s »', (id) => {
    const dir = join(MODULES_DIR, id);

    it('se déclare dans un module.ts', () => {
      expect(existsSync(join(dir, 'module.ts'))).toBe(true);
    });

    it('porte un id technique égal au nom de son dossier', () => {
      // Sans ça, le dossier, les préfixes SQL et la clé de sauvegarde
      // divergent — et une sauvegarde devient illisible sans qu'on sache
      // pourquoi.
      expect(lire(dir, 'module.ts')).toContain(`id: '${id}'`);
    });

    it('est inscrit au registre', () => {
      // Un module absent du registre est un module dont les données ne sont
      // pas sauvegardées. C'est silencieux, et ça ne se voit qu'à la
      // restauration.
      const registre = lire(MODULES_DIR, 'index.ts');
      expect(registre).toContain(`./${id}/module`);
    });

    it('apporte son contrat de stockage et ses deux implémentations', () => {
      // Une seule des deux = mode local ou mode connecté cassé, selon celle
      // qui manque, et seulement chez l'utilisateur qui l'emprunte.
      const noms = existsSync(join(dir, 'data')) ? readdirSync(join(dir, 'data')) : [];
      expect(noms.some((n) => /Store\.ts$/.test(n) && !n.includes('.test.'))).toBe(true);
      expect(noms.some((n) => /^local/i.test(n))).toBe(true);
      expect(noms.some((n) => /^supabase/i.test(n))).toBe(true);
      expect(noms).toContain('index.ts');
    });

    it('a son style, importé depuis styles.css', () => {
      expect(existsSync(join(dir, 'styles'))).toBe(true);
      expect(lire(SRC, 'styles.css')).toContain(`./modules/${id}/styles/`);
    });

    it('a au moins un test unitaire', () => {
      const tests = fichiers(dir).filter((f) => f.endsWith('.test.ts'));
      expect(tests.length).toBeGreaterThan(0);
    });

    it('a une suite de bout en bout', () => {
      if (LEGACY.sansSuiteE2E.includes(id)) return; // dette nommée, voir en tête
      expect(existsSync(join(dir, 'e2e'))).toBe(true);
    });

    it("n'importe depuis aucun autre module", () => {
      // C'est la règle qui rend les modules réellement indépendants : deux
      // agents peuvent alors travailler chacun dans son dossier sans se lire.
      const autres = ids.filter((a) => a !== id);
      for (const f of fichiers(dir)) {
        for (const autre of autres) {
          expect(lire(f), `${f} importe le module ${autre}`).not.toMatch(
            new RegExp(`from '[^']*modules/${autre}/`),
          );
        }
      }
    });

    it('préfixe ses classes CSS par son nom technique', () => {
      if (LEGACY.sansPrefixeCSS.includes(id)) return; // dette nommée
      const feuilles = fichiers(join(dir, 'styles'), ['.css']);
      for (const f of feuilles) {
        for (const ligne of lire(f).split('\n')) {
          const m = /^\.([a-z][\w-]*)/.exec(ligne);
          if (m && !m[1].startsWith(id)) {
            throw new Error(`${f} : la classe .${m[1]} devrait commencer par .${id}-`);
          }
        }
      }
    });
  });
});

describe('sens des dépendances', () => {
  it("le socle n'importe jamais depuis un module", () => {
    // Si tu as besoin de l'inverse, c'est que la pièce concernée appartient au
    // socle : remonte-la, comme `AppUser` l'a été.
    for (const f of fichiers(join(SRC, 'core'))) {
      expect(lire(f), `${f} importe depuis un module`).not.toMatch(/from '[^']*modules\//);
    }
  });

  it("styles.css n'ordonne que des imports", () => {
    // Son ordre fait la cascade : y écrire une règle la rendrait impossible à
    // situer, et déplacerait silencieusement l'apparence de l'app.
    const lignes = lire(SRC, 'styles.css')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('/*') && !l.startsWith('*') && !l.startsWith('//'));
    for (const ligne of lignes) {
      expect(ligne, `règle CSS hors import : ${ligne}`).toMatch(/^@import/);
    }
  });
});

describe('coquille du hub', () => {
  it("App.tsx ne se couple pas davantage aux modules qu'aujourd'hui", () => {
    // Plafond à faire baisser, jamais monter — voir le commentaire en tête.
    const imports = lire(SRC, 'App.tsx')
      .split('\n')
      .filter((l) => /^import .* from '\.\/modules\//.test(l));
    expect(
      imports.length,
      `App.tsx importe ${imports.length} fois un module (plafond ${PLAFOND_IMPORTS_MODULE_DANS_APP}). ` +
        "Si tu viens d'en extraire, abaisse le plafond dans ce fichier.",
    ).toBeLessThanOrEqual(PLAFOND_IMPORTS_MODULE_DANS_APP);
  });
});
