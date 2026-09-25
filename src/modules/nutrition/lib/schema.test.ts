import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FOOD_SOURCES, MEALS } from './types';

/**
 * Le type TypeScript et la contrainte Postgres doivent dire la même chose —
 * convention imposée par CLAUDE.md §5, après un vrai incident sur
 * `TIER_KINDS` (voir `modules/objectifs/lib/schema.test.ts` pour le récit
 * complet). Même mécanique que `modules/budget/lib/schema.test.ts` : on lit
 * tous les fichiers SQL et on retient la DERNIÈRE définition d'une
 * contrainte, celle qui décrit l'état réel de la base — prêt pour le jour
 * où une migration élargira l'une des deux listes.
 */

const SQL_DIR = new URL('../../../../supabase', import.meta.url).pathname;

function allowedBy(constraint: string): string[] | null {
  const pattern = new RegExp(`constraint\\s+${constraint}\\s+check\\s*\\([^)]*in\\s*\\(([^)]*)\\)`, 'gis');
  let last: string | null = null;
  const files = readdirSync(SQL_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const name of files) {
    for (const match of readFileSync(join(SQL_DIR, name), 'utf8').matchAll(pattern)) last = match[1];
  }
  if (last === null) return null;
  return [...last.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
}

describe('le type et la base disent la même chose (Cérès)', () => {
  it('les quatre repas sont acceptés par Postgres', () => {
    expect(allowedBy('nutrition_entries_meal_check')).toEqual([...MEALS].sort());
  });

  it("les origines d'un aliment aussi", () => {
    expect(allowedBy('nutrition_foods_source_check')).toEqual([...FOOD_SOURCES].sort());
  });
});
