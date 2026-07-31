import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { GoalCard } from './components/GoalCard';
import { GoalEditor } from './components/GoalEditor';
import { ProfileHeader } from './components/ProfileHeader';
import { Timeline } from './components/Timeline';
import { store } from './data';
import { DEMO_GOALS } from './lib/demo';
import type { AppUser, Goal, GoalInput, TierInput } from './lib/types';

type Tab = 'objectifs' | 'historique';

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('objectifs');
  const [editing, setEditing] = useState<{ goal: Goal | null } | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

  async function saveGoal(input: GoalInput, tiers: TierInput[]) {
    const target = editing?.goal;
    if (target) {
      await store.updateGoal(target.id, input);
    } else {
      const created = await store.createGoal(input, tiers);
      setExpanded((set) => new Set(set).add(created.id));
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
    link.download = `palier-${new Date().toISOString().slice(0, 10)}.json`;
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

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">◆</span> Palier
        </div>
        <div className="topbar-actions">
          {user && <span className="account">{user.email}</span>}
          <button className="btn btn-sm" onClick={exportJson}>
            Exporter
          </button>
          <button className="btn btn-sm" onClick={importJson}>
            Importer
          </button>
          {user && !user.isLocal && (
            <button className="btn btn-sm" onClick={() => void store.signOut()}>
              Déconnexion
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => setEditing({ goal: null })}>
            + Objectif
          </button>
        </div>
      </header>

      {user?.isLocal && (
        <div className="notice info">
          Mode local : tes objectifs sont enregistrés dans ce navigateur uniquement. Renseigne tes
          clés Supabase pour activer les comptes et la synchronisation entre appareils.
        </div>
      )}
      {error && <div className="notice error">{error}</div>}

      <ProfileHeader goals={goals} />

      <nav className="tabs">
        <button
          className={`tab${tab === 'objectifs' ? ' active' : ''}`}
          onClick={() => setTab('objectifs')}
        >
          Objectifs ({activeGoals.length})
        </button>
        <button
          className={`tab${tab === 'historique' ? ' active' : ''}`}
          onClick={() => setTab('historique')}
        >
          Historique
        </button>
      </nav>

      {loading ? (
        <p style={{ color: 'var(--text-dim)' }}>Chargement…</p>
      ) : tab === 'historique' ? (
        <Timeline goals={goals} />
      ) : activeGoals.length === 0 ? (
        <div className="empty">
          <h3>Aucun objectif pour l'instant</h3>
          <p>
            Un objectif se découpe en paliers, du plus accessible au plus ambitieux, et chaque
            palier porte un rang. Valide-les un par un pour faire monter ton rang global.
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
      ) : (
        <div className="goal-grid">
          {activeGoals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              expanded={expanded.has(goal.id)}
              onToggleExpand={() => toggleExpand(goal.id)}
              onEdit={() => setEditing({ goal })}
              onDelete={() => deleteGoal(goal)}
              onAddTier={(input) => run(() => store.createTier(goal.id, input))}
              onUpdateTier={(tierId, patch) => run(() => store.updateTier(tierId, patch))}
              onDeleteTier={(tierId) => run(() => store.deleteTier(tierId))}
              onMoveTier={async (tierId, direction) => moveTier(goal, tierId, direction)}
            />
          ))}
        </div>
      )}

      {editing && (
        <GoalEditor goal={editing.goal} onCancel={() => setEditing(null)} onSave={saveGoal} />
      )}
    </div>
  );
}
