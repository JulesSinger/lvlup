import { useState } from 'react';
import { displayUrl, LINK_KIND_ICONS, LINK_KIND_LABELS, safeHref, sortLinks } from '../lib/links';
import type { ProjectLink } from '../lib/types';

interface Props {
  links: readonly ProjectLink[];
  onAdd: () => void;
  onEdit: (link: ProjectLink) => void;
}

/** Les liens et les accès d'un projet (§3.6, §3.7), rangés par sorte. Toucher un identifiant le copie. */
export function LinksPanel({ links, onAdd, onEdit }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const sorted = sortLinks(links);

  function copy(link: ProjectLink) {
    void navigator.clipboard?.writeText(link.login).then(
      () => setCopied(link.id),
      () => {},
    );
  }

  return (
    <div className="projets-links">
      {sorted.length === 0 ? (
        <p className="projets-hint">Aucun lien. Ajoute la maquette, le dossier partagé du client, la préproduction, l’hébergeur…</p>
      ) : (
        <ul className="projets-link-list">
          {sorted.map((link) => {
            const href = safeHref(link.url);
            return (
              <li key={link.id} className="projets-link-row">
                <span className="projets-link-icon" aria-hidden="true">
                  {LINK_KIND_ICONS[link.kind]}
                </span>
                <div className="projets-link-main">
                  <span className="projets-link-label">
                    {href ? (
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        {link.label}
                      </a>
                    ) : (
                      link.label
                    )}
                    <span className="projets-link-kind">{LINK_KIND_LABELS[link.kind]}</span>
                  </span>
                  {link.url && <span className="projets-link-url">{displayUrl(link.url)}</span>}
                  {link.login && (
                    <button type="button" className="projets-link-login" aria-label={`Copier l’identifiant ${link.login}`} onClick={() => copy(link)}>
                      👤 {link.login} <span>{copied === link.id ? 'copié' : 'copier'}</span>
                    </button>
                  )}
                  {link.note && <span className="projets-link-note">{link.note}</span>}
                </div>
                <button type="button" className="btn btn-ghost btn-sm projets-edit-btn" aria-label={`Modifier ${link.label}`} onClick={() => onEdit(link)}>
                  ✎
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <button className="btn btn-ghost btn-sm projets-add-ws" onClick={onAdd}>
        + Ajouter un lien
      </button>
      <p className="projets-hint">🔒 Aucun mot de passe n’est gardé ici : Atlas n’est pas un coffre-fort.</p>
    </div>
  );
}
