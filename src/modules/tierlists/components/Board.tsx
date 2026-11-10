import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { prepareImage } from '../../../core/data/images/prepareImage';
import { tierlistsStore } from '../data';
import {
  applyMoves,
  endPosition,
  evacuatePlan,
  itemsIn,
  labelFromFileName,
  movePlan,
  nextTierColor,
  placeOrphans,
  resetPlan,
  sortTiers,
  tierMovePlan,
} from '../lib/board';
import { IMAGE_SIZES, ITEM_LABEL_MAX, type Tier, type TierColor, type TierItem, type TierList, type TierListInput } from '../lib/types';
import { ItemDialog } from './ItemDialog';
import { ItemImage, forgetImage } from './ItemImage';
import { ListDialog } from './ListDialog';
import { TierDialog } from './TierDialog';
import { useDrag } from './useDrag';

const colorVar = (color: TierColor) => ({ ['--tierlists-color' as string]: `var(--${color})` }) as CSSProperties;

/** Ce qu'une tuile montre : l'image, le texte, ou les deux. */
function TileContent({ item }: { item: TierItem }) {
  return (
    <>
      {item.image && <ItemImage item={item} size="thumb" />}
      {item.label && <span className="tierlists-tile-label">{item.label}</span>}
    </>
  );
}

type TierEdit = { tier: Tier } | { tier: null; label: string; color: TierColor };

