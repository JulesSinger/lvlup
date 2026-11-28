import { useEffect, useMemo, useState } from 'react';
import { findItemLoosely } from '../lib/catalog';
import { linesOf } from '../lib/templates';
import type { Item, ListEntry, ListTemplate, TemplateLine } from '../lib/types';

/** Ce que l'écran fait pour la fenêtre : chaque geste rejette en cas d'échec, et la fenêtre le dit. */
export interface TemplateActions {
  /** `fromList` : la liste en cours devient le modèle. */
  create(name: string, fromList: boolean): Promise<ListTemplate>;
  rename(template: ListTemplate, name: string, emoji: string): Promise<void>;
  remove(template: ListTemplate): Promise<void>;
  /** Un article retrouvé par son nom (au pluriel près), ou créé dans son rayon deviné. */
  addLine(template: ListTemplate, name: string, quantity: string): Promise<void>;
  updateLine(line: TemplateLine, quantity: string): Promise<void>;
  removeLine(line: TemplateLine): Promise<void>;
  /** Remplir la liste avec ce modèle, sauf les lignes décochées. */
  apply(template: ListTemplate, skip: ReadonlySet<string>): Promise<void>;
}

interface Props {
  templates: ListTemplate[];
  lines: TemplateLine[];
  items: Item[];
  entries: ListEntry[];
  actions: TemplateActions;
  /** Ouvrir directement l'aperçu de ce modèle (un raccourci de la liste). */
  initialApply?: string;
  onClose: () => void;
}

type Mode = { kind: 'list' } | { kind: 'apply'; id: string } | { kind: 'edit'; id: string };

/**
 * Les modèles de liste (docs/etude-courses.md §20) : une liste toute faite
 * qu'on choisit pour remplir la liste en cours, avant d'y ajouter le
 * ponctuel. Trois vues dans la même fenêtre : les modèles, l'aperçu avant de
 * remplir (on décoche ce qu'on a encore), et la modification d'un modèle.
 */
