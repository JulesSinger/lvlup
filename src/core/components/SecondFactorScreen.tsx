import { useState } from 'react';
import { coreStore } from '../data';
import { readTotpCode } from '../lib/mfa';
import AtlasMark from './AtlasMark';

/**
 * Le code de la double authentification, à la connexion (docs/securite.md §7).
 *
 * Le mot de passe est donné, la session n'est qu'au premier niveau : la base
 * refuse tout au compte tant que le code n'est pas donné (politiques
 * `<table>_mfa`). Plutôt que des modules vides, cet écran. Une fois le code
 * accepté, Supabase renouvelle la session et l'app s'ouvre d'elle-même.
 */
export function SecondFactorScreen({ email }: { email: string }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!readTotpCode(code)) {
      setError('Six chiffres, tels que ton app d’authentification les affiche.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await coreStore.verifySecondFactor(code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code refusé.');
      setCode('');
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand auth-brand">
          <AtlasMark />
          <span className="brand-name">Atlas</span>
        </div>
        <h1 className="auth-title">Le code de ton app</h1>
        <p className="auth-sub">
          {email} est protégé par la double authentification : ouvre ton app d’authentification et recopie le code
          à six chiffres d’Atlas.
        </p>

        {error && <div className="notice error">{error}</div>}

        <div className="field">
          <label htmlFor="totp-code">Code</label>
          <input
            id="totp-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            autoFocus
          />
        </div>

        <button className="btn btn-primary auth-submit" type="submit" disabled={busy}>
          {busy ? 'Vérification…' : 'Continuer'}
        </button>
        <button className="btn btn-ghost auth-submit" type="button" onClick={() => void coreStore.signOut()}>
          Se déconnecter
        </button>
      </form>
    </div>
  );
}
