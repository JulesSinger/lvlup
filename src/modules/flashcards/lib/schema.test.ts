import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BOX_COUNT } from './types';

/**
 * Le type TypeScript et la contrainte Postgres doivent dire la même chose —
 * convention imposée par CLAUDE.md §5, après un vrai incident sur
 * `TIER_KINDS` (voir `modules/objectifs/lib/schema.test.ts` pour le récit
 * complet). Ici la contrainte est un intervalle numérique plutôt qu'une
 * énumération de chaînes, mais le principe est le même : une seule source
 * ne doit jamais diverger silencieusement de l'autre.
 */

const CARDS_MIGRATION = new URL('../../../../supabase/2026-08-30-flashcards-tables.sql', import.meta.url)
  .pathname;
const REVIEWS_MIGRATION = new URL(
  '../../../../supabase/2026-08-30-flashcards-reviews.sql',
  import.meta.url,
).pathname;

function boxBound(file: string, constraint: string, column: string): number {
  const body = readFileSync(file, 'utf8');
  const pattern = new RegExp(`${constraint}\\s+check\\s*\\(${column} between 1 and (\\d+)\\)`, 'is');
  const match = pattern.exec(body);
  if (!match) throw new Error(`Contrainte ${constraint} introuvable dans ${file}`);
  return Number(match[1]);
}

describe('le type et la base disent la même chose (Orbite)', () => {
  it('le nombre de boîtes accepté par Postgres correspond à BOX_COUNT (cartes)', () => {
    expect(boxBound(CARDS_MIGRATION, 'flashcards_cards_box_check', 'box')).toBe(BOX_COUNT);
  });

  it('le nombre de boîtes accepté par Postgres correspond à BOX_COUNT (journal des révisions)', () => {
    expect(boxBound(REVIEWS_MIGRATION, 'flashcards_reviews_box_after_check', 'box_after')).toBe(
      BOX_COUNT,
    );
  });
});
