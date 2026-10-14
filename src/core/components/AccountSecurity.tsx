import { useEffect, useState } from 'react';
import { coreStore } from '../data';
import type { SecondFactor, SecondFactorEnrollment } from '../data/coreStore';
import { DELETE_PHRASE, readTotpCode } from '../lib/mfa';

const message = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);
const dateLabel = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Sécurité du compte, dans les réglages (docs/securite.md §7-§8) : la double
 * authentification (une app d'authentification, codes à six chiffres) et la
 * suppression du compte. Avec un compte seulement.
 */
export function AccountSecurity({ onExport }: { onExport: () => void }) {
  const [factors, setFactors] = useState<SecondFactor[] | null>(null);
  const [enrollment, setEnrollment] = useState<SecondFactorEnrollment | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const refresh = () =>
    coreStore
      .listSecondFactors()
      .then(setFactors)
      .catch((err) => setError(message(err, 'Double authentification illisible.')));
  useEffect(() => {
    void refresh();
  }, []);

  async function run(action: () => Promise<void>, ok: string) {
    setBusy(true);
    setError('');
    setDone('');
    try {
      await action();
      setDone(ok);
    } catch (err) {
      setError(message(err, 'Action impossible.'));
    } finally {
      setBusy(false);
    }
  }

  const start = () =>
    run(async () => {
      setEnrollment(await coreStore.enrollSecondFactor());
      setCode('');
    }, '');

  const confirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollment) return;
    void run(async () => {
      await coreStore.confirmSecondFactor(enrollment.factorId, code);
      setEnrollment(null);
      setCode('');
      await refresh();
    }, 'Double authentification activée : le code sera demandé à chaque connexion.');
  };

  const remove = (f: SecondFactor) =>
    run(async () => {
      await coreStore.removeSecondFactor(f.id);
      await refresh();
    }, 'Double authentification désactivée.');

  return (
    <>
      <section className="settings-block">
        <h3 className="settings-title">Double authentification</h3>
        <p className="settings-hint">
          En plus du mot de passe, un code à six chiffres donné par une app d’authentification (Authentificateur d’iCloud,
          Google Authenticator, 1Password, Bitwarden…). Un mot de passe volé ne suffit plus.
        </p>
        {factors === null ? null : enrollment ? (
          <form className="settings-mfa-enroll" onSubmit={confirm}>
            <p className="settings-hint">Scanne ce QR code avec ton app, puis recopie le code qu’elle affiche.</p>
            <img className="settings-mfa-qr" src={enrollment.qrCode} alt="QR code de la double authentification" width={180} height={180} />
            <p className="settings-hint">
              Ou tape la clé à la main : <code className="settings-mfa-secret">{enrollment.secret}</code>
            </p>
            <div className="settings-password">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Code à six chiffres"
                aria-label="Code à six chiffres"
                maxLength={7}
              />
              <button className="btn btn-sm" type="submit" disabled={busy || !readTotpCode(code)}>
                Activer
              </button>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => setEnrollment(null)}>
                Annuler
              </button>
            </div>
          </form>
        ) : factors.length === 0 ? (
          <div className="settings-actions">
            <button className="btn btn-sm" type="button" onClick={() => void start()} disabled={busy}>
              Activer la double authentification
            </button>
          </div>
        ) : (
          <>
            {factors.map((f) => (
              <p key={f.id} className="settings-hint">
                ✓ Active depuis le {dateLabel(f.createdAt)}.{' '}
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => void remove(f)} disabled={busy}>
                  Désactiver
                </button>
              </p>
            ))}
            <p className="settings-hint">
              Téléphone perdu ? Sans l’app, plus de code : garde la clé affichée à l’activation dans un gestionnaire de mots de
              passe. En dernier recours, le facteur se retire dans Supabase (Authentication → Users).
            </p>
          </>
        )}
        {done && <p className="settings-ok">{done}</p>}
        {error && <p className="settings-problem">{error}</p>}
      </section>
      <DeleteAccount hasFactor={(factors?.length ?? 0) > 0} onExport={onExport} />
    </>
  );
}

/** Supprimer son compte : tout, définitivement, après avoir redonné son mot de passe. */
function DeleteAccount({ hasFactor, onExport }: { hasFactor: boolean; onExport: () => void }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const ready = password.length > 0 && phrase.trim() === DELETE_PHRASE && (!hasFactor || readTotpCode(code) !== null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError('');
    try {
      await coreStore.deleteAccount(password, hasFactor ? code : null);
      // La session est fermée : l'app revient d'elle-même à l'accueil.
    } catch (err) {
      setError(message(err, 'Suppression impossible.'));
      setBusy(false);
    }
  }

  return (
    <section className="settings-block">
      <h3 className="settings-title">Supprimer mon compte</h3>
      {!open ? (
        <div className="settings-actions">
          <button className="btn btn-ghost btn-sm btn-danger" type="button" onClick={() => setOpen(true)}>
            Supprimer mon compte…
          </button>
        </div>
      ) : (
        <form className="settings-delete" onSubmit={submit}>
          <p className="settings-problem" role="note">
            Tout sera effacé, définitivement : objectifs, budget, cartes, repas, courses, calendrier, tâches, hauts faits et
            leurs photos, projets, sorties, recettes. Rien ne pourra être récupéré.
          </p>
          <p className="settings-hint">
            Garde d’abord une copie :{' '}
            <button className="btn btn-ghost btn-sm" type="button" onClick={onExport}>
              Exporter une sauvegarde
            </button>{' '}
            (les photos se téléchargent depuis Hauts faits).
          </p>
          <div className="field">
            <label htmlFor="delete-password">Mot de passe</label>
            <input id="delete-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          </div>
          {hasFactor && (
            <div className="field">
              <label htmlFor="delete-code">Code de ton app d’authentification</label>
              <input id="delete-code" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={7} />
            </div>
          )}
          <div className="field">
            <label htmlFor="delete-phrase">Écris {DELETE_PHRASE} pour confirmer</label>
            <input id="delete-phrase" value={phrase} onChange={(e) => setPhrase(e.target.value)} autoComplete="off" />
          </div>
          {error && <p className="settings-problem">{error}</p>}
          <div className="settings-actions">
            <button className="btn btn-sm btn-danger" type="submit" disabled={busy || !ready}>
              {busy ? 'Suppression…' : 'Supprimer définitivement'}
            </button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setOpen(false)} disabled={busy}>
              Annuler
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
