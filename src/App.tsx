import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ceremony, type Celebration } from './modules/objectifs/components/Ceremony';
import { GoalCard } from './modules/objectifs/components/GoalCard';
import { GoalEditor, type GoalSeed } from './modules/objectifs/components/GoalEditor';
import { GoalPicker } from './modules/objectifs/components/GoalPicker';
import { Hub } from './modules/objectifs/components/Hub';
import { Landing } from './modules/objectifs/components/Landing';
import { Onboarding } from './modules/objectifs/components/Onboarding';
import { PasswordRecovery } from './core/components/PasswordRecovery';
import { SettingsPanel } from './core/components/SettingsPanel';
import { Timeline } from './modules/objectifs/components/Timeline';
import { Trophies } from './modules/objectifs/components/Trophies';
import { ActionEditor } from './modules/objectifs/components/ActionEditor';
import { coreStore } from './core/data';
import { exportBackup, importBackup, readBackupFile } from './core/data/backup';
import { MODULES } from './modules';
import { goalsStore } from './modules/objectifs/data';
import {
  applyPending,
  isNetworkError,
  listPending,
  onPendingChange,
  queueAdd,
  queueDelete,
  PENDING_PREFIX,
} from './modules/objectifs/data/outbox';
import { flushOutbox } from './modules/objectifs/data/sync';
import { DEFAULT_SETTINGS, type Settings } from './core/data/coreStore';
import type { UnlockedAchievement } from './modules/objectifs/data/goalsStore';
import { timezoneOffsetMinutes } from './core/lib/push';
import { newlyUnlocked, unlockedAchievements } from './modules/objectifs/lib/achievements';
import { adoptLegacyOnboarding, hasOnboarded, markOnboarded } from './core/lib/onboarding';
import { isCountable, tierProgress } from './modules/objectifs/lib/counters';
import { inheritedTier, ladderKind, tapValue } from './modules/objectifs/lib/quantities';
import { DEMO_GOALS } from './modules/objectifs/lib/demo';
import { goalProgress, ppForRank, profileRank, todayPP } from './modules/objectifs/lib/progress';
import { getRank, ladderInsert, ladderMove } from './modules/objectifs/lib/ranks';
import type { GoalTemplate } from './modules/objectifs/lib/templates';
import { playCheckinBlip, vibrate } from './core/lib/sound';
import { computeStreak, dayString } from './modules/objectifs/lib/streak';
import { ONE_OFF_PP } from './modules/objectifs/lib/types';
import type {
  Action,
  ActionInput,
  AppUser,
  Checkin,
  Goal,
  GoalInput,
  Tier,
  TierInput,
} from './modules/objectifs/lib/types';

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
  const [actions, setActions] = useState<Action[]>([]);
  const [achievements, setAchievements] = useState<UnlockedAchievement[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState<View>('accueil');
  const [editing, setEditing] = useState<{ goal: Goal | null; seed?: GoalSeed | null } | null>(
    null,
  );
  /** Ouvre la bibliothèque de modèles avant l'éditeur. */
  const [picking, setPicking] = useState(false);
  /** Actions à créer avec le prochain objectif (venues d'un modèle). */
  const [seedActions, setSeedActions] = useState<ActionInput[] | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [celebrations, setCelebrations] = useState<Celebration[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  /** Nombre de coches encore dans la file d'attente hors ligne. */
  const [pendingCount, setPendingCount] = useState(() => listPending().length);
  /** L'utilisateur arrive par un lien « mot de passe oublié ». */
  const [recovering, setRecovering] = useState(false);
  /**
   * Identifiant de l'utilisateur qui a déjà vu l'accompagnement.
   *
   * Porté par l'utilisateur et non par l'appareil : un compte tout neuf créé
   * dans un navigateur déjà servi doit voir l'accompagnement, sinon il arrive
   * sur un écran vide sans savoir ce qu'est un palier — et c'est exactement la
   * personne à qui il était destiné.
   */
  const [onboardedId, setOnboardedId] = useState<string | null>(null);
  const onboardingDone = user !== null && onboardedId === user.id;

  function finishOnboarding() {
    if (!user) return;
    markOnboarded(user.id);
    setOnboardedId(user.id);
  }

  useEffect(() => {
    const unsubscribe = coreStore.onUserChange((next) => {
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
      const [nextGoals, nextCheckins, nextActions, stored, nextSettings] = await Promise.all([
        goalsStore.listGoals(),
        goalsStore.listCheckins(),
        goalsStore.listActions(),
        goalsStore.listAchievements(),
        coreStore.getSettings(),
      ]);
      // Un trophée dont la condition est remplie devient acquis pour toujours,
      // même si l'action qui l'a rempli est annulée plus tard.
      let nextAchievements = stored;
      const computed = unlockedAchievements({ goals: nextGoals, checkins: nextCheckins });
      const known = new Set(stored.map((a) => a.id));
      const fresh = [...computed].filter((id) => !known.has(id));
      if (fresh.length > 0) {
        await goalsStore.unlockAchievements(fresh);
        const now = new Date().toISOString();
        nextAchievements = [...stored, ...fresh.map((id) => ({ id, unlockedAt: now }))];
      }
      // Les coches encore en file d'attente sont réappliquées par-dessus les
      // données du serveur : un rafraîchissement ne doit jamais faire
      // disparaître une action que l'utilisateur a bel et bien faite.
      const merged = applyPending(nextCheckins);

      /*
       * Rattrapage silencieux des paliers déjà atteints.
       *
       * La validation automatique part au clic — c'est ce qui permet la
       * cérémonie au bon moment. Mais une coche peut arriver autrement : d'un
       * autre appareil, d'un import de sauvegarde, ou de la file d'attente
       * vidée au retour du réseau. Sans ce filet, on tomberait sur une barre
       * pleine à côté d'un palier non validé — l'app aurait l'air de ne pas
       * savoir compter.
       *
       * Aucune cérémonie ici, volontairement : on ne fête pas une victoire
       * qu'on découvre en rechargeant une sauvegarde de l'an dernier.
       */
      const late = nextGoals
        .filter((g) => !g.archived)
        .flatMap((g) =>
          g.tiers.filter(
            (t) =>
              !t.completedAt &&
              isCountable(t) &&
              tierProgress(t, nextActions, merged)?.reached === true,
          ),
        );
      let goalsToShow = nextGoals;
      if (late.length > 0) {
        const now = new Date().toISOString();
        const ids = new Set(late.map((t) => t.id));
        goalsToShow = nextGoals.map((g) => ({
          ...g,
          tiers: g.tiers.map((t) => (ids.has(t.id) ? { ...t, completedAt: now } : t)),
        }));
        await Promise.all(
          late.map((t) => goalsStore.updateTier(t.id, { completedAt: now }).catch(() => {})),
        );
      }

      setGoals(goalsToShow);
      setCheckins(merged);
      setActions(nextActions);
      setAchievements(nextAchievements);
      setSettings(nextSettings);
      setError('');
    } catch (err) {
      // Au réveil de l'app (surtout sur téléphone), la première requête peut
      // partir pendant le rafraîchissement du jeton et être rejetée. On
      // réessaie une fois avant d'afficher quoi que ce soit d'inquiétant.
      if (retry && coreStore.isRemote) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        return refresh(false);
      }
      setError(err instanceof Error ? err.message : 'Chargement impossible.');
    } finally {
      setLoading(false);
    }
  }, []);

  // --- File d'attente hors ligne ---------------------------------------
  /** Vide ce qui attend d'être envoyé, puis resynchronise l'affichage. */
  const sync = useCallback(async () => {
    const result = await flushOutbox();
    if (result.dropped.length > 0) setError(result.dropped[0]);
    await refresh();
  }, [refresh]);

  // Changement d'utilisateur : tout ce qui est à l'écran appartenait à la
  // session précédente. Sans ce ménage, on se connectait et le panneau de
  // réglages était déjà ouvert — celui d'où on venait de se déconnecter.
  useEffect(() => {
    setShowSettings(false);
    setEditing(null);
    setPicking(false);
    setSeedActions(null);
    setCelebrations([]);
    setExpanded(new Set());
    setView('accueil');
    setError('');
    setOnboardedId(user ? (adoptLegacyOnboarding(user.id) || hasOnboarded(user.id) ? user.id : null) : null);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setGoals([]);
      setCheckins([]);
      setActions([]);
      setAchievements([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    // `sync` plutôt que `refresh` : si une coche attend depuis la dernière
    // session hors ligne, elle part avant qu'on affiche quoi que ce soit.
    void sync();
  }, [user, sync]);

  // Retour au premier plan (multi-appareils) : les données ont pu changer sur
  // un autre appareil pendant que celui-ci dormait — on resynchronise, après
  // avoir vidé ce qui attendait dans la file.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible' && user) void sync();
    }
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [user, sync]);

  useEffect(() => onPendingChange((ops) => setPendingCount(ops.length)), []);

  useEffect(() => {
    if (!user || user.isLocal) return;
    // Au démarrage et dès que le réseau revient : on rattrape le retard.
    const onOnline = () => void sync();
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [user, sync]);

  // Le fuseau est réécrit à chaque ouverture : c'est ce qui garde le rappel à
  // la bonne heure après un changement d'heure ou un déplacement.
  useEffect(() => {
    if (!user || user.isLocal || !settings.reminderEnabled) return;
    const offset = timezoneOffsetMinutes();
    if (offset === settings.tzOffset) return;
    void coreStore.updateSettings({ tzOffset: offset }).catch(() => {});
    setSettings((s) => ({ ...s, tzOffset: offset }));
  }, [user, settings.reminderEnabled, settings.tzOffset]);

  // Lien « mot de passe oublié » : on intercepte avant tout le reste.
  useEffect(() => coreStore.onPasswordRecovery(() => setRecovering(true)), []);

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
    queue.push(
      ...dayCelebrations(
        todayPP(goals, checkins),
        todayPP(nextGoals, checkins),
        computeStreak(nextGoals, checkins).current,
      ),
    );
    setCelebrations(queue);
  }

  /** Validation directe d'un palier (depuis le hub ou une carte d'objectif). */
  function validateTier(goal: Goal, tier: Tier) {
    celebrateTier(goal, tier);
    void run(() => goalsStore.updateTier(tier.id, { completedAt: new Date().toISOString() }));
  }

  /**
   * Journée bouclée ? On compare l'avant et l'après : la cérémonie ne se
   * déclenche qu'au moment précis où la cible est franchie, jamais ensuite.
   */
  function dayCelebrations(before: number, after: number, streakAfter: number): Celebration[] {
    if (before >= settings.dailyGoal || after < settings.dailyGoal) return [];
    return [{ kind: 'day', earned: after, goal: settings.dailyGoal, streak: streakAfter }];
  }

  /**
   * Enregistre une action : PP, streak, trophées, journée.
   * `day` permet de rattraper un oubli — la coche part alors sur le jour
   * concerné, et non sur aujourd'hui.
   */
  function logAction(
    goal: Goal,
    action: Action,
    day: string = dayString(),
    value: number | null = tapValue(action),
  ) {
    playCheckinBlip();
    vibrate(20);
    const isToday = day === dayString();
    const optimistic: Checkin = {
      id: `optimiste-${action.id}-${day}`,
      goalId: goal.id,
      actionId: action.id,
      pp: action.pp,
      day,
      note: '',
      createdAt: new Date().toISOString(),
      value,
      title: null,
    };
    const nextCheckins = [...checkins, optimistic];
    // L'affichage bascule immédiatement : sur mobile l'aller-retour serveur
    // se voit, et un chip qui ne réagit pas donne l'impression d'un clic raté.
    // `refresh()` remplacera cette ligne optimiste par la vraie.
    setCheckins(nextCheckins);
    const before = todayPP(goals, checkins);
    const after = todayPP(goals, nextCheckins);
    const streakAfter = computeStreak(goals, nextCheckins).current;

    const { goalsAfter, queue } = reachedCelebrations(checkins, nextCheckins);

    const alreadyOwned = new Set(achievements.map((a) => a.id));
    for (const t of newlyUnlocked(
      { goals, checkins },
      { goals: goalsAfter, checkins: nextCheckins },
    )) {
      if (!alreadyOwned.has(t.id)) {
        queue.push({ kind: 'trophy', icon: t.icon, name: t.name, desc: t.desc });
      }
    }
    // La cérémonie de journée bouclée ne se rejoue pas pour un jour passé :
    // ce serait une fausse joie, et l'anneau du jour n'a pas bougé.
    if (isToday) queue.push(...dayCelebrations(before, after, streakAfter));
    if (queue.length > 0) setCelebrations(queue);

    void (async () => {
      try {
        await goalsStore.addCheckin(goal.id, day, action.id, action.pp, value);
        await refresh();
      } catch (err) {
        if (isNetworkError(err)) {
          // Hors ligne : la coche est rangée dans la file et reste affichée.
          // Elle partira toute seule au retour du réseau.
          const pendingId = queueAdd({
            goalId: goal.id,
            actionId: action.id,
            day,
            pp: action.pp,
            value,
          });
          setCheckins((prev) =>
            prev.map((c) => (c.id === optimistic.id ? { ...c, id: pendingId } : c)),
          );
          return;
        }
        setError(err instanceof Error ? err.message : 'Opération impossible.');
        await refresh();
      }
    })();
  }

  /**
   * Un geste ponctuel : un vrai pas vers l'objectif, mais pas une habitude.
   *
   * Il rapporte des PP fixes et nourrit le streak — on a bien fait quelque
   * chose ce jour-là. Il ne fait monter aucun palier (`feedingCheckins` l'écarte)
   * et ne reviendra pas demain sous forme de case à cocher : il n'a pas
   * d'action derrière. C'est tout ce qui l'empêche de devenir un déversoir.
   */
  function logOneOff(goal: Goal, title: string, day: string = dayString()) {
    const clean = title.trim();
    if (!clean) return;
    playCheckinBlip();
    vibrate(20);
    const isToday = day === dayString();
    const optimistic: Checkin = {
      id: `optimiste-ponctuel-${Date.now()}`,
      goalId: goal.id,
      actionId: null,
      pp: ONE_OFF_PP,
      day,
      note: '',
      createdAt: new Date().toISOString(),
      value: null,
      title: clean,
    };
    const nextCheckins = [...checkins, optimistic];
    setCheckins(nextCheckins);

    const queue: Celebration[] = [];
    const alreadyOwned = new Set(achievements.map((a) => a.id));
    for (const t of newlyUnlocked({ goals, checkins }, { goals, checkins: nextCheckins })) {
      if (!alreadyOwned.has(t.id)) {
        queue.push({ kind: 'trophy', icon: t.icon, name: t.name, desc: t.desc });
      }
    }
    if (isToday) {
      queue.push(
        ...dayCelebrations(
          todayPP(goals, checkins),
          todayPP(goals, nextCheckins),
          computeStreak(goals, nextCheckins).current,
        ),
      );
    }
    if (queue.length > 0) setCelebrations(queue);

    void (async () => {
      try {
        await goalsStore.addOneOff(goal.id, day, clean, ONE_OFF_PP);
        await refresh();
      } catch (err) {
        if (isNetworkError(err)) {
          const pendingId = queueAdd({
            goalId: goal.id,
            actionId: null,
            day,
            pp: ONE_OFF_PP,
            title: clean,
          });
          setCheckins((prev) =>
            prev.map((c) => (c.id === optimistic.id ? { ...c, id: pendingId } : c)),
          );
          return;
        }
        setError(err instanceof Error ? err.message : 'Opération impossible.');
        await refresh();
      }
    })();
  }

  function unlogAction(checkin: Checkin) {
    setCheckins((prev) => prev.filter((c) => c.id !== checkin.id));
    if (checkin.id.startsWith(PENDING_PREFIX)) {
      // Cochée puis décochée hors ligne : les deux opérations s'annulent.
      queueDelete(checkin.id);
      return;
    }
    void (async () => {
      try {
        await goalsStore.deleteCheckin(checkin.id);
        await refresh();
      } catch (err) {
        if (isNetworkError(err)) {
          queueDelete(checkin.id);
          return;
        }
        setError(err instanceof Error ? err.message : 'Opération impossible.');
        await refresh();
      }
    })();
  }

  function saveCheckinNote(checkin: Checkin, note: string) {
    void run(() => goalsStore.updateCheckin(checkin.id, { note }));
  }

  /**
   * Correction d'une quantité déjà enregistrée.
   *
   * Une correction peut faire franchir sa cible à un palier — corriger « 5 km »
   * en « 12 km » achève le cumul aussi bien qu'une nouvelle sortie. On rejoue
   * donc la même détection que sur une coche, sur les données corrigées.
   */
  function saveCheckinValue(checkin: Checkin, value: number) {
    const nextCheckins = checkins.map((c) => (c.id === checkin.id ? { ...c, value } : c));
    setCheckins(nextCheckins);
    const { queue } = reachedCelebrations(checkins, nextCheckins);
    if (queue.length > 0) setCelebrations(queue);
    void run(() => goalsStore.updateCheckin(checkin.id, { value }));
  }

  /**
   * Le moment que tout ce sprint construit.
   *
   * Un palier comptable qui atteint sa cible se valide seul, et la cérémonie
   * part au clic. Ce soir-là, on coche sa case comme les vingt-neuf soirs
   * précédents, et l'écran explose. La validation est écrite immédiatement
   * dans l'état local pour que le palier se coche sous les yeux, sans attendre
   * l'aller-retour serveur.
   */
  function reachedCelebrations(
    before: Checkin[],
    after: Checkin[],
  ): { goalsAfter: Goal[]; queue: Celebration[] } {
    const reached = activeGoals.flatMap((g) =>
      g.tiers
        .filter(
          (t) =>
            !t.completedAt &&
            isCountable(t) &&
            !tierProgress(t, actions, before)?.reached &&
            tierProgress(t, actions, after)?.reached,
        )
        .map((tier) => ({ goal: g, tier })),
    );
    if (reached.length === 0) return { goalsAfter: goals, queue: [] };

    const now = new Date().toISOString();
    const wonIds = new Set(reached.map((r) => r.tier.id));
    const goalsAfter = goals.map((g) => ({
      ...g,
      tiers: g.tiers.map((t) => (wonIds.has(t.id) ? { ...t, completedAt: now } : t)),
    }));
    setGoals(goalsAfter);

    const queue: Celebration[] = [];
    const rankBefore = profileRank(goals);
    const rankAfter = profileRank(goalsAfter);
    for (const { goal: g, tier } of reached) {
      const rank = getRank(tier.rank);
      const updated = goalsAfter.find((x) => x.id === g.id);
      queue.push({
        kind: 'tier',
        rank,
        tierTitle: tier.title,
        goalTitle: g.title,
        pp: ppForRank(rank),
        goalComplete: updated ? goalProgress(updated).complete : false,
      });
      void goalsStore.updateTier(tier.id, { completedAt: now });
    }
    if (rankAfter.rank && (!rankBefore.rank || rankAfter.rank.value > rankBefore.rank.value)) {
      queue.push({ kind: 'profile', rank: rankAfter.rank, previous: rankBefore.rank });
    }
    return { goalsAfter, queue };
  }

  async function saveGoal(input: GoalInput, tiers: TierInput[], actions?: ActionInput[]) {
    const target = editing?.goal;
    if (target) {
      await goalsStore.updateGoal(target.id, input);
    } else {
      // `actions` porte l'unité de l'objectif quand ses paliers se comptent :
      // sans ça, un palier « 100 km » resterait à 0/100 quoi qu'on coche.
      const created = await goalsStore.createGoal(input, tiers, actions);
      // Un modèle apporte ses propres actions : elles remplacent les deux
      // génériques créées d'office.
      if (seedActions && seedActions.length > 0) {
        const generic = await goalsStore.listActions();
        for (const a of generic.filter((a) => a.goalId === created.id)) {
          await goalsStore.deleteAction(a.id);
        }
        for (const a of seedActions) await goalsStore.createAction(created.id, a);
      }
      setExpanded((set) => new Set(set).add(created.id));
      setView('objectifs');
      // Planifier est déjà un accomplissement : on le célèbre, sans PP —
      // les points restent réservés à ce qu'on fait vraiment.
      if (tiers.length > 0) {
        setCelebrations([
          {
            kind: 'plan',
            emoji: input.emoji,
            goalTitle: input.title,
            tiers: tiers.map((t) => ({ title: t.title, rank: getRank(t.rank) })),
          },
        ]);
      }
    }
    await refresh();
    setEditing(null);
    setSeedActions(null);
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
    void run(() => goalsStore.updateGoal(goal.id, { archived: true }));
  }

  function restoreGoal(goal: Goal) {
    void run(() => goalsStore.updateGoal(goal.id, { archived: false }));
  }

  function deleteGoal(goal: Goal) {
    const label = `Supprimer « ${goal.title} » et ses ${goal.tiers.length} palier(s) ? Cette action est définitive.`;
    if (!window.confirm(label)) return;
    void run(() => goalsStore.deleteGoal(goal.id));
  }

  /**
   * Ajouter un palier — à la fin, ou glissé à une place précise.
   *
   * Deux choses lui sont données sans qu'on les demande : la **nature** de
   * l'objectif, dont il hérite (sinon il naîtrait « à cocher » et il faudrait
   * le requalifier à la main), et le **rang de la place qu'il occupe**, les
   * paliers du dessous glissant d'un barreau. Voir `ladderInsert`.
   */
  function addTier(goal: Goal, input: TierInput, index?: number) {
    const herite = inheritedTier(input.title, ladderKind(goal.tiers));
    const place = index ?? goal.tiers.length;
    const plan = ladderInsert(goal.tiers, place);
    return run(async () => {
      const created = await goalsStore.createTier(goal.id, {
        ...herite,
        ...input,
        rank: plan?.rank ?? input.rank,
      });
      if (!plan || place === goal.tiers.length) return;
      const ids = goal.tiers.map((t) => t.id);
      await goalsStore.reorderTiers(goal.id, [
        ...ids.slice(0, place),
        created.id,
        ...ids.slice(place),
      ]);
      for (const shift of plan.shifts) {
        await goalsStore.updateTier(shift.id, { rank: shift.rank });
      }
    });
  }

  /**
   * Déplacer un palier déplace son contenu, pas son rang : la suite des rangs
   * reste attachée aux barreaux de l'échelle. Sans ça, remonter un palier
   * ajouté en dernier produisait « bronze, argent, challenger, or » — une
   * échelle qui redescend. Voir `ladderMove`.
   */
  function moveTier(goal: Goal, tierId: string, direction: -1 | 1) {
    const move = ladderMove(goal.tiers, tierId, direction);
    if (!move) return; // déplacement refusé (bord de l'échelle, ou palier validé)
    void run(async () => {
      await goalsStore.reorderTiers(goal.id, move.orderedIds);
      for (const change of move.rankChanges) {
        await goalsStore.updateTier(change.id, { rank: change.rank });
      }
    });
  }

  async function exportJson() {
    // Le registre décide de ce qui entre dans le fichier : ajouter un module
    // suffit à l'y faire figurer, sans toucher à cette fonction.
    const backup = await exportBackup(MODULES, coreStore);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `atlas-${new Date().toISOString().slice(0, 10)}.json`;
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
        // `readBackupFile` accepte aussi bien le format versionné que les
        // anciens fichiers à plat, et refuse tout ce qu'il ne reconnaît pas —
        // il vaut mieux rejeter un fichier étranger qu'écraser des données.
        const parsed = readBackupFile(JSON.parse(await file.text()), MODULES);
        if (!window.confirm('Importer cette sauvegarde ? Elle remplacera tes objectifs actuels.'))
          return;
        await run(() => importBackup(parsed, MODULES, coreStore));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Import impossible.');
      }
    };
    input.click();
  }

  function loadDemo() {
    void run(async () => {
      for (const demo of DEMO_GOALS) {
        await goalsStore.createGoal(
          { title: demo.title, description: demo.description, emoji: demo.emoji },
          demo.tiers,
        );
      }
    });
  }

  // --- Rendu ------------------------------------------------------------
  // Le lien de récupération passe avant tout : tant qu'un nouveau mot de passe
  // n'est pas choisi, la session ne servira qu'une fois.
  if (recovering) {
    return <PasswordRecovery onDone={() => setRecovering(false)} />;
  }
  if (coreStore.isRemote && !authReady) {
    return <div className="auth-screen">Chargement…</div>;
  }
  if (coreStore.isRemote && !user) {
    return <Landing />;
  }

  // Première visite : on guide au lieu de laisser devant un écran vide.
  if (!loading && !onboardingDone && goals.length === 0) {
    return (
      <Onboarding
        onSkip={finishOnboarding}
        onFinish={(input, tiers) => {
          finishOnboarding();
          void run(async () => {
            const created = await goalsStore.createGoal(input, tiers);
            setExpanded((set) => new Set(set).add(created.id));
          });
        }}
      />
    );
  }

  const emptyState = (
    <div className="empty">
      <h3>Aucun objectif pour l'instant</h3>
      <p>
        Un objectif se découpe en paliers, du plus accessible au plus ambitieux, et chaque palier
        porte un rang. Valide-les un par un pour faire monter ton rang global.
      </p>
      <div style={{ display: 'flex', gap: 9, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => setPicking(true)}>
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

        {/* Le pied de sidebar ne garde que l'identité du compte : tout ce qui
            se règle est passé derrière le bouton Réglages, pour qu'il n'y ait
            qu'un seul endroit où chercher — et le même sur téléphone. */}
        <div className="sidebar-foot">
          {user && (
            <div className="account" title={user.email}>
              {user.email}
            </div>
          )}
          <button className="btn btn-ghost btn-sm sidebar-settings" onClick={() => setShowSettings(true)}>
            ⚙ Réglages
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <h1 className="page-title">{VIEWS.find((v) => v.id === view)?.label}</h1>
          {/* Une seule porte vers les réglages, la même sur tous les écrans :
              sauvegardes, rappel, compte et rythme quotidien vivent tous
              derrière ce bouton. Les raccourcis en doublon qui traînaient ici
              sur téléphone donnaient deux vocabulaires pour une même chose. */}
          <div className="topbar-actions">
            <button
              className="btn topbar-settings"
              onClick={() => setShowSettings(true)}
              title="Réglages"
              aria-label="Réglages"
            >
              <span className="topbar-settings-icon" aria-hidden="true">
                ⚙
              </span>
              <span className="topbar-settings-label">Réglages</span>
            </button>
            <button
              className="btn btn-primary topbar-add"
              onClick={() => setPicking(true)}
              aria-label="Nouvel objectif"
            >
              <span aria-hidden="true">+</span>
              <span className="topbar-add-label">Objectif</span>
            </button>
          </div>
        </header>

        {pendingCount > 0 && (
          <div className="notice info" role="status">
            <strong>
              {pendingCount} action{pendingCount > 1 ? 's' : ''} en attente d'envoi.
            </strong>{' '}
            Elles sont enregistrées sur cet appareil et partiront dès le retour du réseau — rien
            n'est perdu.
          </div>
        )}

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
              actions={actions}
              checkins={checkins}
              dailyGoal={settings.dailyGoal}
              onLogAction={logAction}
              onLogOneOff={logOneOff}
              onUnlogAction={unlogAction}
              onSaveNote={saveCheckinNote}
              onSaveValue={saveCheckinValue}
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
                    onAddTier={(input, index) => addTier(goal, input, index)}
                    onUpdateTier={(tierId, patch) => {
                      if (patch.completedAt) {
                        const tier = goal.tiers.find((t) => t.id === tierId);
                        if (tier) celebrateTier(goal, tier);
                      }
                      return run(() => goalsStore.updateTier(tierId, patch));
                    }}
                    onDeleteTier={(tierId) => run(() => goalsStore.deleteTier(tierId))}
                    onMoveTier={async (tierId, direction) => moveTier(goal, tierId, direction)}
                    actions={actions}
                    checkins={checkins}
                    actionEditor={
                      <ActionEditor
                        actions={actions.filter((a) => a.goalId === goal.id)}
                        onCreate={(input: ActionInput) =>
                          run(() => goalsStore.createAction(goal.id, input))
                        }
                        onUpdate={(id, patch) => run(() => goalsStore.updateAction(id, patch))}
                        onDelete={(id) => run(() => goalsStore.deleteAction(id))}
                      />
                    }
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

      {picking && (
        <GoalPicker
          onCancel={() => setPicking(false)}
          onScratch={() => {
            setPicking(false);
            setSeedActions(null);
            setEditing({ goal: null, seed: null });
          }}
          onPick={(template: GoalTemplate) => {
            setPicking(false);
            setSeedActions(template.actions);
            setEditing({
              goal: null,
              seed: {
                title: template.title,
                description: template.description,
                emoji: template.emoji,
                tiers: template.tiers,
              },
            });
          }}
        />
      )}

      {editing && (
        <GoalEditor
          goal={editing.goal}
          seed={editing.seed}
          onCancel={() => {
            setEditing(null);
            setSeedActions(null);
          }}
          onSave={saveGoal}
        />
      )}

      {showSettings && (
        <SettingsPanel
          user={user}
          settings={settings}
          onChange={(patch) => {
            setSettings((s) => ({ ...s, ...patch }));
            void coreStore.updateSettings(patch).catch((err) => {
              setError(err instanceof Error ? err.message : 'Réglage non enregistré.');
            });
          }}
          onExport={exportJson}
          onImport={importJson}
          onClose={() => setShowSettings(false)}
        />
      )}

      {celebrations.length > 0 && (
        <Ceremony items={celebrations} onFinish={() => setCelebrations([])} />
      )}
    </div>
  );
}
