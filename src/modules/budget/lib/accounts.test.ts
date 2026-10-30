import { describe, expect, it } from 'vitest';
import { accountBalance, accountList, accountOf, accountProblem, balanceGap, entriesOf, entryAccountId, findAccount, VIRTUAL_MAIN } from './accounts';
import type { BudgetAccount, BudgetEntry } from './types';

const entry = (day: string, amountCents: number, accountId: string | null = null, createdAt = ''): BudgetEntry => ({
  id: `${day}-${amountCents}-${accountId}`,
  day,
  label: 'x',
  amountCents,
  categoryId: null,
  source: 'manuelle',
  importKey: null,
  note: '',
  accountId,
  createdAt,
});

const pluxee: BudgetAccount = { id: 'p', name: 'Pluxee', emoji: '🍽️', isDefault: false, balanceCents: 4720, balanceDay: '2026-10-30', balanceSetAt: '2026-10-30T12:00:00.000Z', position: 1 };
const bourso: BudgetAccount = { id: 'b', name: 'BoursoBank', emoji: '🏦', isDefault: true, balanceCents: null, balanceDay: null, balanceSetAt: null, position: 0 };

describe('les comptes du budget', () => {
  it('le compte principal reste en tête, virtuel tant qu’il n’est pas nommé', () => {
    expect(accountList([pluxee])).toEqual([VIRTUAL_MAIN, pluxee]);
    expect(accountList([pluxee, bourso]).map((a) => a.name)).toEqual(['BoursoBank', 'Pluxee']);
  });

  it('une écriture sans compte, ou d’un compte disparu, est au compte principal', () => {
    const list = accountList([bourso, pluxee]);
    expect(accountOf(entry('2026-10-01', -100), list)).toBe(bourso);
    expect(accountOf(entry('2026-10-01', -100, 'disparu'), list)).toBe(bourso);
    expect(accountOf(entry('2026-10-01', -100, 'p'), list)).toBe(pluxee);
    // Le principal s'écrit sans identifiant, même nommé.
    expect(entryAccountId(bourso)).toBeNull();
    expect(entryAccountId(pluxee)).toBe('p');
  });

  it('le solde : celui donné, plus ce qui a été noté après', () => {
    const list = accountList([bourso, pluxee]);
    const entries = [
      entry('2026-10-29', -900, 'p'), // avant : déjà dans le solde connu
      entry('2026-10-30', -1200, 'p', '2026-10-30T08:00:00.000Z'), // le jour même, noté avant : déjà dedans
      entry('2026-10-30', -1500, 'p', '2026-10-30T13:00:00.000Z'), // le déjeuner, noté après : compte
      entry('2026-10-31', -850, 'p'),
      entry('2026-11-01', 12000, 'p'), // la recharge du mois
      entry('2026-10-31', -5000), // BoursoBank : pas Pluxee
    ];
    expect(accountBalance(pluxee, entries, list)).toBe(4720 - 1500 - 850 + 12000);
    expect(accountBalance(bourso, entries, list)).toBeNull(); // pas suivi
    expect(entriesOf(entries, bourso, list)).toHaveLength(1);
  });

  it('l’écart avec le solde réel dit ce qui manque', () => {
    const list = accountList([pluxee]);
    expect(balanceGap(pluxee, [entry('2026-10-31', -850, 'p')], list, 3000)).toBe(3000 - (4720 - 850));
  });

  it('un nom, unique, et un solde avec son jour', () => {
    const list = accountList([bourso, pluxee]);
    expect(accountProblem({ name: ' ', balanceCents: null, balanceDay: null }, list, null)).toMatch(/obligatoire/);
    expect(accountProblem({ name: 'pluxee', balanceCents: null, balanceDay: null }, list, null)).toMatch(/déjà/);
    expect(accountProblem({ name: 'Pluxee', balanceCents: 10, balanceDay: '2026-10-30' }, list, 'p')).toBeNull();
    expect(accountProblem({ name: 'Livret', balanceCents: 10, balanceDay: null }, list, null)).toMatch(/jour/);
    // Nommer le principal virtuel « Compte courant » n'entre pas en conflit avec lui-même.
    expect(accountProblem({ name: 'Compte courant', balanceCents: null, balanceDay: null }, accountList([]), '')).toBeNull();
  });

  it('un compte se retrouve par son nom, sans casse ni accents', () => {
    const list = accountList([bourso, pluxee]);
    expect(findAccount(list, 'PLUXEE')).toBe(pluxee);
    expect(findAccount(list, 'p')).toBe(pluxee);
    expect(findAccount(list, 'boursobank')).toBe(bourso);
    expect(findAccount(list, 'Livret A')).toBeNull();
  });
});
