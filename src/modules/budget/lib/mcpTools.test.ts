import { describe, expect, it } from 'vitest';
import * as server from '../../../../supabase/functions/atlas-mcp/budget.ts';
import { budgetTools, type AccountRow, type BudgetData, type CategoryRow, type EntryRow, type RuleRow } from '../../../../supabase/functions/atlas-mcp/budget.ts';
import { accountBalance, accountList } from './accounts';
import { knownFor } from './labels';
import { matchRule } from './boursobankImport';
import { BUDGET_CATEGORY_KINDS, BUDGET_ENTRY_SOURCES, RULE_DESCRIPTION_MAX, RULE_LABEL_MAX, type BudgetAccount, type BudgetEntry } from './types';

// Les outils de Budget du connecteur (docs/connecteur-claude.md §13) : la fonction ne peut pas
// importer le module, elle en recopie les bornes et la règle — comparées ici.

let n = 0;
const uuid = () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;

function memory() {
  const categories: CategoryRow[] = [];
  const entries: EntryRow[] = [];
  const rules: RuleRow[] = [];
  const accounts: AccountRow[] = [];
  const data: BudgetData = {
    listAccounts: async () => accounts,
    listEntries: async (from, to) => entries.filter((e) => e.day >= from && e.day <= to),
    getEntry: async (id) => entries.find((e) => e.id === id) ?? null,
    insertEntry: async (row) => {
      const e = { id: uuid(), import_key: null, note: '', ...row } as EntryRow;
      entries.push(e);
      return e;
    },
    updateEntry: async (id, row) => {
      const e = entries.find((x) => x.id === id);
      if (!e) return null;
      Object.assign(e, row);
      return e;
    },
    deleteEntry: async (id) => {
      const i = entries.findIndex((e) => e.id === id);
      if (i < 0) return false;
      entries.splice(i, 1);
      return true;
    },
    listCategories: async () => categories,
    listRules: async () => rules,
    insertRule: async (row) => {
      const r = { id: uuid(), ...row } as RuleRow;
      rules.push(r);
      return r;
    },
    updateRule: async (id, row) => {
      const r = rules.find((x) => x.id === id);
      if (!r) return null;
      Object.assign(r, row);
      return r;
    },
    deleteRule: async (id) => {
      const i = rules.findIndex((r) => r.id === id);
      if (i < 0) return false;
      rules.splice(i, 1);
      return true;
    },
  };
  const cat = (name: string, kind: CategoryRow['kind'], parent: string | null = null) => {
    const c: CategoryRow = { id: uuid(), name, emoji: '', kind, parent_id: parent };
    categories.push(c);
    return c;
  };
  const entry = (day: string, label: string, cents: number, category: string | null = null, source: EntryRow['source'] = 'import') => {
    const e: EntryRow = { id: uuid(), day, label, amount_cents: cents, category_id: category, source, import_key: source === 'import' ? `k${n}` : null, note: '' };
    entries.push(e);
    return e;
  };
  const call = async (name: string, args: Record<string, unknown>) => {
    const tool = budgetTools.find((t) => t.name === name)!;
    const result = await tool.run(args, { data, today: '2026-10-13' });
    return JSON.parse(result.text.startsWith('{') ? result.text : JSON.stringify({ text: result.text }));
  };
  return { data, categories, entries, rules, accounts, cat, entry, call };
}

