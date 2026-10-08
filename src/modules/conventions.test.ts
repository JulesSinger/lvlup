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
  /** Ses classes datent d'avant la règle de préfixe (`.goal-`, `.heat-`, `.tier-`…). */
  sansPrefixeCSS: ['objectifs'],
};

/**
 * Plafond de couplage d'`App.tsx`.
 *
 * Objectif atteint le 2026-09-16 : `Landing` (l'écran public) est remontée
 * dans `core/components/`, dernier import de module que la coquille gardait
 * depuis la coquille du hub (2026-08-09). Ce plafond empêche la situation de
 * régresser : un agent peut réduire ce nombre, jamais l'augmenter.
 */
const PLAFOND_IMPORTS_MODULE_DANS_APP = 0;

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
      expect(existsSync(join(dir, 'e2e'))).toBe(true);
    });

    it('met son nom en haut avec ModuleBrand, la porte vers les autres modules', () => {
      // Depuis le 30/09/2026, sur téléphone, toucher le nom du module en haut
      // est le seul chemin vers un autre module (la barre d'icônes n'y a pas
      // la place). Un écran qui écrirait sa marque à la main enfermerait
      // l'utilisateur dans le module.
      const ecrans = fichiers(dir).filter((f) => f.endsWith('.tsx') && lire(f).includes('ModuleScreenProps'));
      expect(ecrans.length, `aucun écran de module (ModuleScreenProps) dans ${id}`).toBeGreaterThan(0);
      expect(ecrans.some((f) => /<ModuleBrand\b[^>]*onSwitchModule=\{onSwitchModule\}/.test(lire(f)))).toBe(true);
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

/**
 * Mode clair et sombre (2026-09-29).
 *
 * Une couleur écrite en dur dans une feuille de style ne suit pas le thème :
 * c'est ainsi qu'un voile blanc devient invisible sur fond clair, ou qu'un
 * rouge pastel devient illisible. Toute couleur passe donc par une variable
 * de `core/styles/base.css`, le seul fichier qui en écrit — éventuellement
 * mêlée à une autre par `color-mix()`.
 *
 * Les couleurs dans le code TypeScript restent permises : ce sont des
 * couleurs d'identité (catégories choisies, rangs, couleur d'un module ou
 * d'un calque), les mêmes dans les deux thèmes. Quand l'une d'elles sert de
 * texte, on la fonce en clair avec `--ink-mix`.
 */
describe('thèmes clair et sombre', () => {
  const BASE_CSS = join(SRC, 'core', 'styles', 'base.css');
  const COULEUR_EN_DUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(|(?<![\w-])(?:white|black)(?![\w-])/;

  it("aucune feuille de style n'écrit de couleur en dur, hors base.css", () => {
    const fautes: string[] = [];
    for (const f of fichiers(SRC, ['.css'])) {
      if (f === BASE_CSS) continue;
      const texte = lire(f).replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '));
      // Chaque bloc de déclarations le plus intérieur, puis chaque valeur, même
      // écrite sur plusieurs lignes. Les sélecteurs sont hors des accolades :
      // un `#id` n'est pas une couleur.
      for (const bloc of texte.matchAll(/\{([^{}]*)\}/g)) {
        let debut = (bloc.index ?? 0) + 1;
        for (const declaration of bloc[1].split(';')) {
          const valeur = declaration.slice(declaration.indexOf(':') + 1);
          if (declaration.includes(':') && COULEUR_EN_DUR.test(valeur)) {
            const ligne = texte.slice(0, debut).split('\n').length;
            fautes.push(`${f.replace(SRC, 'src/')}:${ligne}  ${declaration.trim().replace(/\s+/g, ' ')}`);
          }
          debut += declaration.length + 1;
        }
      }
    }
    expect(fautes, 'Prends une variable de core/styles/base.css (au besoin avec color-mix) :\n' + fautes.join('\n')).toEqual([]);
  });

  it('chaque couleur du thème sombre a sa valeur en clair', () => {
    const css = lire(BASE_CSS);
    const bloc = (debut: string) => {
      const i = css.indexOf(debut);
      expect(i, `bloc introuvable : ${debut}`).toBeGreaterThanOrEqual(0);
      return css.slice(i, css.indexOf('}', i));
    };
    const noms = (texte: string) => new Set([...texte.matchAll(/^\s*(--[\w-]+):/gm)].map((m) => m[1]));
    const sombre = noms(bloc(":root,\n[data-theme='dark'] {"));
    const clair = noms(bloc("[data-theme='light'] {"));
    // Les rayons ne sont pas des couleurs : ils ne changent pas avec le thème.
    const manquantes = [...sombre].filter((n) => !clair.has(n) && !n.startsWith('--radius'));
    expect(manquantes, 'variables sans valeur en clair').toEqual([]);
    expect([...clair].filter((n) => !sombre.has(n)), 'variables sans valeur en sombre').toEqual([]);
  });
});

/**
 * Supabase ne rend jamais plus de 1 000 lignes par lecture, **sans prévenir**
 * (constat du 2026-10-07 sur le budget). Toute lecture d'une table entière
 * passe donc par `fetchAll` (`core/data/supabaseClient.ts`), qui lit par
 * paquets. Seules restent permises les lectures d'une ligne (`single`,
 * `maybeSingle`, par `id`), celles qui écrivent (`insert`… `.select()`),
 * comptent, ou se limitent aux lignes d'un seul parent (`feat_id`,
 * `recipe_id`, `project_id`, `action_id`, `ref`, `in(…)`).
 */
describe('lectures par paquets', () => {
  const allowed = /\.(single|maybeSingle|range|limit|in|insert|upsert|update|delete)\(|count:|\.eq\('(id|feat_id|recipe_id|project_id|action_id|ref)'/;

  for (const id of ids) {
    const dataDir = join(MODULES_DIR, id, 'data');
    const files = existsSync(dataDir) ? readdirSync(dataDir).filter((f) => /^supabase.*\.ts$/.test(f) && !f.endsWith('.test.ts')) : [];
    for (const file of files) {
      it(`${id}/${file} ne lit jamais une table entière d'un seul coup`, () => {
        const source = readFileSync(join(dataDir, file), 'utf8');
        const offenders: string[] = [];
        for (const m of source.matchAll(/unwrap\(\s*await this\.client\s*\.from\('([a-z_]+)'\)/g)) {
          // La chaîne jusqu'à la fin de l'appel à `unwrap(`.
          let depth = 0;
          let end = m.index!;
          for (let k = m.index! + 'unwrap'.length; k < source.length; k++) {
            if (source[k] === '(') depth++;
            else if (source[k] === ')' && --depth === 0) {
              end = k;
              break;
            }
          }
          const chain = source.slice(m.index!, end);
          if (chain.includes('.select(') && !allowed.test(chain)) offenders.push(m[1]);
        }
        expect(offenders, 'lire par fetchAll (core/data/supabaseClient.ts)').toEqual([]);
      });
    }
  }
});
