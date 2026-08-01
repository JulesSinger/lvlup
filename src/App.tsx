import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthScreen } from './components/AuthScreen';
import { Ceremony, type Celebration } from './components/Ceremony';
import { GoalCard } from './components/GoalCard';
import { GoalEditor } from './components/GoalEditor';
import { Hub } from './components/Hub';
import { Timeline } from './components/Timeline';
import { Trophies } from './components/Trophies';
import { store } from './data';
import type { UnlockedAchievement } from './data/store';
import { newlyUnlocked, unlockedAchievements } from './lib/achievements';
import { DEMO_GOALS } from './lib/demo';
import { goalProgress, ppForRank, profileRank } from './lib/progress';
import { getRank } from './lib/ranks';
import { playCheckinBlip, vibrate } from './lib/sound';
import { computeStreak, dayString } from './lib/streak';
import type { AppUser, Checkin, Goal, GoalInput, Tier, TierInput } from './lib/types';

type View = 'accueil' | 'objectifs' | 'historique' | 'trophees';

const VIEWS: { id: View; label: string; icon: string }[] = [
  { id: 'accueil', label: 'Accueil', icon: '▲' },
  { id: 'objectifs', label: 'Objectifs', icon: '◎' },
  { id: 'trophees', label: 'Trophées', icon: '🏆' },
  { id: 'historique', label: 'Historique', icon: '↺' },
];

