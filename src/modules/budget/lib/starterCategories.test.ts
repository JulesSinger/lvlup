import { describe, expect, it } from 'vitest';
import { STARTER_CATEGORIES } from './starterCategories';
import { BUDGET_CATEGORY_KINDS } from './types';

describe('STARTER_CATEGORIES', () => {
  it("couvre les quatre natures, avec « transfert » présente pour épargner sans fausser le camembert", () => {
    const kinds = new Set(STARTER_CATEGORIES.map((c) => c.kind));
    expect(kinds).toEqual(new Set(BUDGET_CATEGORY_KINDS));
  });

  it('chaque catégorie a un nom, un emoji et une couleur', () => {
    for (const category of STARTER_CATEGORIES) {
      expect(category.name.trim().length).toBeGreaterThan(0);
      expect(category.emoji).toBeTruthy();
      expect(category.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('aucun nom en double (les catégories doivent rester lisibles au tri)', () => {
    const names = STARTER_CATEGORIES.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("chaque nature déclarée est acceptée par le type (donc par la base, voir schema.test.ts)", () => {
    for (const category of STARTER_CATEGORIES) {
      expect(BUDGET_CATEGORY_KINDS).toContain(category.kind);
    }
  });
});
