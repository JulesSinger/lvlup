import { describe, expect, it } from 'vitest';
import { buildImportPreview } from './boursobankImport';
import { isModuleEntry, matchModuleEntries } from './moduleMatch';
import type { BudgetEntry } from './types';

const entry = (id: string, day: string, amountCents: number, importKey: string | null): BudgetEntry => ({
  id,
  day,
  label: 'Courses — Lidl',
  amountCents,
  categoryId: null,
  source: 'manuelle',
  importKey,
  note: '',
  createdAt: '',
});
const row = (importKey: string, day: string, amountCents: number) => ({
  importKey,
  day,
  amountCents,
  rawLabel: 'CB LIDL 1234',
  displayLabel: 'Lidl',
  category: '',
  categoryParent: '',
  occurrence: 1,
});

describe('reconnaître un paiement déjà enregistré par un module', () => {
  it('une écriture de module porte une référence, pas une empreinte bancaire', () => {
    expect(isModuleEntry(entry('a', '2026-10-12', -5420, 'comete:course:12'))).toBe(true);
    expect(isModuleEntry(entry('b', '2026-10-12', -5420, 'projets:paiement:3'))).toBe(true);
    expect(isModuleEntry(entry('c', '2026-10-12', -5420, '2026-10-12\u001fCB LIDL\u001f-5420\u001f1'))).toBe(false);
    expect(isModuleEntry(entry('d', '2026-10-12', -5420, null))).toBe(false);
  });

  it('même montant au centime, de deux jours avant à cinq jours après', () => {
    const course = entry('c12', '2026-10-12', -5420, 'comete:course:12');
    expect(matchModuleEntries([row('r1', '2026-10-14', -5420)], [course]).get('r1')?.entry.id).toBe('c12');
    expect(matchModuleEntries([row('r1', '2026-10-17', -5420)], [course]).size).toBe(1);
    expect(matchModuleEntries([row('r1', '2026-10-18', -5420)], [course]).size).toBe(0);
    expect(matchModuleEntries([row('r1', '2026-10-09', -5420)], [course]).size).toBe(0);
    expect(matchModuleEntries([row('r1', '2026-10-13', -5421)], [course]).size).toBe(0);
    expect(matchModuleEntries([row('r1', '2026-10-13', -5420)], [entry('m', '2026-10-12', -5420, null)]).size).toBe(0);
  });

  it('une écriture ne sert qu’une fois, à la ligne la plus proche', () => {
    const course = entry('c12', '2026-10-12', -3000, 'comete:course:12');
    const matches = matchModuleEntries([row('r1', '2026-10-15', -3000), row('r2', '2026-10-13', -3000)], [course]);
    expect([...matches.keys()]).toEqual(['r2']);
  });

  it('l’aperçu de l’import les met à part, sans les importer', () => {
    const rows = [row('r1', '2026-10-13', -5420), row('r2', '2026-10-13', -1250)];
    const preview = buildImportPreview(rows, new Set(), [], [], [entry('c12', '2026-10-12', -5420, 'comete:course:12')]);
    expect(preview.dejaParModule.map((d) => d.row.importKey)).toEqual(['r1']);
    expect(preview.nouvelles.map((n) => n.row.importKey)).toEqual(['r2']);
  });
});
