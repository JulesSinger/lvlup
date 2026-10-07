import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  PLAN_STATUSES,
  PLAN_TITLE_MAX,
  RUN_KINDS,
  RUN_SOURCES,
  RUN_TITLE_MAX,
  SESSION_KINDS,
  SESSION_TITLE_MAX,
  SESSIONS_PER_WEEK_MAX,
  SESSIONS_PER_WEEK_MIN,
} from './types';

/**
 * Le type TypeScript et la contrainte Postgres doivent dire la même chose —
 * convention imposée par CLAUDE.md §5. Tous les fichiers SQL sont lus, la
 * DERNIÈRE définition d'une contrainte fait foi.
 */

const SQL_DIR = new URL('../../../../supabase', import.meta.url).pathname;

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

describe('le type et la base disent la même chose (Sport)', () => {
  it('les sortes de sortie et de séance', () => {
    expect(allowedBy('sport_runs_kind_check')).toEqual([...RUN_KINDS].sort());
    expect(allowedBy('sport_plan_sessions_kind_check')).toEqual([...SESSION_KINDS].sort());
  });

  it('les sources d’une sortie et les états d’un plan', () => {
    expect(allowedBy('sport_runs_source_check')).toEqual([...RUN_SOURCES].sort());
    expect(allowedBy('sport_plans_status_check')).toEqual([...PLAN_STATUSES].sort());
  });

  it('les longueurs et les bornes', () => {
    expect(lastDefinition('sport_runs_title_check')).toContain(`<= ${RUN_TITLE_MAX}`);
    expect(lastDefinition('sport_plans_title_check')).toContain(`between 1 and ${PLAN_TITLE_MAX}`);
    expect(lastDefinition('sport_plan_sessions_title_check')).toContain(`between 1 and ${SESSION_TITLE_MAX}`);
    expect(lastDefinition('sport_plans_sessions_check')).toContain(
      `between ${SESSIONS_PER_WEEK_MIN} and ${SESSIONS_PER_WEEK_MAX}`,
    );
  });

  it('chaque table du module a ses quatre politiques', () => {
    const sql = readFileSync(join(SQL_DIR, '2026-10-07-sport-tables.sql'), 'utf8');
    for (const table of ['sport_plans', 'sport_plan_sessions', 'sport_runs', 'sport_settings', 'sport_import_tokens']) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      for (const verb of ['select', 'insert', 'update', 'delete']) expect(sql).toContain(`create policy "${table}_${verb}_own"`);
    }
  });

  it('ne range jamais un jeton, seulement son empreinte', () => {
    const sql = readFileSync(join(SQL_DIR, '2026-10-07-sport-tables.sql'), 'utf8');
    const table = /create table if not exists public\.sport_import_tokens \(([\s\S]*?)\n\);/.exec(sql)?.[1] ?? '';
    expect(table).toContain('token_hash');
    expect(table).not.toMatch(/^\s*token\s/m);
  });
});
