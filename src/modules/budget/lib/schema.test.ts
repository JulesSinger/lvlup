import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BUDGET_CATEGORY_KINDS, BUDGET_ENTRY_SOURCES } from './types';

/**
 * Le type TypeScript et la contrainte Postgres doivent dire la même chose —
 * convention imposée par CLAUDE.md §5, après un vrai incident sur
 * `TIER_KINDS` (voir `modules/objectifs/lib/schema.test.ts` pour le récit
 * complet : le code compilait, les tests passaient, et Postgres refusait
 * silencieusement toute création concernée).
 *
 * Astra n'a qu'une seule migration à ce stade : pas besoin du mécanisme
 * « dernière définition fait foi » qu'utilise `tiers`, qui a été élargi
 * plusieurs fois.
 */

const MIGRATION = new URL('../../../../supabase/2026-08-23-budget-tables.sql', import.meta.url)
  .pathname;

function allowedBy(constraint: string): string[] {
  const body = readFileSync(MIGRATION, 'utf8');
  const pattern = new RegExp(`${constraint}\\s+check\\s*\\([^)]*in\\s*\\(([^)]*)\\)`, 'is');
  const match = pattern.exec(body);
  if (!match) throw new Error(`Contrainte ${constraint} introuvable dans ${MIGRATION}`);
  return [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]).sort();
}

describe('le type et la base disent la même chose (Astra)', () => {
  it('les natures de catégorie sont acceptées par Postgres', () => {
    expect(allowedBy('budget_categories_kind_check')).toEqual([...BUDGET_CATEGORY_KINDS].sort());
  });

  it("les origines d'une écriture aussi", () => {
    expect(allowedBy('budget_entries_source_check')).toEqual([...BUDGET_ENTRY_SOURCES].sort());
  });
});
