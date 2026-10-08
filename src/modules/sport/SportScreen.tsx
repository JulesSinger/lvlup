import { useCallback, useEffect, useMemo, useState } from 'react';
import { ModuleBrand } from '../../core/components/ModuleBrand';
import { dayString } from '../../core/lib/day';
import type { ModuleScreenProps } from '../../core/lib/module';
import { ArchiveImport } from './components/ArchiveImport';
import { ShortcutSetup } from './components/ShortcutSetup';
import { Dashboard } from './components/Dashboard';
import { Journal } from './components/Journal';
import { RunEditor } from './components/RunEditor';
import { RunSheet } from './components/RunSheet';
import { PlanCreator } from './components/PlanCreator';
import { PlanView } from './components/PlanView';
import { RaceDateEditor } from './components/RaceDateEditor';
import { SessionEditor } from './components/SessionEditor';
import { newId } from '../../core/data/coreStore';
import { importEndpoint, sportStore as store } from './data';
import { planDrafts, weekOfPlan, type PlanWeek } from './lib/plan';
import { assignRuns, planWeeks, reschedule } from './lib/planView';
import { longestRecent, recentWeeklyAverage } from './lib/stats';
import {
  DEFAULT_SPORT_SETTINGS,
  type Plan,
  type PlanInput,
  type PlanSession,
  type PlanSessionPatch,
  type Run,
  type RunImport,
  type RunInput,
  type SportSettings,
} from './lib/types';
import { hrZones } from './lib/zones';

type View = 'dash' | 'plan' | 'journal';

/** La dernière vue ouverte, retenue sur cet appareil — un confort, pas une donnée. */
const VIEW_KEY = 'sport.view.v1';

function savedView(): View {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === 'dash' || v === 'plan' || v === 'journal') return v;
  } catch {
    // Stockage refusé : le tableau de bord suffit.
  }
  return 'dash';
}