describe('connecteur — Budget', () => {
  it('reprend les bornes du module', () => {
    expect(server.BUDGET_CATEGORY_KINDS).toEqual(BUDGET_CATEGORY_KINDS);
    expect(server.BUDGET_ENTRY_SOURCES).toEqual(BUDGET_ENTRY_SOURCES);
  });

  it('range un libellé comme le module (motif contenu, priorité la plus haute)', () => {
    const rules = [
      { id: 'a', pattern: 'carrefour', category_id: 'c1', priority: 0 },
      { id: 'b', pattern: 'CARREFOUR CITY', category_id: 'c2', priority: 5 },
      { id: 'c', pattern: '  ', category_id: 'c3', priority: 9 },
      // Une fiche du carnet des libellés, sans catégorie : elle ne range rien (30/10/2026).
      { id: 'd', pattern: 'CARREFOUR', category_id: null, priority: 20, label: 'Le Carrefour du coin', description: '' },
    ];
    const asModule = rules.map((r) => ({ id: r.id, pattern: r.pattern, categoryId: r.category_id, priority: r.priority, label: r.label ?? '', description: r.description ?? '' }));
    for (const label of ['CB CARREFOUR CITY 12/10', 'carrefour market', 'PICARD', '']) {
      expect(server.matchRule(label, rules)?.id ?? null).toBe(matchRule(label, asModule)?.id ?? null);
    }
  });

  it('lit un montant en euros positifs', () => {
    expect(server.readAmount('12,50 €')).toBe(1250);
    expect(server.readAmount(3.333)).toBe(333);
    expect(() => server.readAmount(-4)).toThrow();
    expect(() => server.readAmount('abc')).toThrow();
  });

  it('trouve une catégorie par son nom, sans casse ni accents, et demande l’id d’un nom en double', () => {
    const m = memory();
    const resto = m.cat('Restaurants & bars', 'variable');
    m.cat('Bar', 'variable', resto.id);
    m.cat('bar', 'variable');
    expect(server.resolveCategory(m.categories, 'restaurants & BARS')?.id).toBe(resto.id);
    expect(server.resolveCategory(m.categories, null)).toBeNull();
    expect(() => server.resolveCategory(m.categories, 'Bar')).toThrow(/id/);
    expect(() => server.resolveCategory(m.categories, 'Inconnue')).toThrow();
  });

  it('liste les « à classer » puis les classe d’un coup', async () => {
    const m = memory();
    const courses = m.cat('Courses', 'variable');
    const a = m.entry('2026-10-02', 'CB PICARD', -2350);
    const b = m.entry('2026-10-05', 'CB LIDL', -4000);
    m.entry('2026-10-06', 'SALAIRE', 200000, m.cat('Salaire', 'revenu').id);
    m.entry('2026-09-28', 'CB AUCHAN', -1000);
    const list = await m.call('budget_ecritures', { a_classer: true });
    expect(list.entries.map((e: { id: string }) => e.id)).toEqual([b.id, a.id]);
    const res = await m.call('budget_classer', { items: [{ id: a.id, category: 'courses' }, { id: b.id, category: courses.id }] });
    expect(res.message).toMatch(/2 opérations classées/);
    expect(m.entries.filter((e) => e.category_id === courses.id)).toHaveLength(2);
  });

  it('cherche dans une catégorie, sous-catégories comprises', async () => {
    const m = memory();
    const resto = m.cat('Restaurants & bars', 'variable');
    const bar = m.cat('Bar', 'variable', resto.id);
    m.entry('2026-10-03', 'LE PETIT BAR', -800, bar.id);
    m.entry('2026-10-04', 'BRASSERIE', -2500, resto.id);
    m.entry('2026-10-04', 'LIDL', -2500);
    const list = await m.call('budget_ecritures', { category: 'Restaurants & bars' });
    expect(list.total).toBe(2);
    expect(list.entries.find((e: { label: string }) => e.label === 'LE PETIT BAR').category).toBe('Restaurants & bars › Bar');
  });

  it('note une dépense à la main, signée', async () => {
    const m = memory();
    m.cat('Restaurants', 'variable');
    const res = await m.call('budget_ecriture_ajouter', { day: '2026-10-12', label: 'Pizzeria', amount: 42.5, direction: 'depense', category: 'restaurants' });
    expect(res.entry).toMatchObject({ amount: -42.5, category: 'Restaurants', source: 'saisie' });
    expect(m.entries[0].source).toBe('manuelle');
  });

  it('garde le jour et le montant d’une opération du relevé', async () => {
    const m = memory();
    const e = m.entry('2026-10-02', 'CB PICARD', -2350);
    await expect(m.call('budget_ecriture_modifier', { id: e.id, amount: 10 })).rejects.toThrow(/banque/);
    await m.call('budget_ecriture_modifier', { id: e.id, note: 'surgelés' });
    expect(m.entries[0]).toMatchObject({ amount_cents: -2350, note: 'surgelés' });
    const manual = m.entry('2026-10-03', 'Ami', -500, null, 'manuelle');
    await m.call('budget_ecriture_modifier', { id: manual.id, direction: 'entree' });
    expect(manual.amount_cents).toBe(500);
    await m.call('budget_ecriture_modifier', { id: manual.id, amount: 7 });
    expect(manual.amount_cents).toBe(700);
  });

  it('crée une règle et dit quelles « à classer » elle aurait rangées', async () => {
    const m = memory();
    m.cat('Courses', 'variable');
    const a = m.entry('2026-09-20', 'CB PICARD 20/09', -1200);
    m.entry('2026-09-21', 'CB LIDL', -1200);
    m.entry('2026-01-02', 'CB PICARD 02/01', -1200);
    const res = await m.call('budget_regle_creer', { pattern: 'picard', category: 'Courses' });
    expect(res.to_classify_matching.map((e: { id: string }) => e.id)).toEqual([a.id]);
    await expect(m.call('budget_regle_creer', { pattern: 'PICARD', category: 'Courses' })).rejects.toThrow(/existe/);
    await expect(m.call('budget_regle_creer', { pattern: 'cb', category: 'Courses' })).rejects.toThrow(/3 caractères/);
    await m.call('budget_regle_supprimer', { id: res.rule.id });
    expect(m.rules).toHaveLength(0);
  });

  it('résume un mois comme l’Aperçu, avec le mois d’avant', async () => {
    const m = memory();
    const courses = m.cat('Courses', 'variable');
    const epargne = m.cat('Épargne', 'epargne');
    m.entry('2026-10-02', 'LIDL', -4000, courses.id);
    m.entry('2026-10-03', 'REMBOURSEMENT', 1000, courses.id);
    m.entry('2026-10-04', 'LIVRET', -50000, epargne.id);
    m.entry('2026-09-10', 'LIDL', -2000, courses.id);
    const res = await m.call('budget_mois', {});
    expect(res).toMatchObject({ month: '2026-10', spent: 30, income: 0, previous_month: { month: '2026-09', spent: 20 } });
  });

  it('supprime une opération', async () => {
    const m = memory();
    const e = m.entry('2026-10-02', 'Doublon', -100, null, 'manuelle');
    const res = await m.call('budget_ecriture_supprimer', { id: e.id });
    expect(res.text).toMatch(/supprimée/);
    expect(m.entries).toHaveLength(0);
  });

  it('les comptes : une capture de Pluxee notée sur son compte, et le solde comme dans l’app', async () => {
    const m = memory();
    m.cat('Restaurants', 'variable');
    m.accounts.push({ id: uuid(), name: 'Pluxee', emoji: '🍽️', is_default: false, balance_cents: 5000, balance_day: '2026-10-10', balance_set_at: '2026-10-10T12:00:00.000Z' });
    const pluxee = m.accounts[0];
    const res = await m.call('budget_ecriture_ajouter', { day: '2026-10-12', label: 'Boulangerie', amount: 8.5, direction: 'depense', category: 'Restaurants', compte: 'pluxee' });
    expect(res.message).toContain('Pluxee');
    expect(res.entry.account).toBe('Pluxee');
    expect(m.entries[0].account_id).toBe(pluxee.id);
    await m.call('budget_ecriture_ajouter', { day: '2026-10-12', label: 'Essence', amount: 60, direction: 'depense' });
    expect(m.entries[1].account_id).toBeUndefined(); // le principal : aucune colonne écrite

    const comptes = await m.call('budget_comptes', {});
    expect(comptes.accounts.map((a: { name: string }) => a.name)).toEqual(['Compte courant', 'Pluxee']);
    expect(comptes.accounts[1].balance).toBe(41.5);

    const seulement = await m.call('budget_ecritures', { month: '2026-10', compte: 'Pluxee' });
    expect(seulement.entries.map((e: { label: string }) => e.label)).toEqual(['Boulangerie']);
    await expect(m.call('budget_ecritures', { month: '2026-10', compte: 'Livret' })).rejects.toThrow(/Aucun compte/);

    // Même solde que l'app, jour même compris (noté avant / après le solde donné).
    const sample: EntryRow[] = [
      { id: 'a', day: '2026-10-10', label: 'x', amount_cents: -700, category_id: null, source: 'manuelle', import_key: null, note: '', account_id: pluxee.id, created_at: '2026-10-10T08:00:00.000Z' },
      { id: 'b', day: '2026-10-10', label: 'x', amount_cents: -900, category_id: null, source: 'manuelle', import_key: null, note: '', account_id: pluxee.id, created_at: '2026-10-10T13:00:00.000Z' },
      { id: 'c', day: '2026-10-11', label: 'x', amount_cents: 12000, category_id: null, source: 'manuelle', import_key: null, note: '', account_id: pluxee.id, created_at: '' },
      { id: 'd', day: '2026-10-11', label: 'x', amount_cents: -5000, category_id: null, source: 'import', import_key: 'k', note: '', account_id: null, created_at: '' },
    ];
    const asModule: BudgetAccount = { id: pluxee.id, name: 'Pluxee', emoji: '🍽️', isDefault: false, balanceCents: 5000, balanceDay: '2026-10-10', balanceSetAt: '2026-10-10T12:00:00.000Z', position: 0 };
    const moduleEntries: BudgetEntry[] = sample.map((e) => ({ id: e.id, day: e.day, label: e.label, amountCents: e.amount_cents, categoryId: null, source: e.source, importKey: e.import_key, note: '', accountId: e.account_id ?? null, createdAt: e.created_at ?? '' }));
    const serverList = server.accountList(m.accounts);
    expect(server.accountBalance(serverList[1], sample, serverList)).toBe(accountBalance(asModule, moduleEntries, accountList([asModule])));
    expect(server.MAIN_NAME).toBe(accountList([])[0].name);
  });

  it('le carnet des libellés : Claude retient ce que cache un libellé, et le retrouve', async () => {
    const m = memory();
    const sorties = m.cat('Sorties & loisirs', 'variable');
    m.entry('2026-10-11', 'Comptoir De Sta', -450);
    m.rules.push({ id: uuid(), pattern: 'Comptoir de Sta', category_id: sorties.id, priority: 10 });

    const res = await m.call('budget_libelle_noter', { pattern: 'COMPTOIR DE STA', nom: 'Buvette ASNL', description: 'Le stade Marcel-Picot' });
    expect(res.message).toMatch(/complétée/);
    expect(m.rules).toHaveLength(1); // le même motif : une seule ligne, sa catégorie gardée
    expect(m.rules[0]).toMatchObject({ category_id: sorties.id, label: 'Buvette ASNL' });

    const found = await m.call('budget_ecritures', { month: '2026-10', query: 'asnl' });
    expect(found.entries).toHaveLength(1);
    expect(found.entries[0].known).toEqual({ name: 'Buvette ASNL', description: 'Le stade Marcel-Picot' });

    // Une fiche sans catégorie, puis une règle sur le même motif : complétée, pas refusée.
    await m.call('budget_libelle_noter', { pattern: 'EVA', nom: 'Laser game' });
    await m.call('budget_regle_creer', { pattern: 'EVA', category: 'Sorties & loisirs' });
    expect(m.rules.filter((r) => r.pattern === 'EVA')).toHaveLength(1);
    await expect(m.call('budget_libelle_noter', { pattern: 'XYZ' })).rejects.toThrow(/nom ou une description/);

    // Même fiche retrouvée que dans l'app.
    const asModule = m.rules.map((r) => ({ id: r.id, pattern: r.pattern, categoryId: r.category_id, priority: r.priority, label: r.label ?? '', description: r.description ?? '' }));
    for (const label of ['Comptoir De Sta', 'EVA (Esports Virtual Arenas)', 'Lidl']) {
      expect(server.knownFor(label, m.rules)?.id ?? null).toBe(knownFor(label, asModule)?.id ?? null);
    }
    expect([server.RULE_LABEL_MAX, server.RULE_DESCRIPTION_MAX]).toEqual([RULE_LABEL_MAX, RULE_DESCRIPTION_MAX]);
  });
});
