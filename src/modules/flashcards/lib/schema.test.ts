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

const MIGRATION = new URL('../../../../supabase/2026-08-30-flashcards-tables.sql', import.meta.url)
  .pathname;

describe('le type et la base disent la même chose (Orbite)', () => {
  it('le nombre de boîtes accepté par Postgres correspond à BOX_COUNT', () => {
    const body = readFileSync(MIGRATION, 'utf8');
    const match = /flashcards_cards_box_check\s+check\s*\(box between 1 and (\d+)\)/is.exec(body);
    if (!match) throw new Error(`Contrainte flashcards_cards_box_check introuvable dans ${MIGRATION}`);
    expect(Number(match[1])).toBe(BOX_COUNT);
  });
});
