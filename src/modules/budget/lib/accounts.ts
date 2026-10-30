/**
 * Les comptes du budget — bibliothèque pure (docs/etude-astra.md §17).
 *
 * Deux règles portent tout :
 * - une écriture sans compte (`accountId: null`), ou dont le compte n'existe
 *   plus, appartient au compte principal ;
 * - le solde d'un compte est le solde connu à un jour, plus les écritures des
 *   jours suivants, et celles du jour même notées **après** qu'on a donné le
 *   solde : le déjeuner saisi une heure plus tard compte, la boulangerie du
 *   matin rattrapée ensuite… aussi — c'est le cas rare, et « Vérifier » le
 *   rattrape ; l'inverse (ne jamais compter le jour même) oubliait à coup sûr
 *   la dépense la plus courante, celle qu'on note juste après.
 */
import type { BudgetAccount, BudgetEntry } from './types';
import { ACCOUNT_NAME_MAX } from './types';

/** Le compte principal tant qu'il n'a pas été nommé : il n'existe pas en base. */
export const VIRTUAL_MAIN: BudgetAccount = {
  id: '',
  name: 'Compte courant',
  emoji: '🏦',
  isDefault: true,
  balanceCents: null,
  balanceDay: null,
  balanceSetAt: null,
  position: -1,
};

/** Les comptes, le principal en tête (le vrai s'il existe, sinon `VIRTUAL_MAIN`), puis les autres dans leur ordre. */
export function accountList(accounts: readonly BudgetAccount[]): BudgetAccount[] {
  const main = accounts.find((a) => a.isDefault) ?? VIRTUAL_MAIN;
  const others = accounts.filter((a) => !a.isDefault).sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  return [main, ...others];
}

/** L'identifiant à écrire sur une écriture de ce compte : rien pour le principal. */
export function entryAccountId(account: Pick<BudgetAccount, 'id' | 'isDefault'>): string | null {
  return account.isDefault ? null : account.id;
}

/** Le compte d'une écriture, parmi `accountList(...)`. */
export function accountOf(entry: Pick<BudgetEntry, 'accountId'>, list: readonly BudgetAccount[]): BudgetAccount {
  const main = list.find((a) => a.isDefault) ?? VIRTUAL_MAIN;
  if (entry.accountId === null) return main;
  return list.find((a) => a.id === entry.accountId) ?? main;
}

/** Les écritures d'un compte. */
export function entriesOf<E extends Pick<BudgetEntry, 'accountId'>>(entries: readonly E[], account: BudgetAccount, list: readonly BudgetAccount[]): E[] {
  return entries.filter((e) => accountOf(e, list) === account || accountOf(e, list).id === account.id);
}

/** Le solde d'un compte, ou `null` s'il n'est pas suivi. */
export function accountBalance(account: BudgetAccount, entries: readonly BudgetEntry[], list: readonly BudgetAccount[]): number | null {
  if (account.balanceCents === null || account.balanceDay === null) return null;
  const since = account.balanceDay;
  const setAt = account.balanceSetAt;
  return entriesOf(entries, account, list)
    .filter((e) => e.day > since || (e.day === since && setAt !== null && e.createdAt > setAt))
    .reduce((sum, e) => sum + e.amountCents, account.balanceCents);
}

/** Ce qui ne va pas dans un compte, ou `null`. */
export function accountProblem(
  input: { name: string; balanceCents: number | null; balanceDay: string | null },
  list: readonly BudgetAccount[],
  selfId: string | null,
): string | null {
  const name = input.name.trim();
  if (!name) return 'Le nom du compte est obligatoire.';
  if (name.length > ACCOUNT_NAME_MAX) return `Le nom est trop long (${ACCOUNT_NAME_MAX} caractères au plus).`;
  const key = (s: string) => s.trim().toLocaleLowerCase('fr');
  if (list.some((a) => a.id !== selfId && !(a === VIRTUAL_MAIN && selfId === '') && key(a.name) === key(name))) {
    return 'Un compte porte déjà ce nom.';
  }
  if ((input.balanceCents === null) !== (input.balanceDay === null)) return 'Un solde va avec son jour.';
  return null;
}

/**
 * Le solde réel ne colle pas : l'écart, signé comme une écriture (négatif =
 * il manque une dépense). `null` si le solde n'est pas suivi.
 */
export function balanceGap(account: BudgetAccount, entries: readonly BudgetEntry[], list: readonly BudgetAccount[], realCents: number): number | null {
  const computed = accountBalance(account, entries, list);
  return computed === null ? null : realCents - computed;
}

/** Le compte que désigne un nom (sans casse ni accents) ou un identifiant — pour Claude et les services. */
export function findAccount(list: readonly BudgetAccount[], nameOrId: string): BudgetAccount | null {
  const fold = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .trim()
      .toLowerCase();
  const wanted = fold(nameOrId);
  return list.find((a) => a.id !== '' && a.id === nameOrId) ?? list.find((a) => fold(a.name) === wanted) ?? null;
}
