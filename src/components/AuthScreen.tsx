import { useState } from 'react';
import { store } from '../data';

export function AuthScreen({ onBack }: { onBack?: () => void } = {}) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setInfo('');
    try {
      if (mode === 'signup') {
        const { needsConfirmation } = await store.signUp(email.trim(), password);
        if (needsConfirmation) {
          setInfo('Compte créé. Confirme ton adresse via l’e-mail reçu, puis connecte-toi.');
          setMode('signin');
        }
      } else {
        await store.signIn(email.trim(), password);
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
          {mode === 'signup' && (
            <p className="field-hint">6 caractères minimum.</p>
          )}
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={busy}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          {busy ? 'Un instant…' : mode === 'signup' ? 'Créer mon compte' : 'Se connecter'}
        </button>

        <p className="auth-switch">
          {mode === 'signup' ? 'Déjà un compte ? ' : 'Pas encore de compte ? '}
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setMode(mode === 'signup' ? 'signin' : 'signup');
              setError('');
              setInfo('');
            }}
          >
            {mode === 'signup' ? 'Se connecter' : 'En créer un'}
          </button>
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
