import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUDGET_CATEGORY_KINDS, BUDGET_ENTRY_SOURCES } from './types';

/**
 * Le type TypeScript et la contrainte Postgres doivent dire la même chose —
 * convention imposée par CLAUDE.md §5, après un vrai incident sur
 * `TIER_KINDS` (voir `modules/objectifs/lib/schema.test.ts` pour le récit
 * complet : le code compilait, les tests passaient, et Postgres refusait
 * silencieusement toute création concernée).
 *
 * Astra a maintenant deux migrations (2026-08-23-budget-tables.sql pose
 * `budget_categories_kind_check`, 2026-08-25-budget-envelopes.sql l'élargit
 * pour `epargne`) : ce test lit TOUS les fichiers SQL et retient la
 * DERNIÈRE définition d'une contrainte donnée — c'est elle qui décrit
 * l'état réel de la base, exactement comme `modules/objectifs/lib/schema.test.ts`.
 */

const SQL_DIR = new URL('../../../../supabase', import.meta.url).pathname;

/** Contenu de tous les fichiers SQL, dans l'ordre où on les exécute. */
function sqlFiles(): { name: string; body: string }[] {
  return readdirSync(SQL_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort() // schema.sql puis les migrations datées : l'ordre alphabétique suffit
    .map((name) => ({ name, body: readFileSync(join(SQL_DIR, name), 'utf8') }));
}

/**
 * Valeurs autorisées par la DERNIÈRE définition d'une contrainte donnée,
 * qu'elle vienne d'un `create table (... constraint X check (...))` initial
 * ou d'un `alter table ... add constraint X check (...)` qui l'élargit.
 */
function allowedBy(constraint: string): string[] | null {
  const pattern = new RegExp(`constraint\\s+${constraint}\\s+check\\s*\\([^)]*in\\s*\\(([^)]*)\\)`, 'gis');
  let last: string | null = null;
  for (const { body } of sqlFiles()) {
    for (const match of body.matchAll(pattern)) last = match[1];
  }
  if (last === null) return null;
  return [...last.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
}

describe('le type et la base disent la même chose (Astra)', () => {
  it('les cinq natures de catégorie sont acceptées par Postgres', () => {
    expect(allowedBy('budget_categories_kind_check')).toEqual([...BUDGET_CATEGORY_KINDS].sort());
  });

  it("les origines d'une écriture aussi", () => {
    expect(allowedBy('budget_entries_source_check')).toEqual([...BUDGET_ENTRY_SOURCES].sort());
  });
});

describe('hygiène des migrations (Astra)', () => {
  it('toute contrainte CHECK élargie est retirée avant d’être reposée', () => {
    // `add constraint … check` sans `drop constraint if exists` juste avant
    // échoue au rejeu — or une migration doit pouvoir être relancée sans
    // casse (CLAUDE.md §5 : « les scripts sont idempotents »).
    for (const { name, body } of sqlFiles()) {
      for (const match of body.matchAll(/alter\s+table[^;]*?add\s+constraint\s+(\w+)\s+check/gis)) {
        const constraint = match[1];
        expect(
          new RegExp(`drop\\s+constraint\\s+if\\s+exists\\s+${constraint}`, 'is').test(body),
          `${name} : ${constraint} reposée sans être retirée d'abord`,
        ).toBe(true);
      }
    }
  });
});
