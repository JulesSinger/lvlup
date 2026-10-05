import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CLIENT_NAME_MAX,
  CLIENT_TRADES,
  NOTE_TEXT_MAX,
  PROJECT_STATUSES,
  PROJECT_TITLE_MAX,
  TASK_TITLE_MAX,
  WORKSTREAM_TITLE_MAX,
} from './types';

/**
 * Le type TypeScript et la contrainte Postgres doivent dire la même chose —
 * convention imposée par CLAUDE.md §5 (voir `modules/objectifs/lib/schema.test.ts`
 * pour l'incident qui l'a fait naître). Tous les fichiers SQL sont lus, la
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

describe('le type et la base disent la même chose (Projets)', () => {
  it('les statuts d’un projet', () => {
    expect(allowedBy('projets_projects_status_check')).toEqual([...PROJECT_STATUSES].sort());
  });

  it('les métiers d’un client', () => {
    expect(allowedBy('projets_clients_trade_check')).toEqual([...CLIENT_TRADES].sort());
  });

  it('les longueurs maximales', () => {
    expect(lastDefinition('projets_clients_name_check')).toContain(`between 1 and ${CLIENT_NAME_MAX}`);
    expect(lastDefinition('projets_projects_title_check')).toContain(`between 1 and ${PROJECT_TITLE_MAX}`);
    expect(lastDefinition('projets_workstreams_title_check')).toContain(`between 1 and ${WORKSTREAM_TITLE_MAX}`);
    expect(lastDefinition('projets_tasks_title_check')).toContain(`between 1 and ${TASK_TITLE_MAX}`);
    expect(lastDefinition('projets_notes_text_check')).toContain(`between 1 and ${NOTE_TEXT_MAX}`);
  });

  it('chaque table du module a ses quatre politiques', () => {
    const sql = readFileSync(join(SQL_DIR, '2026-10-05-projets-tables.sql'), 'utf8');
    for (const table of ['projets_clients', 'projets_projects', 'projets_workstreams', 'projets_tasks', 'projets_notes']) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      for (const verb of ['select', 'insert', 'update', 'delete']) expect(sql).toContain(`create policy "${table}_${verb}_own"`);
    }
  });
});
