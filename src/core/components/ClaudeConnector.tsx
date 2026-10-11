import { useEffect, useState } from 'react';
import { coreStore, supabaseConfig } from '../data';
import type { McpToken } from '../data/coreStore';
import { hashToken, newSecretToken } from '../lib/secretToken';

const dateFr = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

/** L'adresse du connecteur : la fonction `atlas-mcp`, suivie du jeton. */
export const connectorUrl = (token: string) =>
  supabaseConfig ? `${supabaseConfig.url.replace(/\/$/, '')}/functions/v1/atlas-mcp/${token}` : '';

/**
 * Le connecteur de Claude (docs/connecteur-claude.md) : une adresse secrète à
 * coller dans Claude (Réglages → Connecteurs → connecteur personnalisé). Elle
 * porte un jeton tiré ici, montré une fois ; seule son empreinte part en base,
 * comme le jeton du raccourci de Sport. Révoquer un jeton coupe Claude aussitôt.
 */
export function ClaudeConnector({ remote }: { remote: boolean }) {
  const [tokens, setTokens] = useState<McpToken[]>([]);
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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
        Un connecteur pour demander à Claude — sur le site, l’app iPhone ou l’ordinateur — d’ajouter, de modifier ou de supprimer tes
        recettes, et de tenir ton menu. Les autres modules viendront ensuite.
      </p>
      {!remote ? (
        <p className="settings-hint claude-connector-local" role="note">
          Le connecteur demande un compte : Claude se connecte au serveur d’Atlas, et sur cet appareil Atlas fonctionne sans.
        </p>
      ) : (
        <>
          {fresh ? (
            <div className="claude-connector-fresh" role="status">
              <code className="claude-connector-url">{connectorUrl(fresh)}</code>
              <div className="settings-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() =>
                    void navigator.clipboard?.writeText(connectorUrl(fresh)).then(
                      () => setCopied(true),
                      () => undefined,
                    )
                  }
                >
                  {copied ? 'Copiée ✓' : 'Copier l’adresse'}
                </button>
              </div>
              <ol className="claude-connector-steps">
                <li>Dans Claude : Réglages → Connecteurs → Ajouter un connecteur personnalisé.</li>
                <li>Nom : « Atlas » ; adresse : celle-ci. Rien d’autre à remplir.</li>
                <li>Dans une conversation, active le connecteur Atlas, puis demande : « ajoute cette recette… ».</li>
              </ol>
              <p className="settings-hint">
                Elle ne s’affichera plus : garde-la pour toi. Qui l’a peut modifier tes recettes ; si elle t’échappe, révoque-la ici.
              </p>
            </div>
          ) : (
            <div className="settings-actions">
              <button type="button" className="btn btn-sm" onClick={() => void create()}>
                Créer l’adresse du connecteur
              </button>
            </div>
          )}
          {tokens.length > 0 && (
            <ul className="claude-connector-tokens">
              {tokens.map((t) => (
                <li key={t.id}>
                  <span>
                    Adresse créée le {dateFr(t.createdAt)}
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