/** Une tier list ouverte : les rangées, la réserve « À classer », l'ajout d'éléments. */
export function Board({ list, onBack, onChanged, onDeleted, onError }: {
  list: TierList;
  onBack: () => void;
  onChanged: (list: TierList) => void;
  onDeleted: () => void;
  onError: (message: string) => void;
}) {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [items, setItems] = useState<TierItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(0);
  const [openItem, setOpenItem] = useState<string | null>(null);
  const [tierEdit, setTierEdit] = useState<TierEdit | null>(null);
  const [editingList, setEditingList] = useState(false);
  const [fileOver, setFileOver] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const fail = useCallback((err: unknown, fallback: string) => onError(err instanceof Error ? err.message : fallback), [onError]);

  const reload = useCallback(async () => {
    try {
      const [t, i] = await Promise.all([tierlistsStore.listTiers(list.id), tierlistsStore.listItems(list.id)]);
      setTiers(t);
      setItems(i);
    } catch (err) {
      fail(err, 'La tier list n’a pas pu être chargée.');
    } finally {
      setLoaded(true);
    }
  }, [list.id, fail]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const ordered = useMemo(() => sortTiers(tiers), [tiers]);
  const placed = useMemo(() => placeOrphans(items, tiers), [items, tiers]);
  const reserve = useMemo(() => itemsIn(placed, null), [placed]);

  /** Déplacer : l'écran d'abord, le stockage ensuite ; un échec recharge ce qui est vrai. */
  const move = useCallback(
    async (moves: ReturnType<typeof movePlan>) => {
      if (moves.length === 0) return;
      setItems((current) => applyMoves(current, moves));
      try {
        await tierlistsStore.moveItems(moves);
      } catch (err) {
        fail(err, 'Le déplacement n’a pas été enregistré.');
        void reload();
      }
    },
    [fail, reload],
  );

  const { drag, start, justDragged } = useDrag((item, tierId, index) => void move(movePlan(placed, item.id, tierId, index)));

  // --- Ajouter ------------------------------------------------------------------------------------
  const addText = async (source: string) => {
    const lines = source
      .split('\n')
      .map((l) => l.trim().slice(0, ITEM_LABEL_MAX))
      .filter(Boolean);
    if (lines.length === 0) return;
    let position = endPosition(placed, null);
    for (const label of lines) {
      try {
        const item = await tierlistsStore.createItem({ listId: list.id, tierId: null, label, position: position++ });
        setItems((current) => [...current, item]);
      } catch (err) {
        fail(err, 'L’élément n’a pas pu être ajouté.');
        return;
      }
    }
  };

  const addImages = async (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith('image/'));
    if (images.length === 0) return;
    setUploading((n) => n + images.length);
    let position = endPosition(placed, null);
    let failed = 0;
    for (const file of images) {
      try {
        const prepared = await prepareImage(file, IMAGE_SIZES);
        const item = await tierlistsStore.createItem(
          { listId: list.id, tierId: null, label: labelFromFileName(file.name), position: position++ },
          prepared,
        );
        setItems((current) => [...current, item]);
      } catch {
        failed++;
      } finally {
        setUploading((n) => n - 1);
      }
    }
    if (failed) onError(`${failed} image${failed > 1 ? 's n’ont' : ' n’a'} pas pu être ajoutée${failed > 1 ? 's' : ''}.`);
  };
  const addImagesRef = useRef(addImages);
  useEffect(() => {
    addImagesRef.current = addImages;
  });

  // Coller une image (⌘V) l'ajoute à classer — pratique depuis un site ouvert à côté.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'));
      if (files.length === 0) return;
      e.preventDefault();
      void addImagesRef.current(files);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, []);

  // --- Rangées ------------------------------------------------------------------------------------
  const saveTier = async (edit: TierEdit, patch: { label: string; color: TierColor }) => {
    const existing = edit.tier;
    if (existing) {
      await tierlistsStore.updateTiers([{ id: existing.id, patch }]);
      setTiers((current) => current.map((t) => (t.id === existing.id ? { ...t, ...patch } : t)));
    } else {
      const position = ordered.length === 0 ? 0 : Math.max(...ordered.map((t) => t.position)) + 1;
      const tier = await tierlistsStore.createTier({ listId: list.id, ...patch, position });
      setTiers((current) => [...current, tier]);
    }
    setTierEdit(null);
  };

  const moveTier = async (tier: Tier, direction: -1 | 1) => {
    const plan = tierMovePlan(tiers, tier.id, direction);
    await tierlistsStore.updateTiers(plan.map((p) => ({ id: p.id, patch: { position: p.position } })));
    const byId = new Map(plan.map((p) => [p.id, p.position]));
    setTiers((current) => current.map((t) => (byId.has(t.id) ? { ...t, position: byId.get(t.id)! } : t)));
    setTierEdit(null);
  };

  const deleteTier = async (tier: Tier) => {
    // Ses éléments partent d'abord au bout de la réserve, dans leur ordre.
    const moves = evacuatePlan(placed, tier.id);
    await tierlistsStore.moveItems(moves);
    await tierlistsStore.deleteTier(tier.id);
    setItems((current) => applyMoves(current, moves));
    setTiers((current) => current.filter((t) => t.id !== tier.id));
    setTierEdit(null);
  };

  // --- La liste -----------------------------------------------------------------------------------
  const saveList = async (input: TierListInput) => {
    await tierlistsStore.updateList(list.id, input);
    onChanged({ ...list, ...input, title: input.title.trim(), updatedAt: new Date().toISOString() });
    setEditingList(false);
  };

  const resetAll = async () => {
    await move(resetPlan(placed, tiers));
    setEditingList(false);
  };

  const deleteList = async () => {
    await tierlistsStore.deleteList(list.id);
    items.forEach(forgetImage);
    onDeleted();
  };

  const item = openItem ? placed.find((i) => i.id === openItem) ?? null : null;

  const tile = (i: TierItem) => (
    <button
      key={i.id}
      type="button"
      data-item-id={i.id}
      className={`tierlists-tile${i.image ? ' has-image' : ' is-text'}${drag?.item.id === i.id ? ' is-dragging' : ''}`}
      title={i.label || undefined}
      onPointerDown={(e) => start(e, i)}
      onClick={() => !justDragged.current && setOpenItem(i.id)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <TileContent item={i} />
    </button>
  );

  return (
    <div
      className={`tierlists-board${drag ? ' is-dragging' : ''}${fileOver ? ' is-file-over' : ''}`}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        setFileOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setFileOver(false);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setFileOver(false);
        void addImages([...e.dataTransfer.files]);
      }}
    >
      <div className="tierlists-board-head">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>
          ← Mes tier lists
        </button>
        <div className="tierlists-board-title">
          <h1>{list.title}</h1>
          {list.description && <p>{list.description}</p>}
        </div>
        <button className="btn btn-sm" onClick={() => setEditingList(true)}>
          ✎ Modifier
        </button>
      </div>

      {loaded && (
        <div className="tierlists-grid" role="list" aria-label="Rangées">
          {ordered.map((t) => {
            const inTier = itemsIn(placed, t.id);
            return (
              <div
                key={t.id}
                role="listitem"
                className={`tierlists-row${drag?.target?.tierId === t.id ? ' is-target' : ''}`}
                data-tier-drop={t.id}
                style={colorVar(t.color)}
              >
                <button className="tierlists-row-label" onClick={() => setTierEdit({ tier: t })} aria-label={`Rangée ${t.label}, la modifier`}>
                  {t.label}
                </button>
                <div className="tierlists-row-items" data-tier-items>
                  {inTier.map(tile)}
                </div>
              </div>
            );
          })}
          <button
            className="tierlists-add-tier"
            onClick={() => setTierEdit({ tier: null, label: String.fromCharCode(65 + Math.min(ordered.length, 25)), color: nextTierColor(tiers) })}
          >
            + Ajouter une rangée
          </button>
        </div>
      )}

      <section className={`tierlists-reserve${drag?.target && drag.target.tierId === null ? ' is-target' : ''}`} data-tier-drop="reserve" aria-label="À classer">
        <div className="tierlists-reserve-head">
          <h2>À classer</h2>
          <span className="tierlists-count">{reserve.length}</span>
          {uploading > 0 && <span className="tierlists-uploading">Ajout de {uploading} image{uploading > 1 ? 's' : ''}…</span>}
        </div>
        <div className="tierlists-row-items tierlists-reserve-items" data-tier-items>
          {reserve.map(tile)}
          {loaded && reserve.length === 0 && items.length === 0 && (
            <p className="tierlists-hint">Ajoute ce que tu veux classer : du texte, ou des images (bouton, glisser un fichier, ou coller).</p>
          )}
          {loaded && reserve.length === 0 && items.length > 0 && <p className="tierlists-hint">Tout est classé.</p>}
        </div>
        <form
          className="tierlists-add"
          onSubmit={(e) => {
            e.preventDefault();
            setText('');
            void addText(text);
          }}
        >
          <input
            aria-label="Nouvel élément"
            value={text}
            placeholder="Un élément à classer…"
            maxLength={ITEM_LABEL_MAX * 20}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => {
              // Plusieurs lignes collées : un élément par ligne, d'un coup.
              const pasted = e.clipboardData.getData('text');
              if (!pasted.includes('\n')) return;
              e.preventDefault();
              setText('');
              void addText(`${text}${pasted}`);
            }}
          />
          <button className="btn btn-primary btn-sm" type="submit" disabled={!text.trim()}>
            Ajouter
          </button>
          <button className="btn btn-sm" type="button" onClick={() => fileInput.current?.click()}>
            🖼 Images
          </button>
          <input
            ref={fileInput}
            className="tierlists-file"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => {
              const files = [...(e.target.files ?? [])];
              e.target.value = '';
              void addImages(files);
            }}
          />
        </form>
      </section>

      {drag && (
        <>
          <div
            className={`tierlists-tile tierlists-ghost${drag.item.image ? ' has-image' : ' is-text'}`}
            style={{ left: drag.x - drag.dx, top: drag.y - drag.dy, width: drag.width, height: drag.height }}
            aria-hidden="true"
          >
            <TileContent item={drag.item} />
          </div>
          {drag.target && (
            <div className="tierlists-drop-bar" style={{ left: drag.target.bar.x, top: drag.target.bar.y, height: drag.target.bar.h }} aria-hidden="true" />
          )}
        </>
      )}

      {item && (
        <ItemDialog
          item={item}
          tiers={ordered}
          onClose={() => setOpenItem(null)}
          onRename={async (label) => {
            await tierlistsStore.updateItemLabel(item.id, label);
            setItems((current) => current.map((i) => (i.id === item.id ? { ...i, label } : i)));
            setOpenItem(null);
          }}
          onSend={async (tierId) => {
            await move(movePlan(placed, item.id, tierId, endPosition(placed, tierId)));
            setOpenItem(null);
          }}
          onDelete={async () => {
            await tierlistsStore.deleteItem(item);
            forgetImage(item);
            setItems((current) => current.filter((i) => i.id !== item.id));
            setOpenItem(null);
          }}
        />
      )}

      {tierEdit && (
        <TierDialog
          tier={tierEdit.tier ?? { label: tierEdit.label, color: tierEdit.color }}
          isFirst={tierEdit.tier ? ordered[0]?.id === tierEdit.tier.id : true}
          isLast={tierEdit.tier ? ordered.at(-1)?.id === tierEdit.tier.id : true}
          count={tierEdit.tier ? itemsIn(placed, tierEdit.tier.id).length : 0}
          onClose={() => setTierEdit(null)}
          onSave={(patch) => saveTier(tierEdit, patch)}
          onMove={tierEdit.tier ? (direction) => moveTier(tierEdit.tier!, direction) : undefined}
          onDelete={tierEdit.tier ? () => deleteTier(tierEdit.tier!) : undefined}
        />
      )}

      {editingList && <ListDialog list={list} onClose={() => setEditingList(false)} onSave={saveList} onReset={resetAll} onDelete={deleteList} />}
    </div>
  );
}
