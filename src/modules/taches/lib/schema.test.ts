import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FREQUENCIES } from '../../../core/lib/recurrence';
import { LIST_COLORS, PRIORITIES, REPEAT_FROM } from './types';

/**
 * Le type TypeScript et la contrainte Postgres doivent dire la même chose —
 * convention imposée par CLAUDE.md §5 (voir `modules/objectifs/lib/schema.test.ts`
 * pour l'incident qui l'a fait naître). Tous les fichiers SQL sont lus, la
 * DERNIÈRE définition d'une contrainte fait foi.
 */

const SQL_DIR = new URL('../../../../supabase', import.meta.url).pathname;

/** Les valeurs autorisées par la dernière définition de la contrainte : la liste de `in (…)` ou de `any (array[…])`. */
function allowedBy(constraint: string): string[] | null {
  const pattern = new RegExp(`constraint\\s+${constraint}\\s+check\\s*\\(([\\s\\S]*?)\\)\\s*(?:,|\\n\\s*\\))`, 'gi');
  let last: string | null = null;
  const files = readdirSync(SQL_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  for (const name of files) {
    for (const match of readFileSync(join(SQL_DIR, name), 'utf8').matchAll(pattern)) last = match[1];
  }
  if (last === null) return null;
  const list = /array\[([^\]]*)\]/i.exec(last)?.[1] ?? /\bin\s*\(([^)]*)\)/i.exec(last)?.[1] ?? '';
  return [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
}

describe('le type et la base disent la même chose (Polaris)', () => {
  it('les couleurs d’une liste', () => {
    expect(allowedBy('taches_lists_color_check')).toEqual([...LIST_COLORS].sort());
  });

  it('les priorités', () => {
    expect(allowedBy('taches_tasks_priority_check')).toEqual([...PRIORITIES].sort());
  });

  it('d’où repart une tâche répétée', () => {
    expect(allowedBy('taches_tasks_repeat_from_check')).toEqual([...REPEAT_FROM].sort());
  });

  it('les fréquences de récurrence, celles du moteur commun', () => {
    expect(allowedBy('taches_tasks_freq_check')).toEqual([...FREQUENCIES].sort());
  });
});
