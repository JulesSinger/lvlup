import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ITEM_LABEL_MAX, LIST_DESCRIPTION_MAX, LIST_TITLE_MAX, TIER_COLORS, TIER_LABEL_MAX } from './types';

/**
 * Le type TypeScript et la contrainte Postgres doivent dire la même chose —
 * convention imposée par CLAUDE.md §5. La DERNIÈRE définition d'une contrainte fait foi.
 */
const SQL_DIR = new URL('../../../../supabase', import.meta.url).pathname;
const TABLES_SQL = '2026-11-10-tierlists-tables.sql';

function lastDefinition(constraint: string): string | null {
  const pattern = new RegExp(`constraint\\s+${constraint}\\s+check\\s*\\(([\\s\\S]*?)\\)\\s*(?:,|\\n\\s*\\))`, 'gi');
  let last: string | null = null;
  for (const name of readdirSync(SQL_DIR).filter((f) => f.endsWith('.sql')).sort()) {
    for (const match of readFileSync(join(SQL_DIR, name), 'utf8').matchAll(pattern)) last = match[1];
  }
  return last;
}

describe('le type et la base disent la même chose (Tier lists)', () => {
  it('les couleurs des rangées', () => {
    const list = /\bin\s*\(([^)]*)\)/i.exec(lastDefinition('tierlists_tiers_color_check') ?? '')?.[1] ?? '';
    expect([...list.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort()).toEqual([...TIER_COLORS].sort());
  });

  it('les longueurs', () => {
    expect(lastDefinition('tierlists_lists_title_check')).toContain(`between 1 and ${LIST_TITLE_MAX}`);
    expect(lastDefinition('tierlists_lists_description_check')).toContain(`<= ${LIST_DESCRIPTION_MAX}`);
    expect(lastDefinition('tierlists_tiers_label_check')).toContain(`between 1 and ${TIER_LABEL_MAX}`);
    expect(lastDefinition('tierlists_items_label_check')).toContain(`<= ${ITEM_LABEL_MAX}`);
  });

  it('chaque table a ses quatre politiques et la double authentification, le bucket est privé', () => {
    const sql = readFileSync(join(SQL_DIR, TABLES_SQL), 'utf8');
    for (const table of ['tierlists_lists', 'tierlists_tiers', 'tierlists_items']) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      for (const verb of ['select', 'insert', 'update', 'delete']) expect(sql).toContain(`create policy "${table}_${verb}_own"`);
      expect(sql).toContain(`create policy "${table}_mfa"`);
    }
    expect(sql).toMatch(/values \('tierlists', 'tierlists', false,/);
    for (const verb of ['select', 'insert', 'update', 'delete']) expect(sql).toContain(`create policy "tierlists_objects_${verb}_own"`);
  });

  it('les couleurs sont celles de la palette du socle', () => {
    const css = readFileSync(new URL('../../../core/styles/base.css', import.meta.url).pathname, 'utf8');
    for (const color of TIER_COLORS) expect(css).toContain(`--${color}:`);
  });
});
