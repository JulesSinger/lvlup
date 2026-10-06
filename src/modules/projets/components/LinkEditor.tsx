import { useState } from 'react';
import { ACCESS_KINDS, LINK_KIND_LABELS, validateLink } from '../lib/links';
import { LINK_KINDS, type LinkKind, type ProjectLink, type ProjectLinkPatch } from '../lib/types';
import { Modal } from './Modal';
import { useSaving } from './useSaving';

interface Props {
  /** `null` : un nouveau lien */
  link: ProjectLink | null;
  onClose: () => void;
  onSave: (patch: Required<Omit<ProjectLinkPatch, 'position'>>) => Promise<void>;
  onDelete?: () => Promise<void>;
}

/** Un lien ou un accès : sorte, nom, adresse, identifiant — jamais de mot de passe (§3.7). */
export function LinkEditor({ link, onClose, onSave, onDelete }: Props) {
  const [kind, setKind] = useState<LinkKind>(link?.kind ?? 'maquette');
  const [label, setLabel] = useState(link?.label ?? '');
  const [url, setUrl] = useState(link?.url ?? '');
  const [login, setLogin] = useState(link?.login ?? '');
  const [note, setNote] = useState(link?.note ?? '');
  const [labelTouched, setLabelTouched] = useState(link !== null);
  const { saving, error, setError, run } = useSaving();
  const access = ACCESS_KINDS.includes(kind);

  function chooseKind(k: LinkKind) {
    setKind(k);
    if (!labelTouched) setLabel(LINK_KIND_LABELS[k]);
  }

  function submit() {
    const input = { kind, label: label.trim(), url: url.trim(), login: login.trim(), note: note.trim() };
    const problem = validateLink(input);
    if (problem) return setError(problem);
    void run(() => onSave(input));
  }

  return (
    <Modal
      title={link ? 'Modifier le lien' : 'Nouveau lien'}
      onClose={onClose}
      footer={
        <>
          {link && onDelete && (
            <button className="btn btn-ghost btn-sm btn-danger" disabled={saving} onClick={() => window.confirm(`Retirer « ${link.label} » ?`) && void run(onDelete)}>
              Retirer
            </button>
          )}
          <span className="projets-spacer" />
          <button className="btn" onClick={onClose}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {link ? 'Enregistrer' : 'Ajouter'}
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="projets-link-kind">Sorte</label>
        <select id="projets-link-kind" value={kind} onChange={(e) => chooseKind(e.target.value as LinkKind)}>
          {LINK_KINDS.map((k) => (
            <option key={k} value={k}>
              {LINK_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="projets-link-label">Nom</label>
        <input
          id="projets-link-label"
          value={label}
          placeholder={access ? 'OVH, Hostinger, WordPress…' : 'Maquette Figma, dossier de Lou…'}
          onChange={(e) => {
            setLabel(e.target.value);
            setLabelTouched(true);
          }}
          autoFocus={link !== null}
        />
      </div>
      <div className="field">
        <label htmlFor="projets-link-url">Adresse</label>
        <input id="projets-link-url" inputMode="url" value={url} placeholder="https://…" onChange={(e) => setUrl(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="projets-link-login">Identifiant{access ? '' : ' (facultatif)'}</label>
        <input id="projets-link-login" autoComplete="off" value={login} placeholder="lou@fleursdelou.fr" onChange={(e) => setLogin(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="projets-link-note">Note</label>
        <input id="projets-link-note" value={note} placeholder={access ? 'Mot de passe dans Bitwarden · compte au nom de la cliente' : ''} onChange={(e) => setNote(e.target.value)} />
      </div>
      <p className="projets-hint">🔒 Jamais de mot de passe ici : Atlas n’est pas un coffre-fort. Note plutôt où il est rangé.</p>
      {error && <div className="notice error">{error}</div>}
    </Modal>
  );
}
