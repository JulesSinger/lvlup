import { useEffect, useState } from 'react';
import { store } from '../../data';
import { DAILY_GOAL_LEVELS, type Settings } from '../../data/store';
import type { AppUser } from '../lib/types';
import { ReminderSettings } from './ReminderSettings';

/**
 * Panneau de réglages — tout ce qui ne se règle qu'une fois : le rythme
 * quotidien, le rappel, le compte, les données. Il vit dans une fenêtre plutôt
 * que dans un onglet : sur téléphone la barre du bas est déjà pleine, et ces
 * réglages ne se touchent pas tous les jours.
 */
export function SettingsPanel({
  user,
  settings,
  onChange,
  onExport,
  onImport,
  onClose,
}: {
  user: AppUser | null;
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onExport: () => void;
  onImport: () => void;
  onClose: () => void;
}) {
  const [password, setPassword] = useState('');
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordDone, setPasswordDone] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setPasswordError('Huit caractères minimum.');
      return;
    }
    setPasswordBusy(true);
    setPasswordError('');
    setPasswordDone('');
    try {
      await store.updatePassword(password);
      setPassword('');
      setPasswordDone('Mot de passe mis à jour.');
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Modification impossible.');
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="Réglages">
        <div className="modal-head">
          <h2 className="modal-title">Réglages</h2>
          <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <section className="settings-block">
            <h3 className="settings-title">Objectif du jour</h3>
            <p className="settings-hint">
              La cible de PP qui remplit l'anneau. Mieux vaut la placer bas et la dépasser
              souvent que l'inverse.
            </p>
            <div className="goal-levels">
              {DAILY_GOAL_LEVELS.map((level) => (
                <button
                  key={level.pp}
                  className={`goal-level${settings.dailyGoal === level.pp ? ' active' : ''}`}
                  onClick={() => onChange({ dailyGoal: level.pp })}
                >
                  <b>{level.label}</b>
                  <span>{level.pp} PP</span>
                  <i>{level.hint}</i>
                </button>
              ))}
            </div>
          </section>

          {user && !user.isLocal && <ReminderSettings settings={settings} onChange={onChange} />}

          <section className="settings-block">
            <h3 className="settings-title">Tes données</h3>
            <p className="settings-hint">
              La sauvegarde contient tout : objectifs, paliers, actions, réalisations, trophées.
            </p>
            <div className="settings-actions">
              <button className="btn btn-sm" onClick={onExport}>
                Exporter une sauvegarde
              </button>
              <button className="btn btn-sm" onClick={onImport}>
                Importer une sauvegarde
              </button>
            </div>
          </section>

          {user && !user.isLocal && (
            <section className="settings-block">
              <h3 className="settings-title">Compte</h3>
              <p className="settings-hint">{user.email}</p>
              <form className="settings-password" onSubmit={changePassword}>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Nouveau mot de passe"
                  autoComplete="new-password"
                  aria-label="Nouveau mot de passe"
                />
                <button className="btn btn-sm" type="submit" disabled={passwordBusy || !password}>
                  {passwordBusy ? 'Enregistrement…' : 'Changer'}
                </button>
              </form>
              {passwordDone && <p className="settings-ok">{passwordDone}</p>}
              {passwordError && <p className="settings-problem">{passwordError}</p>}
              <div className="settings-actions">
                {/* Refermer avant de partir : sans ça, le panneau restait
                    ouvert par-dessus l'écran de connexion, puis accueillait la
                    session suivante — y compris une inscription toute neuve. */}
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    onClose();
                    void store.signOut();
                  }}
                >
                  Déconnexion
                </button>
              </div>
            </section>
          )}
        </div>

        <div className="modal-foot">
          <button className="btn btn-primary" onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
