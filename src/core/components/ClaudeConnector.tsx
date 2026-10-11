import { useEffect, useState } from 'react';
import { coreStore, supabaseConfig } from '../data';
import type { McpToken } from '../data/coreStore';
import { hashToken, newSecretToken } from '../lib/secretToken';

const dateFr = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * L'adresse du connecteur, sans rien de secret : la clé voyage dans un en-tête
 * (depuis le 11/10/2026), que Claude garde à l'abri et n'affiche plus.
 */
export const connectorUrl = supabaseConfig ? `${supabaseConfig.url.replace(/\/$/, '')}/functions/v1/atlas-mcp` : '';

function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-sm"
      onClick={() =>
        void navigator.clipboard?.writeText(text).then(
          () => setDone(true),
          () => undefined,
        )
      }
    >
      {done ? 'Copié ✓' : label}
    </button>
  );
}

/**
 * Le connecteur de Claude (docs/connecteur-claude.md) : une adresse et une
 * clé à coller dans Claude (Réglages → Connecteurs → connecteur personnalisé,
 * clé dans un en-tête de requête). La clé est tirée ici, montrée une fois ;
 * seule son empreinte part en base, comme le jeton du raccourci de Sport.
 * Révoquer une clé coupe Claude aussitôt.
 */
export function ClaudeConnector({ remote }: { remote: boolean }) {
  const [tokens, setTokens] = useState<McpToken[]>([]);
  const [fresh, setFresh] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [problem, setProblem] = useState('');

  useEffect(() => {
    if (!remote) return;
    coreStore.listMcpTokens().then(setTokens, (err: unknown) => setProblem(err instanceof Error ? err.message : 'Jetons illisibles.'));
  }, [remote]);

  async function create() {
    setProblem('');
    try {
      const token = newSecretToken('atl_');
      await coreStore.createMcpToken(await hashToken(token), 'Claude');
      setFresh(token);
      setTokens(await coreStore.listMcpTokens());
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Création impossible.');
    }
  }

  async function revoke(id: string) {
    setProblem('');
    try {
      await coreStore.deleteMcpToken(id);
      setRevoking(null);
      setTokens(await coreStore.listMcpTokens());
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Révocation impossible.');
    }
  }

  return (
    <section className="settings-block claude-connector">
      <h3 className="settings-title">Claude</h3>
      <p className="settings-hint">
        Un connecteur pour demander à Claude — sur le site, l’app iPhone ou l’ordinateur — de tenir tes recettes et ton menu, ta liste de
        courses, et d’enregistrer une course d’après la photo du ticket de caisse. Les autres modules viendront ensuite.
      </p>
      {!remote ? (
        <p className="settings-hint claude-connector-local" role="note">
          Le connecteur demande un compte : Claude se connecte au serveur d’Atlas, et sur cet appareil Atlas fonctionne sans.
        </p>
      ) : (
        <>
          {fresh ? (
            <div className="claude-connector-fresh" role="status">
              <p className="claude-connector-label">Adresse</p>
              <code className="claude-connector-url">{connectorUrl}</code>
              <p className="claude-connector-label">En-tête de requête : nom</p>
              <code className="claude-connector-url">Authorization</code>
              <p className="claude-connector-label">En-tête de requête : valeur (la clé, à garder secrète)</p>
              <code className="claude-connector-url claude-connector-key">Bearer {fresh}</code>
              <div className="settings-actions">
                <Copy text={connectorUrl} label="Copier l’adresse" />
                <Copy text={`Bearer ${fresh}`} label="Copier la valeur" />
              </div>
              <ol className="claude-connector-steps">
                <li>Dans Claude : Réglages → Connecteurs → Ajouter un connecteur personnalisé.</li>
                <li>Nom : « Atlas » ; adresse : celle-ci.</li>
                <li>Authentification : « Aucune connexion » ; dans « En-têtes de requête », le nom et la valeur ci-dessus.</li>
                <li>Dans une conversation, active le connecteur Atlas, puis : « ajoute cette recette… », « enregistre ce ticket ».</li>
              </ol>
              <p className="settings-hint">
                La clé ne s’affichera plus : Claude la garde à l’abri. Qui l’a peut agir sur tes recettes et tes courses ; si elle t’échappe,
                révoque-la ici et crée-en une autre.
              </p>
            </div>
          ) : (
            <div className="settings-actions">
              <button type="button" className="btn btn-sm" onClick={() => void create()}>
                Créer une clé pour Claude
              </button>
            </div>
          )}
          {tokens.length > 0 && (
            <ul className="claude-connector-tokens">
              {tokens.map((t) => (
                <li key={t.id}>
                  <span>
                    Clé créée le {dateFr(t.createdAt)}
                    {t.lastUsedAt ? ` · utilisée le ${dateFr(t.lastUsedAt)}` : ' · pas encore utilisée'}
                  </span>
                  {revoking === t.id ? (
                    <span className="claude-connector-confirm">
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => void revoke(t.id)}>
                        Révoquer pour de bon
                      </button>
                      <button type="button" className="btn btn-sm" onClick={() => setRevoking(null)}>
                        Garder
                      </button>
                    </span>
                  ) : (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRevoking(t.id)}>
                      Révoquer
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      {problem && <p className="settings-problem">{problem}</p>}
    </section>
  );
}
