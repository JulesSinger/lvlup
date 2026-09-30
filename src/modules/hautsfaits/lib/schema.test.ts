import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DATE_PRECISIONS, FEAT_CATEGORIES, FEAT_TITLE_MAX } from './types';

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

describe('le type et la base disent la même chose (Hauts faits)', () => {
  it('les catégories', () => {
    expect(allowedBy('hautsfaits_feats_category_check')).toEqual([...FEAT_CATEGORIES].sort());
  });

  it('la précision d’une date, au début comme à la fin', () => {
    expect(allowedBy('hautsfaits_feats_precision_check')).toEqual([...DATE_PRECISIONS].sort());
    expect(allowedBy('hautsfaits_feats_end_precision_check')).toEqual([...DATE_PRECISIONS].sort());
  });

  it('la longueur maximale d’un titre', () => {
    expect(lastDefinition('hautsfaits_feats_title_check')).toContain(`between 1 and ${FEAT_TITLE_MAX}`);
  });
});
