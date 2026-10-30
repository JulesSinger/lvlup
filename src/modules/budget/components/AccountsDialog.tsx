import { useEffect, useState } from 'react';
import { budgetStore } from '../data';
import { accountBalance, accountList, accountProblem, balanceGap, entriesOf, VIRTUAL_MAIN } from '../lib/accounts';
import { centsToInputValue, formatCents, parseSignedAmountToCents } from '../lib/amount';
import type { BudgetAccount, BudgetEntry } from '../lib/types';

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Un montant signé, virgule ou point : « 47,20 », « -12.5 ». */
const readAmount = (text: string) => parseSignedAmountToCents(text.replace('.', ','));

const EMOJIS = ['🏦', '🍽️', '💳', '💶', '🐷', '🏠'];

interface Draft {
  /** `null` = un nouveau compte. */
  account: BudgetAccount | null;
  name: string;
  emoji: string;
  tracked: boolean;
  amountText: string;
  day: string;
}

function draftOf(account: BudgetAccount | null): Draft {
  return {
    account,
    name: account?.name ?? '',
    emoji: account?.emoji ?? '🍽️',
    tracked: account ? account.balanceCents !== null : true,
    amountText: account?.balanceCents != null ? centsToInputValue(account.balanceCents) : '',
    day: account?.balanceDay ?? today(),
  };
}

/**
 * Les comptes du budget (docs/etude-astra.md §17) : d'où part l'argent — la
 * carte Pluxee des titres-restaurant à côté du compte BoursoBank. Chaque compte
 * dit son solde (celui donné un jour, plus les écritures des jours suivants),
 * et se vérifie contre le solde réel : l'écart devient une écriture à classer,
 * ou un nouveau point de départ.
 */
