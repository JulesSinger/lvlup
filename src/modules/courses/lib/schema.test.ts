import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FOOD_KINDS, TYPOLOGIES } from './typology';
import { AISLES } from './types';

/**
 * Le type TypeScript et la contrainte Postgres doivent dire la même chose —
 * convention imposée par CLAUDE.md §5, après un vrai incident sur
 * `TIER_KINDS` (voir `modules/objectifs/lib/schema.test.ts`). Même mécanique
 * que Cérès et Astra : tous les fichiers SQL sont lus, la DERNIÈRE
 * définition d'une contrainte fait foi.
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

describe('le type et la base disent la même chose (Comète)', () => {
  it('les rayons du catalogue sont ceux acceptés par Postgres', () => {
    expect(allowedBy('courses_items_aisle_check')).toEqual([...AISLES].sort());
  });

  it('… et ceux de l’historique aussi', () => {
    expect(allowedBy('courses_trip_items_aisle_check')).toEqual([...AISLES].sort());
  });

  it('les typologies et les sous-types aussi, au catalogue comme dans l’historique', () => {
    for (const table of ['courses_items', 'courses_trip_items']) {
      expect(allowedBy(`${table}_typology_check`)).toEqual([...TYPOLOGIES].sort());
      expect(allowedBy(`${table}_food_kind_check`)).toEqual([...FOOD_KINDS].sort());
    }
  });
});
