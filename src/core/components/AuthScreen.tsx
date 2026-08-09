import { useState } from 'react';
import { coreStore } from '../data';

type Mode = 'signin' | 'signup' | 'forgot';

export function AuthScreen({
  onBack,
  initialMode = 'signin',
}: { onBack?: () => void; initialMode?: Mode } = {}) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function switchTo(next: Mode) {
    setMode(next);
    setError('');
    setInfo('');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setInfo('');
    try {
      if (mode === 'signup') {
        const { needsConfirmation } = await coreStore.signUp(email.trim(), password);
        if (needsConfirmation) {
          setInfo('Compte créé. Confirme ton adresse via l’e-mail reçu, puis connecte-toi.');
          setMode('signin');
        }
      } else if (mode === 'forgot') {
        await coreStore.resetPassword(email.trim());
        // Message volontairement neutre : il ne dit pas si l'adresse existe,
        // ce qui éviterait à quiconque de tester des adresses au hasard.
        setInfo(
          "Si un compte existe pour cette adresse, un lien de réinitialisation vient d'y être envoyé. Pense à regarder les indésirables.",
        );
        setMode('signin');
      } else {
        await coreStore.signIn(email.trim(), password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand">
          <span className="brand-mark">▲</span> Zénith
        </div>
        <p className="auth-tagline">Chaque objectif est une montée. Atteins ton zénith.</p>

        {error && <div className="notice error">{error}</div>}
        {info && <div className="notice success">{info}</div>}

        <div className="field">
          <label htmlFor="email">Adresse e-mail</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        {mode === 'forgot' ? (
          <p className="field-hint" style={{ marginTop: -4 }}>
            Indique l'adresse de ton compte : tu recevras un lien pour choisir un nouveau mot de
            passe.
          </p>
        ) : (
          <div className="field">
            <label htmlFor="password">Mot de passe</label>
            <div className="password-field">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((v) => !v)}
                title={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                aria-pressed={showPassword}
              >
                {showPassword ? '🙈' : '👁'}
              </button>
            </div>
            {mode === 'signup' && <p className="field-hint">6 caractères minimum.</p>}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {busy
            ? 'Un instant…'
            : mode === 'signup'
              ? 'Créer mon compte'
              : mode === 'forgot'
                ? 'Envoyer le lien'
                : 'Se connecter'}
        </button>

        {mode === 'signin' && (
          <p className="auth-switch">
            <button type="button" className="link-btn" onClick={() => switchTo('forgot')}>
              Mot de passe oublié ?
            </button>
          </p>
        )}

        <p className="auth-switch">
          {mode === 'forgot' ? (
            <button type="button" className="link-btn" onClick={() => switchTo('signin')}>
              ← Revenir à la connexion
            </button>
          ) : (
            <>
              {mode === 'signup' ? 'Déjà un compte ? ' : 'Pas encore de compte ? '}
              <button
                type="button"
                className="link-btn"
                onClick={() => switchTo(mode === 'signup' ? 'signin' : 'signup')}
              >
                {mode === 'signup' ? 'Se connecter' : 'En créer un'}
              </button>
            </>
          )}
        </p>

        {onBack && (
          <p className="auth-switch">
            <button type="button" className="link-btn" onClick={onBack}>
              ← Revenir à la présentation
            </button>
          </p>
        )}
      </form>
    </div>
  );
}
