import { useEffect, useState } from 'react';
import type { SportStore } from '../data/sportStore';
import { hashToken, newImportToken } from '../lib/importToken';
import type { ImportToken } from '../lib/types';
import { Modal } from './Modal';

const dateFr = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

/** Le corps que le raccourci envoie, montré tel quel (docs/etude-sport.md §15). */
const EXAMPLE = `{
  "start": "2026-10-07T18:32:00+02:00",
  "duration": "52:30",
  "distance": "10,23 km",
  "avgHr": 152
}`;

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-sm"
      onClick={() => {
        void navigator.clipboard
          ?.writeText(text)
          .then(() => {
            setDone(true);
            window.setTimeout(() => setDone(false), 1500);
          })
          .catch(() => undefined);
      }}
    >
      {done ? 'Copié ✓' : label}
    </button>
  );
}

/**
 * Relier l'Apple Watch (docs/etude-sport.md §3.3, §15) : un jeton, l'adresse
 * de la fonction `sport-import`, et le raccourci à construire une fois. Le
 * jeton n'est montré qu'à sa création ; seule son empreinte est rangée.
 *
 * `endpoint` est null en mode local : sans compte, il n'y a pas de serveur où
 * le raccourci pourrait envoyer quoi que ce soit.
 */
export function ShortcutSetup({ store, endpoint, onClose }: { store: SportStore; endpoint: string | null; onClose: () => void }) {
  const [tokens, setTokens] = useState<ImportToken[]>([]);
  const [fresh, setFresh] = useState<string | null>(null);
  const [label, setLabel] = useState('iPhone');
  const [revoking, setRevoking] = useState<string | null>(null);
  const [trial, setTrial] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!endpoint) return;
    store.listTokens().then(setTokens, (err: unknown) => setError(err instanceof Error ? err.message : 'Jetons illisibles.'));
  }, [store, endpoint]);

  async function create() {
    setError('');
    setTrial('');
    try {
      const token = newImportToken();
      await store.createToken(await hashToken(token), label.trim().slice(0, 80) || 'iPhone');
      setFresh(token);
      setTokens(await store.listTokens());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Création impossible.');
    }
  }

  async function revoke(id: string) {
    setError('');
    try {
      await store.deleteToken(id);
      setTokens(await store.listTokens());
      setRevoking(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Révocation impossible.');
    }
  }

  /** Le même appel que le raccourci, sans rien écrire : le jeton et la fonction répondent-ils ? */
  async function tryToken(token: string) {
    if (!endpoint) return;
    setTrial('…');
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true }),
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      setTrial(body.message ?? `Réponse inattendue (${res.status}).`);
    } catch {
      setTrial('La fonction ne répond pas : est-elle déployée (supabase functions deploy sport-import --no-verify-jwt) ?');
    }
  }

  return (
    <Modal title="Relier l’Apple Watch" onClose={onClose}>
      <p className="sport-hint sport-shortcut-intro">
        À la fin de chaque course lancée sur la montre, un raccourci de l’iPhone envoie la séance à Sport : jour, heure, durée, distance,
        fréquence cardiaque. Tu le construis une fois, ensuite il n’y a plus rien à faire.
      </p>

      {!endpoint ? (
        <p className="sport-shortcut-local" role="note">
          Le raccourci envoie tes sorties à ton compte Atlas : il faut être connecté avec un compte. Sur cet appareil, Atlas fonctionne sans
          compte ; tu peux toujours reprendre l’archive Strava ou noter une sortie à la main.
        </p>
      ) : (
        <>
          <section className="sport-shortcut-step">
            <h3 className="sport-panel-title">1. Le jeton</h3>
            <p className="sport-hint">Il permet au raccourci d’écrire dans Sport, et à rien d’autre. Il ne s’affiche qu’une fois.</p>
            {fresh ? (
              <div className="sport-token-fresh" role="status">
                <code className="sport-token-value">{fresh}</code>
                <div className="sport-token-actions">
                  <CopyButton text={fresh} label="Copier le jeton" />
                  <button type="button" className="btn btn-sm" onClick={() => void tryToken(fresh)}>
                    Essayer
                  </button>
                </div>
                <p className="sport-hint">Colle-le dans le raccourci maintenant : une fois cette fenêtre fermée, il ne se montrera plus.</p>
                {trial && <p className="sport-shortcut-trial">{trial}</p>}
              </div>
            ) : (
              <div className="sport-token-new">
                <input aria-label="Nom du jeton" value={label} maxLength={80} onChange={(e) => setLabel(e.target.value)} />
                <button type="button" className="btn btn-primary btn-sm" onClick={() => void create()}>
                  Créer un jeton
                </button>
              </div>
            )}
            {tokens.length > 0 && (
              <ul className="sport-token-list">
                {tokens.map((t) => (
                  <li key={t.id} className="sport-token-item">
                    <span className="sport-token-label">{t.label || 'Jeton'}</span>
                    <span className="sport-token-meta">
                      créé le {dateFr(t.createdAt)} · {t.lastUsedAt ? `servi le ${dateFr(t.lastUsedAt)}` : 'jamais servi'}
                    </span>
                    {revoking === t.id ? (
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => void revoke(t.id)}>
                        Confirmer
                      </button>
                    ) : (
                      <button type="button" className="btn btn-sm" onClick={() => setRevoking(t.id)}>
                        Révoquer
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="sport-shortcut-step">
            <h3 className="sport-panel-title">2. L’adresse</h3>
            <div className="sport-token-fresh">
              <code className="sport-token-value">{endpoint}</code>
              <div className="sport-token-actions">
                <CopyButton text={endpoint} label="Copier l’adresse" />
              </div>
            </div>
          </section>

          <section className="sport-shortcut-step">
            <h3 className="sport-panel-title">3. Le raccourci, sur l’iPhone</h3>
            <ol className="sport-shortcut-list">
              <li>
                App <b>Raccourcis</b> → <b>Automatisation</b> → <b>+</b> → <b>Exercice sur Apple Watch</b> : « Se termine », type{' '}
                <b>Course</b>, puis <b>Exécuter immédiatement</b>.
              </li>
              <li>
                Action <b>Rechercher des échantillons de santé</b> : type <b>Entraînements</b>, trier par date de début, la plus récente
                d’abord, limite <b>1</b>.
              </li>
              <li>
                Action <b>Formater la date</b> sur sa <b>Date de début</b> : format <b>ISO 8601</b>, heure comprise.
              </li>
              <li>
                Action <b>Obtenir le contenu de l’URL</b> : l’adresse ci-dessus, méthode <b>POST</b>, en-tête <b>Authorization</b> ={' '}
                <code>Bearer</code> suivi d’une espace et du jeton, corps <b>JSON</b> avec les champs <code>start</code> (la date formatée),{' '}
                <code>duration</code>, <code>distance</code> et, si Santé les donne, <code>avgHr</code> et <code>maxHr</code>.
              </li>
              <li>
                Action <b>Obtenir la valeur du dictionnaire</b> « message », puis <b>Afficher une notification</b> : Sport te dit ce qu’il a
                rangé, ou pourquoi il a refusé.
              </li>
            </ol>
            <p className="sport-hint">Ce que reçoit Sport, par exemple :</p>
            <pre className="sport-shortcut-example">{EXAMPLE}</pre>
            <p className="sport-hint">
              La distance se lit avec ou sans unité (« 10,23 km », « 10230 m »), la durée en « 52:30 » ou en secondes. Une séance déjà reçue
              n’est jamais rangée deux fois, ni une sortie déjà venue de l’archive Strava ou notée à la main.
            </p>
          </section>
        </>
      )}
      {error && (
        <p className="sport-error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