/** Emplacements réservés des prochains sprints — visibles mais inactifs. */
const SOON: { label: string; icon: string }[] = [{ label: 'Amis', icon: '⚔' }];

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [achievements, setAchievements] = useState<UnlockedAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<View>('accueil');
  const [editing, setEditing] = useState<{ goal: Goal | null } | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [celebrations, setCelebrations] = useState<Celebration[]>([]);

  useEffect(() => {
    const unsubscribe = store.onUserChange((next) => {
      setUser(next);
      setAuthReady(true);
    });
    // Filet de sécurité : si la restauration de session n'aboutit jamais
    // (réseau coupé au réveil de l'app), on sort de l'écran « Chargement… »
    // au lieu d'y rester bloqué — l'écran de connexion vaut mieux qu'un spinner
    // éternel, et une session valide reprendra la main dès qu'elle arrivera.
    const safety = window.setTimeout(() => setAuthReady(true), 8000);
    return () => {
      window.clearTimeout(safety);
      unsubscribe();
    };
  }, []);

  const refresh = useCallback(async (retry = true): Promise<void> => {
    try {
      const [nextGoals, nextCheckins, stored] = await Promise.all([
        store.listGoals(),
        store.listCheckins(),
        store.listAchievements(),
      ]);
      // Un trophée dont la condition est remplie devient acquis pour toujours,
      // même si l'action qui l'a rempli est annulée plus tard.
      let nextAchievements = stored;
      const computed = unlockedAchievements({ goals: nextGoals, checkins: nextCheckins });
      const known = new Set(stored.map((a) => a.id));
      const fresh = [...computed].filter((id) => !known.has(id));
      if (fresh.length > 0) {
        await store.unlockAchievements(fresh);
        const now = new Date().toISOString();
        nextAchievements = [...stored, ...fresh.map((id) => ({ id, unlockedAt: now }))];
      }
      setGoals(nextGoals);
      setCheckins(nextCheckins);
      setAchievements(nextAchievements);
      setError('');
    } catch (err) {
      // Au réveil de l'app (surtout sur téléphone), la première requête peut
      // partir pendant le rafraîchissement du jeton et être rejetée. On
      // réessaie une fois avant d'afficher quoi que ce soit d'inquiétant.
      if (retry && store.isRemote) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        return refresh(false);
      }
      setError(err instanceof Error ? err.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setGoals([]);
      setCheckins([]);
      setAchievements([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    void refresh();
  }, [user, refresh]);

  // Retour au premier plan (multi-appareils) : les données ont pu changer sur
  // un autre appareil pendant que celui-ci dormait — on resynchronise.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible' && user) void refresh();
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [user, refresh]);

  // Badge sur l'icône installée (PWA) : un point tant que le check-in du jour
  // n'est pas fait. Silencieusement ignoré là où l'API n'existe pas.
  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (count?: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (!nav.setAppBadge) return;
    const streak = computeStreak(goals, checkins);
    const hasGoals = goals.some((g) => !g.archived);
    try {
      if (hasGoals && !streak.activeToday) void nav.setAppBadge(1);
      else void nav.clearAppBadge?.();
    } catch {
      // API refusée : rien à faire.
    }
  }, [goals, checkins]);

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
  const archivedGoals = useMemo(() => goals.filter((g) => g.archived), [goals]);

  /**
   * Prépare les cérémonies déclenchées par la validation d'un palier : l'écran
   * du palier, la montée de rang du profil si la moyenne franchit un cap, puis
   * les trophées éventuellement débloqués. Le calcul est fait sur une copie
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
    const alreadyOwned = new Set(achievements.map((a) => a.id));
    for (const trophy of newlyUnlocked({ goals, checkins }, { goals: nextGoals, checkins })) {
      // Un trophée déjà acquis (puis « re-rempli » après une annulation) ne se
      // re-célèbre pas.
      if (!alreadyOwned.has(trophy.id)) {
        queue.push({ kind: 'trophy', icon: trophy.icon, name: trophy.name, desc: trophy.desc });
      }
    }
    setCelebrations(queue);
  }

  /** Validation directe d'un palier (depuis le hub ou une carte d'objectif). */
  function validateTier(goal: Goal, tier: Tier) {
    celebrateTier(goal, tier);
    void run(() => store.updateTier(tier.id, { completedAt: new Date().toISOString() }));
  }

  /** Check-in du jour sur un objectif : PP, streak, et trophées éventuels. */
  function checkinToday(goal: Goal) {
    playCheckinBlip();
    vibrate(20);
    const day = dayString();
    const optimistic: Checkin = {
      id: `optimiste-${goal.id}`,
      goalId: goal.id,
      day,
      note: '',
      createdAt: new Date().toISOString(),
    };
    const alreadyOwned = new Set(achievements.map((a) => a.id));
    const trophies = newlyUnlocked(
      { goals, checkins },
      { goals, checkins: [...checkins, optimistic] },
    ).filter((t) => !alreadyOwned.has(t.id));
    if (trophies.length > 0) {
      setCelebrations(
        trophies.map((t) => ({ kind: 'trophy', icon: t.icon, name: t.name, desc: t.desc })),
      );
    }
    void run(() => store.addCheckin(goal.id, day));
  }

  function removeCheckin(checkin: Checkin) {
    void run(() => store.deleteCheckin(checkin.id));
  }

  function saveCheckinNote(checkin: Checkin, note: string) {
    void run(() => store.updateCheckin(checkin.id, { note }));
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

  function archiveGoal(goal: Goal) {
    void run(() => store.updateGoal(goal.id, { archived: true }));
  }

  function restoreGoal(goal: Goal) {
    void run(() => store.updateGoal(goal.id, { archived: false }));
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
    const backup = await store.exportAll();
    const blob = new Blob(
      [
        JSON.stringify(
          {
            version: 3,
            goals: backup.goals,
            checkins: backup.checkins,
            achievements: backup.achievements,
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
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
        const parsed = JSON.parse(await file.text()) as {
          goals?: Goal[];
          checkins?: Checkin[];
          achievements?: UnlockedAchievement[];
        };
        if (!Array.isArray(parsed.goals)) throw new Error('Fichier de sauvegarde non reconnu.');
        if (!window.confirm('Importer cette sauvegarde ? Elle remplacera tes objectifs actuels.'))
          return;
        // Les sauvegardes plus anciennes n'ont ni check-ins (v1) ni trophées (v2).
        await run(() =>
          store.importAll({
            goals: parsed.goals as Goal[],
            checkins: Array.isArray(parsed.checkins) ? parsed.checkins : [],
            achievements: Array.isArray(parsed.achievements) ? parsed.achievements : [],
          }),
        );
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
        {error && (
          <div className="notice error">
            {error}{' '}
            <button
              className="btn btn-sm"
              style={{ marginLeft: 8 }}
              onClick={() => {
                setLoading(true);
                void refresh();
              }}
            >
              Réessayer
            </button>
          </div>
        )}

        {loading ? (
          <p style={{ color: 'var(--text-dim)' }}>Chargement…</p>
        ) : view === 'historique' ? (
          <Timeline goals={goals} checkins={checkins} />
        ) : view === 'trophees' ? (
          <Trophies achievements={achievements} />
        ) : view === 'accueil' ? (
          activeGoals.length === 0 ? (
            emptyState
          ) : (
            <Hub
              goals={goals}
              checkins={checkins}
              onCheckin={checkinToday}
              onUncheckin={removeCheckin}
              onSaveNote={saveCheckinNote}
              onValidateTier={validateTier}
              onGoToGoals={() => setView('objectifs')}
            />
          )
        ) : activeGoals.length === 0 && archivedGoals.length === 0 ? (
          emptyState
        ) : (
          <>
            {activeGoals.length === 0 ? (
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
                    onArchive={() => archiveGoal(goal)}
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

            {archivedGoals.length > 0 && (
              <section className="archived">
                <h2 className="archived-title">Archivés ({archivedGoals.length})</h2>
                <p className="archived-hint">
                  Un objectif archivé ne compte plus dans ton rang ni tes PP, mais son histoire
                  est conservée. Restaure-le quand tu veux.
                </p>
                {archivedGoals.map((goal) => (
                  <div key={goal.id} className="archived-row">
                    <span className="archived-emoji" aria-hidden="true">
                      {goal.emoji}
                    </span>
                    <span className="archived-name">{goal.title}</span>
                    <button className="btn btn-sm" onClick={() => restoreGoal(goal)}>
                      Restaurer
                    </button>
                    <button
                      className="btn btn-ghost btn-sm btn-danger"
                      onClick={() => deleteGoal(goal)}
                      title="Supprimer définitivement"
                    >
                      🗑
                    </button>
                  </div>
                ))}
              </section>
            )}
          </>
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
