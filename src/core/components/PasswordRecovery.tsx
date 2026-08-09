import { useState } from 'react';
import { store } from '../../data';

/**
 * Écran affiché quand on arrive par le lien « mot de passe oublié ».
 *
 * Supabase ouvre l'app avec une session de récupération valide : l'utilisateur
 * est techniquement connecté, mais tant qu'il n'a pas choisi un nouveau mot de
 * passe il ne pourra pas se reconnecter demain. On lui barre donc la route
 * jusqu'à ce que ce soit fait, plutôt que de le laisser filer vers le hub et
 * découvrir le problème à la prochaine connexion.
 */
export function PasswordRecovery({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError('Huit caractères minimum.');
      return;
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne sont pas identiques.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await store.updatePassword(password);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Modification impossible.');
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={submit}>
        <div className="brand auth-brand">
          <span className="brand-mark">▲</span>
          <span className="brand-name">Zénith</span>
        </div>
        <h1 className="auth-title">Choisis un nouveau mot de passe</h1>
        <p className="auth-sub">
          Le lien t'a authentifié. Il ne reste qu'à définir le mot de passe qui servira la
          prochaine fois.
        </p>

        {error && <div className="notice error">{error}</div>}

        <div className="field">
          <label htmlFor="new-password">Nouveau mot de passe</label>
          <input
            id="new-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="confirm-password">Confirme</label>
          <input
            id="confirm-password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </div>

        <button className="btn btn-primary auth-submit" type="submit" disabled={busy}>
          {busy ? 'Enregistrement…' : 'Enregistrer et continuer'}
        </button>
      </form>
    </div>
  );
}
