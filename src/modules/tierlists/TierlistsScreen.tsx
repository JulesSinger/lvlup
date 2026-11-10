import { useCallback, useEffect, useState } from 'react';
import { ModuleBrand } from '../../core/components/ModuleBrand';
import type { ModuleScreenProps } from '../../core/lib/module';
import { Board } from './components/Board';
import { ListDialog } from './components/ListDialog';
import { tierlistsStore } from './data';
import type { TierList } from './lib/types';

const DAY = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });

/**
 * L'écran du module : la grille de ses tier lists, puis une liste ouverte.
 * `intent` « list:<id> » ouvre directement une liste.
 */
export function TierlistsScreen({ label, emoji, error, onError, onOpenSettings, onSwitchModule, reloadToken, intent }: ModuleScreenProps) {
  const [lists, setLists] = useState<TierList[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(intent?.startsWith('list:') ? intent.slice(5) : null);
  const [creating, setCreating] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setLists(await tierlistsStore.listLists());
    } catch (err) {
      setLists((current) => current ?? []);
      onError(err instanceof Error ? err.message : 'Les tier lists n’ont pas pu être chargées.');
    }
  }, [onError]);

  useEffect(() => {
    void refresh();
  }, [refresh, reloadToken]);

  const open = lists?.find((l) => l.id === openId) ?? null;

  const create = async (input: { title: string; description?: string }) => {
    const { list } = await tierlistsStore.createList(input);
    setLists((current) => [list, ...(current ?? [])]);
    setCreating(false);
    setOpenId(list.id);
  };

  return (
    <div className="layout">
      <main className="main tierlists-main">
        <header className="topbar">
          <ModuleBrand label={label} emoji={emoji} onSwitchModule={onSwitchModule} />
          <div className="topbar-actions">
            <button className="btn btn-ghost btn-sm" onClick={onOpenSettings} title="Réglages" aria-label="Réglages">
              ⚙️
            </button>
          </div>
        </header>

        {error && <div className="notice error">{error}</div>}

        {open ? (
          <Board
            key={open.id}
            list={open}
            onBack={() => {
              setOpenId(null);
              void refresh();
            }}
            onChanged={(list) => setLists((current) => (current ?? []).map((l) => (l.id === list.id ? list : l)))}
            onDeleted={() => {
              setLists((current) => (current ?? []).filter((l) => l.id !== open.id));
              setOpenId(null);
            }}
            onError={onError}
          />
        ) : lists === null ? null : lists.length === 0 ? (
          <section className="tierlists-empty">
            <span className="tierlists-empty-emblem" aria-hidden="true">
              🏆
            </span>
            <h1>Classe tout ce que tu veux</h1>
            <p>Champions, films, restos, jeux… Des rangées S, A, B, C, D que tu renommes à ton goût, du texte ou des images, et tu glisses chaque élément à sa place.</p>
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              Créer une tier list
            </button>
          </section>
        ) : (
          <section className="tierlists-lists">
            <div className="tierlists-lists-head">
              <h1>Mes tier lists</h1>
              <button className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
                + Nouvelle tier list
              </button>
            </div>
            <div className="tierlists-cards">
              {lists.map((l) => (
                <button key={l.id} className="tierlists-card" onClick={() => setOpenId(l.id)}>
                  <span className="tierlists-card-bars" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className="tierlists-card-title">{l.title}</span>
                  {l.description && <span className="tierlists-card-description">{l.description}</span>}
                  <span className="tierlists-card-date">Modifiée le {DAY.format(new Date(l.updatedAt))}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {creating && <ListDialog list={null} onClose={() => setCreating(false)} onSave={create} />}
      </main>
    </div>
  );
}
