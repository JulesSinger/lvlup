import { useCallback, useEffect, useMemo, useState } from 'react';
import { ModuleBrand } from '../../core/components/ModuleBrand';
import { dayString } from '../../core/lib/day';
import type { ModuleScreenProps } from '../../core/lib/module';
import { ArchiveImport } from './components/ArchiveImport';
import { Dashboard } from './components/Dashboard';
import { Journal } from './components/Journal';
import { RunEditor } from './components/RunEditor';
import { RunSheet } from './components/RunSheet';
import { sportStore as store } from './data';
import { DEFAULT_SPORT_SETTINGS, type Run, type RunImport, type RunInput, type SportSettings } from './lib/types';
import { hrZones } from './lib/zones';

type View = 'dash' | 'journal';

/** La dernière vue ouverte, retenue sur cet appareil — un confort, pas une donnée. */
const VIEW_KEY = 'sport.view.v1';

function savedView(): View {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === 'dash' || v === 'journal') return v;
  } catch {
    // Stockage refusé : le tableau de bord suffit.
  }
  return 'dash';
}

/**
 * Écran racine de Sport — étape 3 (docs/etude-sport.md §12) : reprendre
 * l'historique Strava, le journal des sorties, la fiche d'une sortie, la
 * saisie à la main, le tableau de bord et la fréquence cardiaque. Le plan
 * marathon arrive à l'étape 4.
 *
 * Toute la logique est dans les bibliothèques pures (`lib/`) : cet écran ne
 * fait qu'appeler le contrat de stockage et afficher.
 */
export function SportScreen({ error, onError, onOpenSettings, onSwitchModule, reloadToken, label, emoji }: ModuleScreenProps) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [settings, setSettings] = useState<SportSettings>({ ...DEFAULT_SPORT_SETTINGS });
  const [loaded, setLoaded] = useState(false);
  const [view, setViewState] = useState<View>(savedView);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Run | 'new' | null>(null);
  const [importing, setImporting] = useState(false);
  const today = dayString();

  const refresh = useCallback(async () => {
    try {
      const [nextRuns, nextSettings] = await Promise.all([store.listRuns(), store.getSettings()]);
      setRuns(nextRuns);
      setSettings(nextSettings);
      onError('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Chargement impossible.');
    } finally {
      setLoaded(true);
    }
  }, [onError]);

  useEffect(() => {
    void refresh();
  }, [refresh, reloadToken]);

  function setView(next: View) {
    setViewState(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Sans stockage, la vue n'est simplement pas retenue.
    }
  }

  const zones = useMemo(() => hrZones(settings), [settings]);
  const knownRefs = useMemo(() => new Set(runs.map((r) => r.sourceRef).filter((r): r is string => !!r)), [runs]);
  const open = runs.find((r) => r.id === openId) ?? null;

  async function saveRun(input: RunInput) {
    if (editing && editing !== 'new') await store.updateRun(editing.id, input);
    else await store.createRun({ ...input, source: 'manuel' });
    setEditing(null);
    await refresh();
  }

  async function deleteRun(id: string) {
    try {
      await store.deleteRun(id);
      setOpenId(null);
      await refresh();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Suppression impossible.');
    }
  }

  async function saveHr(patch: Pick<SportSettings, 'hrMax' | 'hrRest'>) {
    await store.updateSettings(patch);
    setSettings((s) => ({ ...s, ...patch }));
  }

  async function importRuns(list: RunImport[]) {
    const added = await store.importRuns(list);
    await refresh();
    return added;
  }

  return (
    <div className="layout">
      <main className="main sport-main">
        <header className="topbar">
          <ModuleBrand label={label} emoji={emoji} onSwitchModule={onSwitchModule} />
          <div className="topbar-actions">
            <button className="btn topbar-settings" onClick={onOpenSettings} title="Réglages" aria-label="Réglages">
              <span className="topbar-settings-icon" aria-hidden="true">
                ⚙
              </span>
              <span className="topbar-settings-label">Réglages</span>
            </button>
            <button className="btn btn-primary topbar-add" onClick={() => setEditing('new')} aria-label="Nouvelle sortie">
              <span aria-hidden="true">+</span>
              <span className="topbar-add-label">Sortie</span>
            </button>
          </div>
        </header>

        {error && (
          <div className="notice error">
            {error}{' '}
            <button className="btn btn-sm" style={{ marginLeft: 8 }} onClick={() => void refresh()}>
              Réessayer
            </button>
          </div>
        )}

        <nav className="sport-nav" aria-label="Vues">
          {(
            [
              ['dash', 'Tableau de bord', 0],
              ['journal', 'Journal', runs.length],
            ] as const
          ).map(([id, text, n]) => (
            <button
              key={id}
              type="button"
              className={`sport-nav-item${view === id ? ' on' : ''}`}
              aria-current={view === id ? 'page' : undefined}
              onClick={() => setView(id)}
            >
              {text}
              {n > 0 && <span className="sport-count">{n}</span>}
            </button>
          ))}
          <span className="sport-spacer" />
          <button type="button" className="btn btn-sm" onClick={() => setImporting(true)}>
            Reprendre l’historique Strava
          </button>
        </nav>

        {!loaded ? null : runs.length === 0 ? (
          <div className="sport-empty">
            <span className="sport-empty-emoji" aria-hidden="true">
              {emoji}
            </span>
            <h1 className="sport-empty-title">Aucune sortie pour l’instant</h1>
            <p className="sport-hint">Reprends ton historique Strava d’un coup, ou note ta prochaine sortie à la main.</p>
            <div className="sport-empty-actions">
              <button className="btn btn-primary" onClick={() => setImporting(true)}>
                Reprendre l’historique Strava
              </button>
              <button className="btn" onClick={() => setEditing('new')}>
                Noter une sortie
              </button>
            </div>
          </div>
        ) : view === 'dash' ? (
          <Dashboard runs={runs} settings={settings} today={today} onOpen={(r) => setOpenId(r.id)} onSaveHr={saveHr} />
        ) : (
          <Journal runs={runs} onOpen={(r) => setOpenId(r.id)} />
        )}

        {open && !editing && (
          <RunSheet
            run={open}
            zones={zones}
            onClose={() => setOpenId(null)}
            onEdit={() => setEditing(open)}
            onDelete={() => void deleteRun(open.id)}
          />
        )}

        {editing && <RunEditor run={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSave={saveRun} />}

        {importing && <ArchiveImport knownRefs={knownRefs} onImport={importRuns} onClose={() => setImporting(false)} />}
      </main>
    </div>
  );
}
