import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  INGREDIENTS_MAX,
  MEALS,
  MINUTES_MAX,
  PLAN_TITLE_MAX,
  RECIPE_CATEGORIES,
  RECIPE_TITLE_MAX,
  SERVINGS_MAX,
  STEPS_MAX,
  TAGS_MAX,
} from './types';

/**
 * Le type TypeScript et la contrainte Postgres doivent dire la même chose —
 * convention imposée par CLAUDE.md §5. Tous les fichiers SQL sont lus, la
 * DERNIÈRE définition d'une contrainte fait foi.
 */

const SQL_DIR = new URL('../../../../supabase', import.meta.url).pathname;
const TABLES_SQL = '2026-10-08-recettes-tables.sql';

function lastDefinition(constraint: string): string | null {
  const pattern = new RegExp(`constraint\\s+${constraint}\\s+check\\s*\\(([\\s\\S]*?)\\)\\s*(?:,|\\n\\s*\\))`, 'gi');
  let last: string | null = null;
  for (const name of readdirSync(SQL_DIR).filter((f) => f.endsWith('.sql')).sort()) {
    for (const match of readFileSync(join(SQL_DIR, name), 'utf8').matchAll(pattern)) last = match[1];
  }
  return last;
}

/** Les valeurs autorisées par la contrainte : la liste de `in (…)`. */
function allowedBy(constraint: string): string[] | null {
  const def = lastDefinition(constraint);
  if (def === null) return null;
  const list = /\bin\s*\(([^)]*)\)/i.exec(def)?.[1] ?? '';
  return [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
}

describe('le type et la base disent la même chose (Recettes)', () => {
  it('les catégories et les repas', () => {
    expect(allowedBy('recettes_recipes_category_check')).toEqual([...RECIPE_CATEGORIES].sort());
    expect(allowedBy('recettes_plan_meal_check')).toEqual([...MEALS].sort());
  });

  it('les longueurs et les bornes', () => {
    expect(lastDefinition('recettes_recipes_title_check')).toContain(`between 1 and ${RECIPE_TITLE_MAX}`);
    expect(lastDefinition('recettes_recipes_servings_check')).toContain(`between 1 and ${SERVINGS_MAX}`);
    for (const c of ['prep', 'cook', 'rest']) expect(lastDefinition(`recettes_recipes_${c}_check`)).toContain(`between 0 and ${MINUTES_MAX}`);
    expect(lastDefinition('recettes_recipes_tags_check')).toContain(`<= ${TAGS_MAX}`);
    expect(lastDefinition('recettes_recipes_ingredients_check')).toContain(`<= ${INGREDIENTS_MAX}`);
    expect(lastDefinition('recettes_recipes_steps_check')).toContain(`<= ${STEPS_MAX}`);
    expect(lastDefinition('recettes_plan_title_check')).toContain(`<= ${PLAN_TITLE_MAX}`);
    expect(lastDefinition('recettes_cooked_rating_check')).toContain('between 1 and 5');
  });

  it('chaque table du module a ses quatre politiques', () => {
    const sql = readFileSync(join(SQL_DIR, TABLES_SQL), 'utf8');
    for (const table of ['recettes_recipes', 'recettes_photos', 'recettes_cooked', 'recettes_plan', 'recettes_settings']) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      for (const verb of ['select', 'insert', 'update', 'delete']) expect(sql).toContain(`create policy "${table}_${verb}_own"`);
    }
  });

  it('le bucket des photos est privé, et chaque compte n’y touche qu’à son dossier', () => {
    const sql = readFileSync(join(SQL_DIR, TABLES_SQL), 'utf8');
    expect(sql).toMatch(/values \('recettes', 'recettes', false,/);
    for (const verb of ['select', 'insert', 'update', 'delete']) expect(sql).toContain(`create policy "recettes_objects_${verb}_own"`);
  });

  it('une seule photo par recette', () => {
    expect(readFileSync(join(SQL_DIR, TABLES_SQL), 'utf8')).toContain('constraint recettes_photos_one_per_recipe unique (recipe_id)');
  });
});