/**
 * Écran racine de Sport (docs/etude-sport.md §12) — étape 3 : reprendre
 * l'historique Strava, le journal des sorties, la fiche d'une sortie, la
 * saisie à la main, le tableau de bord et la fréquence cardiaque. Étape 4 :
 * le plan marathon — le créer, la semaine en cours et la séance suivante, les
 * sorties rattachées à leurs séances, modifier une séance, changer la date.
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
  const [linkingWatch, setLinkingWatch] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [sessions, setSessions] = useState<PlanSession[]>([]);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [editingSession, setEditingSession] = useState<PlanSession | null>(null);
  const [changingDate, setChangingDate] = useState(false);
  const today = dayString();

  const refresh = useCallback(async () => {
    try {
      const [nextRuns, nextSettings, nextPlans, nextSessions] = await Promise.all([
        store.listRuns(),
        store.getSettings(),
        store.listPlans(),
        store.listSessions(),
      ]);
      setRuns(nextRuns);
      setSettings(nextSettings);
      setPlans(nextPlans);
      setSessions(nextSessions);
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
  /** Le plan en cours : un seul à la fois (on supprime pour en refaire un). */
  const plan = plans.find((p) => p.status === 'actif') ?? null;
  const weeks = useMemo(() => (plan ? planWeeks(plan, sessions, runs, today) : []), [plan, sessions, runs, today]);
  const assigned = useMemo(() => (plan ? assignRuns(plan, sessions, runs) : new Map<string, Run>()), [plan, sessions, runs]);

  /** Ce dont la fiche d'une sortie a besoin pour choisir sa séance. */
  function planFor(run: Run) {
    if (!plan) return undefined;
    const week = weekOfPlan(plan.startDay, run.day);
    const inWeek = sessions.filter((s) => s.planId === plan.id && s.week === week).sort((a, b) => a.position - b.position);
    const auto = inWeek.find((s) => assigned.get(s.id)?.id === run.id) ?? null;
    return { sessions: inWeek, auto, onAssign: (sessionId: string | null) => void write(() => store.updateRun(run.id, { sessionId })) };
  }

  /** Une écriture, puis la relecture ; l'erreur s'affiche en haut. */
  async function write(action: () => Promise<void>) {
    try {
      await action();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Enregistrement impossible.');
    }
    await refresh();
  }

  async function createPlan(input: PlanInput, generated: PlanWeek[]) {
    const id = newId();
    // Le plan, puis ses séances : rejouable (ids choisis ici), au pire un plan sans séances, jamais deux plans.
    await store.createPlan(input, id);
    await store.addSessions(planDrafts(id, generated, newId));
    setCreatingPlan(false);
    setView('plan');
    await refresh();
  }

  async function saveSession(patch: PlanSessionPatch) {
    if (!editingSession) return;
    await store.updateSession(editingSession.id, patch);
    setEditingSession(null);
    await refresh();
  }

  async function changeRaceDay(raceDay: string, confirmed: boolean) {
    if (!plan) return;
    if (raceDay !== plan.raceDay) {
      const reference = plan.referenceDistanceM && plan.referenceS ? { distanceM: plan.referenceDistanceM, timeS: plan.referenceS } : null;
      const { removeIds, add } = reschedule(
        plan,
        sessions,
        { raceDay, reference, currentWeeklyM: recentWeeklyAverage(runs, today), longestRecentM: longestRecent(runs, today) },
        today,
        newId,
      );
      // Les nouvelles séances d'abord : une coupure laisse au pire des séances en double, jamais un plan vide.
      await store.addSessions(add);
      await store.deleteSessions(removeIds);
    }
    await store.updatePlan(plan.id, { raceDay, raceDayConfirmed: confirmed });
    setChangingDate(false);
    await refresh();
  }

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
              ['plan', 'Plan', 0],
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
          <button type="button" className="btn btn-sm" onClick={() => setLinkingWatch(true)}>
            ⌚ Apple Watch
          </button>
          <button type="button" className="btn btn-sm" onClick={() => setImporting(true)}>
            Reprendre l’historique Strava
          </button>
        </nav>

        {!loaded ? null : view === 'plan' ? (
          plan ? (
            <PlanView
              plan={plan}
              weeks={weeks}
              today={today}
              onEditSession={setEditingSession}
              onOpenRun={(r) => setOpenId(r.id)}
              onChangeDate={() => setChangingDate(true)}
              onDelete={() => void write(() => store.deletePlan(plan.id))}
            />
          ) : (
            <div className="sport-empty">
              <span className="sport-empty-emoji" aria-hidden="true">
                🏁
              </span>
              <h1 className="sport-empty-title">Prépare ton marathon</h1>
              <p className="sport-hint">Un plan semaine par semaine jusqu’à la course, construit sur ce que tu cours aujourd’hui.</p>
              <div className="sport-empty-actions">
                <button className="btn btn-primary" onClick={() => setCreatingPlan(true)}>
                  Créer le plan
                </button>
              </div>
            </div>
          )
        ) : runs.length === 0 ? (
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
              <button className="btn" onClick={() => setLinkingWatch(true)}>
                Relier l’Apple Watch
              </button>
              <button className="btn" onClick={() => setEditing('new')}>
                Noter une sortie
              </button>
            </div>
          </div>
        ) : view === 'dash' ? (
          <Dashboard
            runs={runs}
            settings={settings}
            today={today}
            onOpen={(r) => setOpenId(r.id)}
            onSaveHr={saveHr}
            plan={plan ? { plan, weeks, onOpen: () => setView('plan') } : null}
            onCreatePlan={() => setCreatingPlan(true)}
          />
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
            plan={planFor(open)}
          />
        )}

        {editing && <RunEditor run={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSave={saveRun} />}

        {creatingPlan && <PlanCreator runs={runs} today={today} onClose={() => setCreatingPlan(false)} onCreate={createPlan} />}

        {editingSession && (
          <SessionEditor
            session={editingSession}
            onClose={() => setEditingSession(null)}
            onSave={saveSession}
            onDelete={async () => {
              await store.deleteSession(editingSession.id);
              setEditingSession(null);
              await refresh();
            }}
          />
        )}

        {changingDate && plan && <RaceDateEditor plan={plan} today={today} onClose={() => setChangingDate(false)} onSave={changeRaceDay} />}

        {linkingWatch && <ShortcutSetup store={store} endpoint={importEndpoint} onClose={() => { setLinkingWatch(false); void refresh(); }} />}
        {importing && <ArchiveImport knownRefs={knownRefs} existing={runs} onImport={importRuns} onClose={() => setImporting(false)} />}
      </main>
    </div>
  );
}