export function AccountsDialog({
  accounts,
  entries,
  onClose,
  onChanged,
}: {
  accounts: BudgetAccount[];
  entries: BudgetEntry[];
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  const list = accountList(accounts);
  const [draft, setDraft] = useState<Draft | null>(null);
  /** Le compte dont on vérifie le solde, et le solde réel tapé. */
  const [checking, setChecking] = useState<{ account: BudgetAccount; text: string } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (draft || checking) {
        setDraft(null);
        setChecking(null);
      } else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [draft, checking, onClose]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
      await onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft(d: Draft) {
    const balanceCents = d.tracked ? readAmount(d.amountText) : null;
    if (d.tracked && balanceCents === null) {
      setError('Le solde doit être un montant, par exemple 47,20 (ou -12,00).');
      return;
    }
    const input = { name: d.name.trim(), emoji: d.emoji, balanceCents, balanceDay: d.tracked ? d.day : null };
    const problem = accountProblem(input, list, d.account?.id ?? null);
    if (problem) {
      setError(problem);
      return;
    }
    await run(async () => {
      if (d.account === null) await budgetStore.createAccount(input);
      // Le compte principal tant qu'il n'est pas nommé n'existe pas en base : le nommer le crée.
      else if (d.account === VIRTUAL_MAIN) await budgetStore.createAccount({ ...input, isDefault: true });
      else {
        // Le solde inchangé garde son moment : renommer un compte ne recompte rien.
        const same = d.account.balanceCents === input.balanceCents && d.account.balanceDay === input.balanceDay;
        await budgetStore.updateAccount(
          d.account.id,
          same ? { name: input.name, emoji: input.emoji } : input,
        );
      }
      setDraft(null);
    });
  }

  async function remove(account: BudgetAccount) {
    const count = entriesOf(entries, account, list).length;
    const main = list[0];
    const message =
      count > 0
        ? `Supprimer le compte « ${account.name} » ? Ses ${count} écriture${count > 1 ? 's' : ''} passent sur « ${main.name} », rien n’est effacé.`
        : `Supprimer le compte « ${account.name} » ?`;
    if (!window.confirm(message)) return;
    await run(() => budgetStore.deleteAccount(account.id));
  }

  const checkedReal = checking ? readAmount(checking.text) : null;
  const gap = checking && checkedReal !== null ? balanceGap(checking.account, entries, list, checkedReal) : null;

  return (
    <div className="overlay">
      <div className="modal budget-accounts-dialog" role="dialog" aria-modal="true" aria-label="Comptes">
        <div className="modal-head">
          <span className="modal-title">Comptes</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <p className="field-hint">
            D’où part l’argent : ta banque, la carte de tes titres-restaurant… Une dépense garde sa catégorie, quel que
            soit le compte ; le compte dit seulement d’où elle est partie.
          </p>

          <ul className="budget-accounts-list">
            {list.map((account) => {
              const balance = accountBalance(account, entries, list);
              const count = entriesOf(entries, account, list).length;
              return (
                <li key={account.id || 'principal'} className="budget-account-row">
                  <span className="budget-account-emoji" aria-hidden="true">
                    {account.emoji}
                  </span>
                  <span className="budget-account-name">
                    {account.name}
                    <span className="budget-account-meta">
                      {account.isDefault ? 'compte principal · ' : ''}
                      {count} écriture{count > 1 ? 's' : ''}
                    </span>
                  </span>
                  <span className={`budget-account-balance${balance !== null && balance < 0 ? ' negative' : ''}`}>
                    {balance === null ? 'solde non suivi' : formatCents(balance)}
                  </span>
                  <span className="budget-account-actions">
                    {balance !== null && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => {
                          setDraft(null);
                          setChecking({ account, text: '' });
                        }}
                      >
                        Vérifier
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setChecking(null);
                        setDraft(draftOf(account));
                      }}
                    >
                      Modifier
                    </button>
                    {!account.isDefault && (
                      <button type="button" className="btn btn-ghost btn-sm btn-danger" onClick={() => void remove(account)}>
                        Supprimer
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>

          {checking && (
            <div className="budget-account-form" role="group" aria-label={`Vérifier le solde de ${checking.account.name}`}>
              <div className="field">
                <label htmlFor="budget-account-real">Solde affiché par {checking.account.name}, aujourd’hui (€)</label>
                <input
                  id="budget-account-real"
                  type="text"
                  inputMode="decimal"
                  autoFocus
                  value={checking.text}
                  onChange={(e) => setChecking({ ...checking, text: e.target.value })}
                  placeholder="47,20"
                />
              </div>
              {gap === 0 && <div className="notice">C’est juste : rien ne manque.</div>}
              {gap !== null && gap !== 0 && checkedReal !== null && (
                <>
                  <p className="budget-account-gap" role="status">
                    Atlas compte {formatCents(checkedReal - gap)} : il {gap < 0 ? 'manque une dépense' : 'manque une entrée'} de{' '}
                    <b>{centsToInputValue(Math.abs(gap))} €</b>.
                  </p>
                  <div className="budget-account-gap-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await budgetStore.createEntry({
                            day: today(),
                            label: `Écart de solde ${checking.account.name}`,
                            amountCents: gap,
                            categoryId: null,
                            accountId: checking.account.isDefault ? null : checking.account.id,
                            note: 'Noté en vérifiant le solde : à classer, ou à remplacer par les vraies opérations.',
                          });
                          setChecking(null);
                        })
                      }
                    >
                      Noter l’écart, à classer
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await budgetStore.updateAccount(checking.account.id, { balanceCents: checkedReal, balanceDay: today() });
                          setChecking(null);
                        })
                      }
                    >
                      Repartir de ce solde
                    </button>
                  </div>
                  <span className="field-hint">
                    « Noter l’écart » garde le compte juste et l’écart visible dans le mois ; « repartir » l’oublie.
                  </span>
                </>
              )}
            </div>
          )}

          {draft && (
            <div className="budget-account-form" role="group" aria-label={draft.account ? `Modifier ${draft.account.name}` : 'Nouveau compte'}>
              <div className="row">
                <div className="field">
                  <label htmlFor="budget-account-name">Nom</label>
                  <input
                    id="budget-account-name"
                    type="text"
                    autoFocus
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    placeholder="Pluxee, espèces, livret…"
                  />
                </div>
                <div className="field budget-account-emoji-field">
                  <label>Icône</label>
                  <div className="budget-category-chips" role="group" aria-label="Icône du compte">
                    {EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className={`budget-category-chip${draft.emoji === emoji ? ' on' : ''}`}
                        aria-pressed={draft.emoji === emoji}
                        onClick={() => setDraft({ ...draft, emoji })}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <label className="budget-remember">
                <input type="checkbox" checked={draft.tracked} onChange={(e) => setDraft({ ...draft, tracked: e.target.checked })} />
                <span>Suivre le solde de ce compte</span>
              </label>
              {draft.tracked && (
                <div className="row">
                  <div className="field">
                    <label htmlFor="budget-account-balance">Solde (€)</label>
                    <input
                      id="budget-account-balance"
                      type="text"
                      inputMode="decimal"
                      value={draft.amountText}
                      onChange={(e) => setDraft({ ...draft, amountText: e.target.value })}
                      placeholder="47,20"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="budget-account-day">au</label>
                    <input id="budget-account-day" type="date" value={draft.day} onChange={(e) => setDraft({ ...draft, day: e.target.value })} />
                  </div>
                </div>
              )}
              {draft.tracked && (
                <span className="field-hint">
                  Le solde que montre l’appli : Atlas y ajoute ensuite tout ce que tu notes sur ce compte. « Vérifier »
                  le compare plus tard au solde réel.
                </span>
              )}
              <div className="budget-account-form-foot">
                <button type="button" className="btn btn-sm" onClick={() => setDraft(null)}>
                  Annuler
                </button>
                <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void saveDraft(draft)}>
                  {draft.account ? 'Enregistrer' : 'Ajouter le compte'}
                </button>
              </div>
            </div>
          )}

          {error && <div className="notice error">{error}</div>}
        </div>

        <div className="modal-foot">
          {!draft && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setChecking(null);
                setDraft(draftOf(null));
              }}
            >
              ＋ Nouveau compte
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
