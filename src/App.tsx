import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { Ceremony, type Celebration } from './components/Ceremony';
import { GoalCard } from './components/GoalCard';
import { GoalEditor } from './components/GoalEditor';
import { Hub } from './components/Hub';
import { Timeline } from './components/Timeline';
import { store } from './data';
import { DEMO_GOALS } from './lib/demo';
import { goalProgress, ppForRank, profileRank } from './lib/progress';
import { getRank } from './lib/ranks';
import type { AppUser, Goal, GoalInput, Tier, TierInput } from './lib/types';

type View = 'accueil' | 'objectifs' | 'historique';

const VIEWS: { id: View; label: string; icon: string }[] = [
  { id: 'accueil', label: 'Accueil', icon: '▲' },
  { id: 'objectifs', label: 'Objectifs', icon: '◎' },
  { id: 'historique', label: 'Historique', icon: '↺' },
];

/** Emplacements réservés des prochains sprints — visibles mais inactifs. */
const SOON: { label: string; icon: string }[] = [
  { label: 'Trophées', icon: '🏆' },
  { label: 'Amis', icon: '⚔' },
];

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<View>('accueil');
  const [editing, setEditing] = useState<{ goal: Goal | null } | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [celebrations, setCelebrations] = useState<Celebration[]>([]);

  useEffect(() => {
    return store.onUserChange((next) => {
      setUser(next);
      setAuthReady(true);
    });
  }, []);

  const refresh = useCallback(async () => {
    try {
      setGoals(await store.listGoals());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setGoals([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void refresh();
  }, [user, refresh]);

  /** Exécute une mutation puis resynchronise l'affichage sur le stockage. */
  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      try {
        await action();
        await refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Opération impossible.');
      }
    },
    [refresh],
  );

  const activeGoals = useMemo(() => goals.filter((g) => !g.archived), [goals]);

  /**
   * Prépare les cérémonies déclenchées par la validation d'un palier : l'écran
   * du palier lui-même, puis — si la moyenne des objectifs franchit un cap —
   * celui de la montée de rang du profil. Le calcul est fait sur une copie
   * locale des données pour afficher la célébration sans attendre le serveur.
   */
  function celebrateTier(goal: Goal, tier: Tier) {
    const before = profileRank(goals);
    const nextGoals = goals.map((g) =>
      g.id === goal.id
        ? {
            ...g,
            tiers: g.tiers.map((t) =>
              t.id === tier.id ? { ...t, completedAt: new Date().toISOString() } : t,
            ),
          }
        : g,
    );
    const after = profileRank(nextGoals);
    const updatedGoal = nextGoals.find((g) => g.id === goal.id);
    const progress = updatedGoal ? goalProgress(updatedGoal) : null;
    const rank = getRank(tier.rank);

    const queue: Celebration[] = [
      {
        kind: 'tier',
        rank,
        tierTitle: tier.title,
        goalTitle: goal.title,
        pp: ppForRank(rank),
        goalComplete: progress?.complete ?? false,
      },
    ];
    if (after.rank && (!before.rank || after.rank.value > before.rank.value)) {
      queue.push({ kind: 'profile', rank: after.rank, previous: before.rank });
    }
    setCelebrations(queue);
  }

  /** Validation directe d'un palier (depuis le hub ou une carte d'objectif). */
  function validateTier(goal: Goal, tier: Tier) {
    celebrateTier(goal, tier);
    void run(() => store.updateTier(tier.id, { completedAt: new Date().toISOString() }));
  }

  async function saveGoal(input: GoalInput, tiers: TierInput[]) {
    const target = editing?.goal;
    if (target) {
      await store.updateGoal(target.id, input);
    } else {
      const created = await store.createGoal(input, tiers);
      setExpanded((set) => new Set(set).add(created.id));
      setView('objectifs');
    }
    await refresh();
    setEditing(null);
  }

  function toggleExpand(id: string) {
    setExpanded((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function deleteGoal(goal: Goal) {
    const label = `Supprimer « ${goal.title} » et ses ${goal.tiers.length} palier(s) ? Cette action est définitive.`;
    if (!window.confirm(label)) return;
    void run(() => store.deleteGoal(goal.id));
  }

  function moveTier(goal: Goal, tierId: string, direction: -1 | 1) {
    const ids = goal.tiers.map((t) => t.id);
    const from = ids.indexOf(tierId);
    const to = from + direction;
    if (from === -1 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    void run(() => store.reorderTiers(goal.id, ids));
  }

  async function exportJson() {
    const data = await store.exportAll();
    const blob = new Blob([JSON.stringify({ version: 1, goals: data }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `zenith-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function importJson() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text()) as { goals?: Goal[] };
        if (!Array.isArray(parsed.goals)) throw new Error('Fichier de sauvegarde non reconnu.');
        if (!window.confirm('Importer cette sauvegarde ? Elle remplacera tes objectifs actuels.'))
          return;
        await run(() => store.importAll(parsed.goals as Goal[]));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Import impossible.');
      }
    };
    input.click();
  }

  function loadDemo() {
    void run(async () => {
      for (const demo of DEMO_GOALS) {
        await store.createGoal(
          { title: demo.title, description: demo.description, emoji: demo.emoji },
          demo.tiers,
        );
      }
    });
  }

  // --- Rendu ------------------------------------------------------------
  if (store.isRemote && !authReady) {
    return <div className="auth-screen">Chargement…</div>;
  }
  if (store.isRemote && !user) {
    return <AuthScreen />;
  }

  const emptyState = (
    <div className="empty">
      <h3>Aucun objectif pour l'instant</h3>
      <p>
        Un objectif se découpe en paliers, du plus accessible au plus ambitieux, et chaque palier
        porte un rang. Valide-les un par un pour faire monter ton rang global.
      </p>
      <div style={{ display: 'flex', gap: 9, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => setEditing({ goal: null })}>
          Créer mon premier objectif
        </button>
        <button className="btn" onClick={loadDemo}>
          Charger des exemples
        </button>
      </div>
    </div>
  );

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">▲</span>
          <span className="brand-name">Zénith</span>
        </div>

        <nav className="nav" aria-label="Navigation principale">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              className={`nav-item${view === v.id ? ' active' : ''}`}
              onClick={() => setView(v.id)}
              aria-current={view === v.id ? 'page' : undefined}
            >
              <span className="nav-icon" aria-hidden="true">
                {v.icon}
              </span>
              <span className="nav-label">{v.label}</span>
              {v.id === 'objectifs' && activeGoals.length > 0 && (
                <span className="nav-count">{activeGoals.length}</span>
              )}
            </button>
          ))}
          {SOON.map((item) => (
            <span key={item.label} className="nav-item soon" aria-disabled="true">
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              <span className="nav-label">{item.label}</span>
              <span className="nav-soon">bientôt</span>
            </span>
          ))}
        </nav>

        <div className="sidebar-foot">
          {user && <div className="account" title={user.email}>{user.email}</div>}
          <div className="sidebar-foot-actions">
            <button className="btn btn-ghost btn-sm" onClick={exportJson}>
              Exporter
            </button>
            <button className="btn btn-ghost btn-sm" onClick={importJson}>
              Importer
            </button>
            {user && !user.isLocal && (
              <button className="btn btn-ghost btn-sm" onClick={() => void store.signOut()}>
                Déconnexion
              </button>
            )}
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <h1 className="page-title">{VIEWS.find((v) => v.id === view)?.label}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Doublon des actions du pied de sidebar, visible uniquement sur mobile
                où la sidebar devient une barre d'onglets sans pied. */}
            <div className="topbar-mobile-actions">
              <button className="btn btn-ghost btn-sm" onClick={exportJson} title="Exporter">
                ⬇
              </button>
              <button className="btn btn-ghost btn-sm" onClick={importJson} title="Importer">
                ⬆
              </button>
              {user && !user.isLocal && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => void store.signOut()}
                  title="Déconnexion"
                >
                  ⎋
                </button>
              )}
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setEditing({ goal: null })}>
              + Objectif
            </button>
          </div>
        </header>

        {user?.isLocal && (
          <div className="notice info">
            Mode local : tes objectifs sont enregistrés dans ce navigateur uniquement. Renseigne
            tes clés Supabase pour activer les comptes et la synchronisation entre appareils.
          </div>
        )}
        {error && <div className="notice error">{error}</div>}

        {loading ? (
          <p style={{ color: 'var(--text-dim)' }}>Chargement…</p>
        ) : view === 'historique' ? (
          <Timeline goals={goals} />
        ) : view === 'accueil' ? (
          activeGoals.length === 0 ? (
            emptyState
          ) : (
            <Hub
              goals={goals}
              onValidateTier={validateTier}
              onGoToGoals={() => setView('objectifs')}
            />
          )
        ) : activeGoals.length === 0 ? (
          emptyState
        ) : (
          <div className="goal-grid">
            {activeGoals.map((goal, index) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                index={index}
                expanded={expanded.has(goal.id)}
                onToggleExpand={() => toggleExpand(goal.id)}
                onEdit={() => setEditing({ goal })}
                onDelete={() => deleteGoal(goal)}
                onAddTier={(input) => run(() => store.createTier(goal.id, input))}
                onUpdateTier={(tierId, patch) => {
                  if (patch.completedAt) {
                    const tier = goal.tiers.find((t) => t.id === tierId);
                    if (tier) celebrateTier(goal, tier);
                  }
                  return run(() => store.updateTier(tierId, patch));
                }}
                onDeleteTier={(tierId) => run(() => store.deleteTier(tierId))}
                onMoveTier={async (tierId, direction) => moveTier(goal, tierId, direction)}
              />
            ))}
          </div>
        )}
      </main>

      {editing && (
        <GoalEditor goal={editing.goal} onCancel={() => setEditing(null)} onSave={saveGoal} />
      )}

      {celebrations.length > 0 && (
        <Ceremony items={celebrations} onFinish={() => setCelebrations([])} />
      )}
    </div>
  );
}
