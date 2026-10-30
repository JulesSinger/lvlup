import { describe, expect, it } from 'vitest';
import { matchRule } from './boursobankImport';
import { ficheProblem, isFiche, knownFor, ruleWithPattern } from './labels';
import { searchEntries } from './search';
import type { BudgetEntry, BudgetRule } from './types';

const rule = (pattern: string, over: Partial<BudgetRule> = {}): BudgetRule => ({
  id: pattern,
  pattern,
  categoryId: null,
  priority: 0,
  label: '',
  description: '',
  ...over,
});

const entry = (label: string, note = ''): BudgetEntry => ({
  id: label,
  day: '2026-10-12',
  label,
  amountCents: -450,
  categoryId: null,
  source: 'import',
  importKey: null,
  note,
  accountId: null,
  createdAt: '',
});

describe('le carnet des libellés', () => {
  const buvette = rule('Comptoir de Sta', { label: 'Buvette ASNL', description: 'Le stade Marcel-Picot, les soirs de match' });

  it('retrouve la fiche d’un libellé, sans casse ni accents', () => {
    expect(knownFor('COMPTOIR DE STA NANCY', [buvette])).toBe(buvette);
    expect(knownFor('Comptoir du centre', [buvette])).toBeNull();
    const accent = rule('Électricité', { label: 'EDF' });
    expect(knownFor('ELECTRICITE DE FRANCE', [accent])).toBe(accent);
  });

  it('une simple règle (sans nom ni description) n’est pas une fiche', () => {
    const simple = rule('LIDL', { categoryId: 'c' });
    expect(isFiche(simple)).toBe(false);
    expect(knownFor('LIDL NANCY', [simple])).toBeNull();
  });

  it('la plus prioritaire, puis la plus précise', () => {
    const large = rule('Vir Inst', { label: 'Un virement' });
    const precise = rule('Vir Inst Aurelien', { label: 'Aurélien, le foot du jeudi' });
    expect(knownFor('Vir Inst Aurelien Lerousseau', [large, precise])).toBe(precise);
    const prioritaire = { ...large, priority: 5 };
    expect(knownFor('Vir Inst Aurelien Lerousseau', [prioritaire, precise])).toBe(prioritaire);
  });

  it('une fiche sans catégorie ne range rien au classement', () => {
    expect(matchRule('COMPTOIR DE STA', [buvette])).toBeNull();
    const rangee = { ...buvette, categoryId: 'sorties' };
    expect(matchRule('COMPTOIR DE STA', [rangee])?.categoryId).toBe('sorties');
  });

  it('la recherche trouve par le nom et la description de la fiche', () => {
    const entries = [entry('Comptoir De Sta'), entry('Lidl'), entry('Vir Inst Laurence Singer', 'ma part du canapé')];
    expect(searchEntries(entries, [], 'asnl', [buvette]).map((e) => e.label)).toEqual(['Comptoir De Sta']);
    expect(searchEntries(entries, [], 'marcel picot', [buvette]).map((e) => e.label)).toEqual(['Comptoir De Sta']);
    expect(searchEntries(entries, [], 'canape').map((e) => e.label)).toEqual(['Vir Inst Laurence Singer']);
  });

  it('un motif ne fait qu’une ligne, et une fiche doit dire quelque chose', () => {
    expect(ruleWithPattern('comptoir de sta', [buvette])).toBe(buvette);
    expect(ficheProblem({ pattern: 'EVA', label: '', description: '', categoryId: null }, [])).toMatch(/ne dit rien/);
    expect(ficheProblem({ pattern: 'EVA', label: 'Laser game', description: '', categoryId: null }, [])).toBeNull();
    expect(ficheProblem({ pattern: 'Comptoir de sta', label: 'x', description: '', categoryId: null }, [buvette])).toMatch(/existe déjà/);
    expect(ficheProblem({ pattern: 'EVA', label: 'x'.repeat(61), description: '', categoryId: null }, [])).toMatch(/trop long/);
  });
});
