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

  it('les modèles de liste (§20) : RLS, double authentification, et les bornes de la liste', () => {
    const sql = readFileSync(join(SQL_DIR, '2026-11-28-courses-templates.sql'), 'utf8');
    for (const table of ['courses_templates', 'courses_template_lines']) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      for (const verb of ['select', 'insert', 'update', 'delete']) expect(sql).toContain(`create policy "${table}_${verb}_own"`);
      expect(sql).toContain(`create policy "${table}_mfa"`);
    }
    // Une ligne d'un modèle devient une ligne de la liste : mêmes bornes (`lib/listMerge.ts`).
    expect(sql).toMatch(/courses_template_lines_quantity_check\s+check \(char_length\(quantity\) <= 30\)/);
    expect(sql).toMatch(/courses_template_lines_note_check\s+check \(char_length\(note\) <= 200\)/);
    expect(sql).toContain('references public.courses_items (id) on delete cascade');
  });
});

