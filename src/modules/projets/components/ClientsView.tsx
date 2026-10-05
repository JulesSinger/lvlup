import { TRADE_LABELS } from '../lib/status';
import type { Client, Project } from '../lib/types';

interface Props {
  clients: readonly Client[];
  projects: readonly Project[];
  onEdit: (client: Client) => void;
  onOpenProject: (projectId: string) => void;
}

/** Les clients, chacun avec ses coordonnées et ses projets. Toucher un numéro appelle. */
export function ClientsView({ clients, projects, onEdit, onOpenProject }: Props) {
  if (clients.length === 0) return <p className="projets-hint">Aucun client. Il se crée avec son premier projet, ou ici.</p>;
  const sorted = [...clients].sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name, 'fr'));
  return (
    <ul className="projets-clients">
      {sorted.map((c) => {
        const own = projects.filter((p) => p.clientId === c.id).sort((a, b) => b.number - a.number);
        return (
          <li key={c.id} className={`projets-client${c.archived ? ' archived' : ''}`}>
            <div className="projets-client-head">
              <b>{c.name}</b>
              <span className="projets-client-trade">{TRADE_LABELS[c.trade]}</span>
              {c.archived && <span className="projets-client-trade">archivé</span>}
              <span className="projets-spacer" />
              <button type="button" className="btn btn-ghost btn-sm" aria-label={`Modifier ${c.name}`} onClick={() => onEdit(c)}>
                ✎
              </button>
            </div>
            {(c.contactName || c.phone || c.email) && (
              <p className="projets-client-contact">
                {c.contactName}
                {c.phone && (
                  <>
                    {c.contactName && ' · '}
                    <a href={`tel:${c.phone.replace(/\s/g, '')}`}>{c.phone}</a>
                  </>
                )}
                {c.email && (
                  <>
                    {(c.contactName || c.phone) && ' · '}
                    <a href={`mailto:${c.email}`}>{c.email}</a>
                  </>
                )}
              </p>
            )}
            {own.length > 0 && (
              <div className="projets-chips">
                {own.map((p) => (
                  <button key={p.id} type="button" className="projets-chip" onClick={() => onOpenProject(p.id)}>
                    {p.title}
                  </button>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