export function TemplatesDialog({ templates, lines, items, entries, actions, initialApply, onClose }: Props) {
  const [mode, setMode] = useState<Mode>(initialApply ? { kind: 'apply', id: initialApply } : { kind: 'list' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
    } finally {
      setBusy(false);
    }
  }

  const current = mode.kind === 'list' ? null : templates.find((t) => t.id === mode.id) ?? null;
  // Un modèle supprimé pendant qu'on le regardait : retour à la liste.
  useEffect(() => {
    if (mode.kind !== 'list' && !current) setMode({ kind: 'list' });
  }, [mode, current]);

  const title = !current ? 'Modèles de liste' : mode.kind === 'apply' ? `Remplir avec « ${current.name} »` : `Modifier « ${current.name} »`;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal courses-templates" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          {current && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode({ kind: 'list' })} aria-label="Retour aux modèles">
              ←
            </button>
          )}
          <span className="modal-title">{title}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {!current ? (
            <TemplateList
              templates={templates}
              lines={lines}
              entries={entries}
              busy={busy}
              onApply={(t) => setMode({ kind: 'apply', id: t.id })}
              onEdit={(t) => setMode({ kind: 'edit', id: t.id })}
              onCreate={(name, fromList) =>
                run(async () => {
                  const t = await actions.create(name, fromList);
                  // Un modèle vide s'ouvre pour qu'on le remplisse ; fait depuis la liste, il est prêt.
                  if (!fromList) setMode({ kind: 'edit', id: t.id });
                })
              }
            />
          ) : mode.kind === 'apply' ? (
            <TemplateApply
              lines={linesOf(lines, current.id)}
              items={items}
              entries={entries}
              busy={busy}
              onEdit={() => setMode({ kind: 'edit', id: current.id })}
              onApply={(skip) => run(() => actions.apply(current, skip))}
            />
          ) : (
            <TemplateEditor
              key={current.id}
              template={current}
              lines={linesOf(lines, current.id)}
              items={items}
              busy={busy}
              run={run}
              actions={actions}
              onApply={() => setMode({ kind: 'apply', id: current.id })}
            />
          )}
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TemplateList({ templates, lines, entries, busy, onApply, onEdit, onCreate }: {
  templates: ListTemplate[];
  lines: TemplateLine[];
  entries: ListEntry[];
  busy: boolean;
  onApply: (t: ListTemplate) => void;
  onEdit: (t: ListTemplate) => void;
  onCreate: (name: string, fromList: boolean) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const create = (fromList: boolean) => void onCreate(name, fromList).then(() => setName(''));
  return (
    <>
      {templates.length === 0 ? (
        <p className="courses-templates-empty">
          Aucun modèle pour l’instant. Un modèle, c’est une liste toute faite — « Semaine type », « Raclette » — qui remplit ta
          liste d’un geste ; tu ajoutes ensuite ce qui manque.
        </p>
      ) : (
        <ul className="courses-templates-list">
          {templates.map((t) => {
            const count = linesOf(lines, t.id).length;
            return (
              <li key={t.id} className="courses-template-row">
                <span className="courses-template-emoji" aria-hidden="true">
                  {t.emoji}
                </span>
                <span className="courses-template-name">
                  <b>{t.name}</b>
                  <span className="courses-template-count">
                    {count} article{count > 1 ? 's' : ''}
                  </span>
                </span>
                <button type="button" className="btn btn-sm" onClick={() => onEdit(t)} aria-label={`Modifier ${t.name}`}>
                  Modifier
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => onApply(t)} disabled={count === 0} aria-label={`Remplir la liste avec ${t.name}`}>
                  Remplir la liste
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="courses-template-new">
        <label htmlFor="courses-template-name" className="courses-editor-caption">
          Nouveau modèle
        </label>
        <input
          id="courses-template-name"
          type="text"
          value={name}
          maxLength={80}
          placeholder="Semaine type, Raclette, Apéro…"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && create(false)}
        />
        <div className="courses-template-new-actions">
          <button type="button" className="btn btn-sm" disabled={busy || !name.trim()} onClick={() => create(false)}>
            Créer, puis le remplir
          </button>
          <button type="button" className="btn btn-sm" disabled={busy || !name.trim() || entries.length === 0} onClick={() => create(true)}>
            Depuis la liste actuelle ({entries.length})
          </button>
        </div>
      </div>
    </>
  );
}

function TemplateApply({ lines, items, entries, busy, onEdit, onApply }: {
  lines: TemplateLine[];
  items: Item[];
  entries: ListEntry[];
  busy: boolean;
  onEdit: () => void;
  onApply: (skip: ReadonlySet<string>) => Promise<void>;
}) {
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const onList = useMemo(() => new Set(entries.map((e) => e.itemId)), [entries]);
  const known = lines.filter((l) => byId.has(l.itemId));
  /** Les lignes décochées : « j'en ai encore ». */
  const [skip, setSkip] = useState<Set<string>>(() => new Set());
  const chosen = known.length - known.filter((l) => skip.has(l.id)).length;
  return (
    <>
      <p className="courses-templates-hint">Décoche ce que tu as encore. Ce qui est déjà sur ta liste n’est pas doublé : sa quantité est complétée.</p>
      <ul className="courses-template-apply" aria-label="Articles du modèle">
        {known.map((l) => {
          const item = byId.get(l.itemId)!;
          return (
            <li key={l.id}>
              <label className="courses-template-check">
                <input
                  type="checkbox"
                  checked={!skip.has(l.id)}
                  onChange={(e) =>
                    setSkip((current) => {
                      const next = new Set(current);
                      if (e.target.checked) next.delete(l.id);
                      else next.add(l.id);
                      return next;
                    })
                  }
                />
                <span className="courses-template-line-name">{item.name}</span>
                {l.quantity && <span className="courses-template-line-qty">{l.quantity}</span>}
                {onList.has(item.id) && <span className="courses-template-line-tag">déjà sur la liste</span>}
              </label>
            </li>
          );
        })}
      </ul>
      <div className="modal-foot courses-editor-foot">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}>
          Modifier le modèle
        </button>
        <span className="courses-editor-spacer" />
        <button type="button" className="btn btn-primary" disabled={busy || chosen === 0} onClick={() => void onApply(skip)}>
          Ajouter à la liste ({chosen})
        </button>
      </div>
    </>
  );
}

function TemplateEditor({ template, lines, items, busy, run, actions, onApply }: {
  template: ListTemplate;
  lines: TemplateLine[];
  items: Item[];
  busy: boolean;
  run: (action: () => Promise<void>) => Promise<void>;
  actions: TemplateActions;
  onApply: () => void;
}) {
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const [name, setName] = useState(template.name);
  const [emoji, setEmoji] = useState(template.emoji);
  const [newName, setNewName] = useState('');
  const [newQty, setNewQty] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const known = lines.filter((l) => byId.has(l.itemId));
  const already = newName.trim() ? findItemLoosely(items, newName.trim()) : null;
  const duplicate = already !== null && known.some((l) => l.itemId === already.id);

  const saveName = () => {
    if (name.trim() === template.name && emoji === template.emoji) return;
    void run(() => actions.rename(template, name, emoji));
  };
  const add = () => {
    if (!newName.trim() || duplicate) return;
    void run(async () => {
      await actions.addLine(template, newName.trim(), newQty.trim());
      setNewName('');
      setNewQty('');
    });
  };

  return (
    <>
      <div className="courses-template-title">
        <div className="field courses-template-emoji-field">
          <label htmlFor="courses-template-emoji">Icône</label>
          <input id="courses-template-emoji" type="text" value={emoji} maxLength={8} onChange={(e) => setEmoji(e.target.value)} onBlur={saveName} />
        </div>
        <div className="field">
          <label htmlFor="courses-template-rename">Nom</label>
          <input id="courses-template-rename" type="text" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} onBlur={saveName} />
        </div>
      </div>

      {known.length === 0 ? (
        <p className="courses-templates-hint">Ajoute les articles de ce modèle ci-dessous, avec leur quantité.</p>
      ) : (
        <ul className="courses-template-lines" aria-label="Articles du modèle">
          {known.map((l) => (
            <TemplateLineRow key={l.id} line={l} item={byId.get(l.itemId)!} onQuantity={(q) => run(() => actions.updateLine(l, q))} onRemove={() => run(() => actions.removeLine(l))} />
          ))}
        </ul>
      )}

      <div className="courses-template-add">
        <input
          type="text"
          aria-label="Article à ajouter au modèle"
          placeholder="Article : lardons, crème…"
          list="courses-template-catalog"
          value={newName}
          maxLength={80}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <input
          type="text"
          aria-label="Quantité"
          placeholder="Quantité"
          className="courses-template-qty-input"
          value={newQty}
          maxLength={30}
          onChange={(e) => setNewQty(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button type="button" className="btn btn-sm" disabled={busy || !newName.trim() || duplicate} onClick={add}>
          Ajouter
        </button>
        <datalist id="courses-template-catalog">
          {items.map((i) => (
            <option key={i.id} value={i.name} />
          ))}
        </datalist>
      </div>
      {duplicate && <p className="field-hint">« {already!.name} » est déjà dans ce modèle : change sa quantité plus haut.</p>}

      <div className="modal-foot courses-editor-foot">
        {confirmDelete ? (
          <>
            <span className="courses-template-confirm">Supprimer « {template.name} » ? Ta liste n’est pas touchée.</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>
              Non
            </button>
            <button type="button" className="btn btn-sm btn-danger" disabled={busy} onClick={() => void run(() => actions.remove(template))}>
              Oui, supprimer
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-ghost btn-sm btn-danger" onClick={() => setConfirmDelete(true)}>
              Supprimer le modèle
            </button>
            <span className="courses-editor-spacer" />
            <button type="button" className="btn btn-primary" disabled={known.length === 0} onClick={onApply}>
              Remplir la liste avec ce modèle
            </button>
          </>
        )}
      </div>
    </>
  );
}

function TemplateLineRow({ line, item, onQuantity, onRemove }: { line: TemplateLine; item: Item; onQuantity: (q: string) => Promise<void>; onRemove: () => Promise<void> }) {
  const [quantity, setQuantity] = useState(line.quantity);
  useEffect(() => setQuantity(line.quantity), [line.quantity]);
  return (
    <li className="courses-template-line">
      <span className="courses-template-line-name">{item.name}</span>
      <input
        type="text"
        className="courses-template-qty-input"
        aria-label={`Quantité de ${item.name}`}
        placeholder="Quantité"
        value={quantity}
        maxLength={30}
        onChange={(e) => setQuantity(e.target.value)}
        onBlur={() => quantity.trim() !== line.quantity && void onQuantity(quantity.trim())}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <button type="button" className="btn btn-ghost btn-sm" aria-label={`Retirer ${item.name} du modèle`} onClick={() => void onRemove()}>
        ✕
      </button>
    </li>
  );
}
