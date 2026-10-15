import { useCallback, useEffect, useRef, useState } from 'react';
import { DemoBar, DemoOffer, ModuleChromeContext } from './core/components/DemoChrome';
import { Landing } from './core/components/Landing';
import { ModulePicker } from './core/components/ModulePicker';
import { ModuleRail } from './core/components/ModuleRail';
import { ModuleSwitcher } from './core/components/ModuleSwitcher';
import { PasswordRecovery } from './core/components/PasswordRecovery';
import { SecondFactorScreen } from './core/components/SecondFactorScreen';
import { SettingsPanel } from './core/components/SettingsPanel';
import { Tour } from './core/components/Tour';
import { WelcomeModules } from './core/components/WelcomeModules';
import { coreStore } from './core/data';
import { exportBackup, importBackup, readBackupFile } from './core/data/backup';
import { DEFAULT_SETTINGS, type Settings } from './core/data/coreStore';
import { claimDevice, forgetDeviceData } from './core/data/deviceOwner';
import { DEMO_SNAPSHOT_KEY, demoHref, demoModuleId, exitDemoHref, markDemoSeen, readSeenDemos, todayString } from './core/lib/demo';
import { orderModules, reorderSubset } from './core/lib/moduleOrder';
import { hashFor, initialModule, readLastModule, routeFromHash, saveLastModule } from './core/lib/moduleRoute';
import { timezoneOffsetMinutes } from './core/lib/push';
import { collectServices } from './core/lib/services';
import type { AppUser } from './core/lib/types';
import { hiddenAfterChoice, visibleModules } from './core/lib/workMode';
import { MODULES } from './modules';

/** Ce que chaque module oublie de l'appareil à la déconnexion (`AtlasModule.forgetDevice`). */
const forgetHooks = MODULES.flatMap((m) => (m.forgetDevice ? [() => m.forgetDevice!()] : []));

/**
 * Les services que les modules se rendent (`core/lib/services.ts`). Calculés
 * une fois : le registre ne change pas pendant la vie de l'application.
 */
/**
 * Les services des modules visibles : tous d'ordinaire, ceux du mode travail
 * sinon — un calque du calendrier d'un module caché disparaît avec lui.
 * Gardés par liste de modules, pour garder la même référence d'un rendu à l'autre.
 */
const servicesCache = new Map<string, ReturnType<typeof collectServices>>();
function servicesFor(modules: readonly (typeof MODULES)[number][]) {
  const key = modules.map((m) => m.id).join(',');
  if (!servicesCache.has(key)) servicesCache.set(key, collectServices(modules));
  return servicesCache.get(key)!;
}
const MODULE_IDS = MODULES.map((m) => m.id);
/** Le module de la démo en cours (`?demo=…`), s'il en a une. */
const DEMO_MODULE = demoModuleId ? (MODULES.find((m) => m.id === demoModuleId && m.demo) ?? null) : null;

/** Le module à ouvrir maintenant : celui de l'adresse, sinon le dernier, sinon la liste. */
const startingModule = () => initialModule(window.location.hash, readLastModule(), MODULE_IDS);

/** Un champ où l'on tape : les raccourcis clavier ne s'y déclenchent pas. */
const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/**
 * La coquille du hub.
 *
 * Elle ne connaît aucun domaine : authentification, choix du module,
 * panneau de réglages, export/import de la sauvegarde et la plomberie
 * d'erreurs. Tout le reste — les écrans, les données, les célébrations —
 * appartient au module choisi, reçu à travers `module.Screen`.
 */
export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  /** Les réglages du compte sont lus : avant, on ne sait pas encore s'il faut proposer de choisir ses modules. */
  const [settingsReady, setSettingsReady] = useState(false);
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [recovering, setRecovering] = useState(false);
  /**
   * Module actuellement affiché : celui de l'adresse (`#/budget`), sinon le
   * dernier ouvert sur cet appareil, sinon la liste (`core/lib/moduleRoute.ts`,
   * depuis le 30/09/2026 — avant, Atlas repartait toujours de la liste). Avec
   * un seul module, on y entre directement.
   */
  const [moduleId, setModuleId] = useState<string | null>(startingModule);
  /** La grille des modules est ouverte. */
  const [switching, setSwitching] = useState(false);
  /** Ce qu'un module a demandé d'ouvrir chez un autre (« task:<id> ») ; le socle ne le lit pas. */
  const [intent, setIntent] = useState<string | null>(null);
  /** Incrémenté après une restauration : signale au module actif de se relire. */
  const [reloadToken, setReloadToken] = useState(0);
  /** En démo, les exemples sont posés avant que l'écran du module ne lise quoi que ce soit. */
  const [demoReady, setDemoReady] = useState(demoModuleId === null);
  const [touring, setTouring] = useState(false);
  /** Les démos déjà proposées sur cet appareil (une seule fois, à la première ouverture). */
  const [seenDemos, setSeenDemos] = useState(readSeenDemos);

  // La démo (15/10/2026) : un stockage à part, vidé, rempli par le module, puis la visite.
  useEffect(() => {
    if (demoModuleId === null) return;
    if (!DEMO_MODULE) {
      window.location.replace(exitDemoHref(demoModuleId));
      return;
    }
    void (async () => {
      try {
        localStorage.removeItem(DEMO_SNAPSHOT_KEY);
      } catch {
        // Navigation privée : les exemples s'écrivent quand même, le temps de la page.
      }
      markDemoSeen(DEMO_MODULE.id);
      try {
        await DEMO_MODULE.demo!.seed(todayString());
      } catch (err) {
        console.warn('Démo : exemples incomplets', err);
      }
      setModuleId(DEMO_MODULE.id);
      setDemoReady(true);
      setTouring(true);
    })();
  }, []);

  const openDemo = (id: string) => {
    markDemoSeen(id);
    window.location.assign(demoHref(id));
  };
  const exitDemo = () => {
    try {
      localStorage.removeItem(DEMO_SNAPSHOT_KEY);
    } catch {
      // Rien à vider.
    }
    window.location.assign(exitDemoHref(demoModuleId ?? ''));
  };

  useEffect(() => {
    const unsubscribe = coreStore.onUserChange((next) => {
      // Avant tout écran, donc avant tout envoi de file d'attente : l'appareil
      // passe à ce compte, et ce qu'un autre y a laissé est mis de côté ou
      // oublié (docs/securite.md §3). Sans compte, l'appareil est à lui seul.
      if (next && !next.isLocal && claimDevice(next.id)) void forgetDeviceData(forgetHooks);
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

  // Changement d'utilisateur : tout ce qui est à l'écran appartenait à la
  // session précédente. Sans ce ménage, on se connectait et le panneau de
  // réglages était déjà ouvert — celui d'où on venait de se déconnecter.
  //
  // La dépendance est `user?.id`, pas `user` : en mode Supabase,
  // `onUserChange` (`supabaseCore.ts`) rappelle ce callback à chaque
  // événement `onAuthStateChange` — y compris un `TOKEN_REFRESHED` qui ne
  // change rien à la session, et que Supabase déclenche entre autres quand
  // l'onglet ou l'app reprend le focus. Chaque appel construit un nouvel
  // objet `AppUser`, distinct par référence même à contenu identique ; en
  // dépendant de `user` lui-même, cet effet se rejouait à chaque reprise de
  // focus et ramenait Astra comme Zénith sur l'écran de choix des modules —
  // rapporté par l'utilisateur. Ne dépendre que de l'identifiant ignore les
  // ré-émissions du même compte et ne réagit qu'à un changement réel
  // (connexion, déconnexion, autre compte).
  // Une déconnexion : ce que l'appareil gardait du compte s'oublie (copies,
  // photos en cache) ; ses écritures pas encore parties, elles, attendent son
  // retour (docs/securite.md §3).
  const previousUser = useRef<AppUser | null>(null);
  useEffect(() => {
    const before = previousUser.current;
    previousUser.current = user;
    if (before && !before.isLocal && !user) void forgetDeviceData(forgetHooks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    setShowSettings(false);
    setSwitching(false);
    setError('');
    setModuleId(startingModule());
    // Code de la double authentification pas encore donné : la base ne rendrait
    // rien ; les réglages se lisent une fois le code accepté (même compte, d'où
    // la seconde dépendance).
    setSettingsReady(false);
    if (!user || user.needsSecondFactor) {
      setSettings(DEFAULT_SETTINGS);
      return;
    }
    void coreStore
      .getSettings()
      .then(setSettings)
      .catch((err) => setError(err instanceof Error ? err.message : 'Réglages illisibles.'))
      .finally(() => setSettingsReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.needsSecondFactor]);

  /**
   * Aller à un module (ou à la liste, `null`). Chaque changement ajoute une
   * entrée à l'historique : le geste « retour » du téléphone ou du navigateur
   * ramène au module d'avant. L'adresse n'est jamais réécrite au démarrage —
   * seulement ici, sur un geste de l'utilisateur — pour ne pas écraser un lien
   * de Supabase avant qu'il ait été lu.
   */
  const navigate = useCallback((id: string | null, nextIntent: string | null = null) => {
    setError('');
    setIntent(nextIntent);
    setSwitching(false);
    setModuleId(id);
    saveLastModule(id);
    const hash = hashFor(id);
    if (window.location.hash !== hash) window.history.pushState(null, '', hash);
  }, []);

  // Une ouverture sans hash (l'icône de l'écran d'accueil) : on inscrit la route
  // de départ sans ajouter d'entrée, pour que le premier « retour » y ramène.
  // Seulement quand l'adresse n'a AUCUN hash : un lien de Supabase n'est jamais touché.
  useEffect(() => {
    if (!window.location.hash) window.history.replaceState(null, '', hashFor(startingModule()));
  }, []);

  // Le mode travail cache le module ouvert (ou visé par l'adresse) : retour franc à la liste,
  // sans entrée de plus. Gardé en mémoire, il se rouvrirait tout seul en redevenant visible.
  useEffect(() => {
    if (!moduleId || !MODULE_IDS.includes(moduleId)) return;
    if (visibleModules(MODULES, settings).some((m) => m.id === moduleId)) return;
    setModuleId(null);
    saveLastModule(null);
    window.history.replaceState(null, '', hashFor(null));
  }, [moduleId, settings]);

  // Retour et avant du navigateur : l'adresse dit où aller.
  useEffect(() => {
    const onPop = () => {
      const hash = window.location.hash;
      const route = hash ? routeFromHash(hash, MODULE_IDS) : null;
      if (route === undefined) return; // un hash qui n'est pas à nous (Supabase…)
      setSwitching(false);
      setIntent(null);
      setModuleId(MODULES.length === 1 ? MODULES[0].id : route);
      saveLastModule(route);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // ⌘K / Ctrl+K ouvre la grille des modules, partout sauf en tapant.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'k' || !(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      if (isTyping(e.target) || !user) return;
      e.preventDefault();
      setSwitching((open) => !open);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [user]);

  // Lien « mot de passe oublié » : on intercepte avant tout le reste.
  useEffect(() => coreStore.onPasswordRecovery(() => setRecovering(true)), []);

  // Le fuseau est réécrit à chaque ouverture : c'est ce qui garde le rappel à
  // la bonne heure après un changement d'heure ou un déplacement.
  useEffect(() => {
    if (!user || user.isLocal || user.needsSecondFactor || !settings.reminderEnabled) return;
    const offset = timezoneOffsetMinutes();
    if (offset === settings.tzOffset) return;
    void coreStore.updateSettings({ tzOffset: offset }).catch(() => {});
    setSettings((s) => ({ ...s, tzOffset: offset }));
  }, [user, settings.reminderEnabled, settings.tzOffset]);

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
        await importBackup(parsed, MODULES, coreStore);
        setSettings(await coreStore.getSettings());
        // Le hub ne sait pas relire les données d'un module : c'est ce
        // compteur qui le lui dit.
        setReloadToken((t) => t + 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Import impossible.');
      }
    };
    input.click();
  }

  // --- Rendu ------------------------------------------------------------
  // Le lien de récupération passe avant tout : tant qu'un nouveau mot de passe
  // n'est pas choisi, la session ne servira qu'une fois.
  if (recovering) {
    return <PasswordRecovery onDone={() => setRecovering(false)} />;
  }
  // En mode local comme en mode Supabase, `user` n'est fiable qu'une fois
  // `authReady` passé : avant ça, le rendu ne doit jamais le déréférencer.
  if (!authReady || !demoReady) {
    return <div className="auth-screen">Chargement…</div>;
  }
  if (coreStore.isRemote && !user) {
    return <Landing modules={MODULES} />;
  }
  // Mot de passe donné, code pas encore : rien d'autre ne s'affiche (docs/securite.md §7).
  if (user?.needsSecondFactor) {
    return <SecondFactorScreen email={user.email} />;
  }

  if (user && !settingsReady && !DEMO_MODULE) {
    return <div className="auth-screen">Chargement…</div>;
  }
  // Un compte tout neuf choisit d'abord ses modules (15/10/2026), plutôt que d'arriver sur tous.
  if (user && !DEMO_MODULE && settings.hiddenModules === null) {
    return (
      <WelcomeModules
        modules={orderModules(MODULES, settings.moduleOrder)}
        user={user}
        onChoose={(chosen) => {
          const hiddenModules = hiddenAfterChoice(MODULE_IDS, chosen);
          setSettings((s) => ({ ...s, hiddenModules }));
          void coreStore.updateSettings({ hiddenModules }).catch((err) => {
            setError(err instanceof Error ? err.message : 'Choix des modules non enregistré.');
          });
          navigate(null);
        }}
      />
    );
  }

  // Le mode « au travail » (14/10/2026) : seuls ses modules restent ; un module caché ne s'ouvre pas.
  // En démo, le seul module de la démo.
  const shown = DEMO_MODULE ? [DEMO_MODULE] : visibleModules(MODULES, settings);
  const activeModule = shown.find((m) => m.id === moduleId) ?? null;
  // L'ordre choisi à la main (13/10/2026) ; le registre reste la liste des modules.
  const ordered = orderModules(shown, settings.moduleOrder);
  const services = servicesFor(shown);
  const changeSettings = (patch: Partial<Settings>, failure: string) => {
    setSettings((s) => ({ ...s, ...patch }));
    void coreStore.updateSettings(patch).catch((err) => {
      setError(err instanceof Error ? err.message : failure);
    });
  };
  // En mode travail, on ne glisse que les modules visibles : les autres gardent leur place.
  const reorderModules = (order: string[]) =>
    changeSettings({ moduleOrder: reorderSubset(orderModules(MODULES, settings.moduleOrder).map((m) => m.id), order) }, 'Ordre des modules non enregistré.');
  const toggleWorkMode = () => changeSettings({ workMode: !settings.workMode }, 'Mode travail non enregistré.');

  return (
    <>
      {!activeModule ? (
        <ModulePicker
          modules={ordered}
          onReorder={reorderModules}
          user={user!}
          onSelect={(id) => navigate(id)}
          onOpenSettings={() => setShowSettings(true)}
          workMode={settings.workMode}
          onToggleWorkMode={toggleWorkMode}
          hiddenCount={settings.hiddenModules?.filter((id) => MODULE_IDS.includes(id)).length ?? 0}
        />
      ) : (
        <div className="atlas-shell">
          <ModuleRail
            modules={ordered}
            onReorder={reorderModules}
            activeId={activeModule.id}
            onSelect={(id) => navigate(id)}
            onHome={() => navigate(null)}
            workMode={settings.workMode}
            onToggleWorkMode={toggleWorkMode}
          />
          <div className="atlas-shell-main">
            {DEMO_MODULE && (
              <DemoBar label={DEMO_MODULE.label} emoji={DEMO_MODULE.emoji} onReplay={() => setTouring(true)} onExit={exitDemo} />
            )}
            {!DEMO_MODULE && activeModule.demo && !seenDemos.includes(activeModule.id) && (
              <DemoOffer
                label={activeModule.label}
                emoji={activeModule.emoji}
                onAccept={() => openDemo(activeModule.id)}
                onDismiss={() => {
                  markDemoSeen(activeModule.id);
                  setSeenDemos(readSeenDemos());
                }}
              />
            )}
            <ModuleChromeContext.Provider
              value={{
                // Le « ? » : en démo, revoir la visite ; sinon, ouvrir la démo.
                onDemo: activeModule.demo ? () => (DEMO_MODULE ? setTouring(true) : openDemo(activeModule.id)) : undefined,
              }}
            >
            <activeModule.Screen
              // La clé remonte l'écran quand on change de module : chacun repart de son propre état.
              key={activeModule.id}
              user={user!}
              settings={settings}
              error={error}
              onError={setError}
              onOpenSettings={() => setShowSettings(true)}
              onBackToHub={() => navigate(null)}
              onSwitchModule={() => setSwitching(true)}
              label={activeModule.label}
              emoji={activeModule.emoji}
              onOpenModule={(id, next) => {
                // Un module absent du registre : rien à ouvrir, on reste où l'on est.
                // Un module caché par le mode travail ne s'ouvre pas non plus.
                if (!shown.some((m) => m.id === id)) return;
                navigate(id, next ?? null);
              }}
              intent={intent}
              reloadToken={reloadToken}
              services={services}
            />
            </ModuleChromeContext.Provider>
            {touring && activeModule.demo && <Tour steps={activeModule.demo.tour} onClose={() => setTouring(false)} />}
          </div>
        </div>
      )}

      {switching && (
        <ModuleSwitcher
          modules={ordered}
          onReorder={reorderModules}
          activeId={activeModule?.id ?? null}
          onSelect={(id) => navigate(id)}
          onHome={() => navigate(null)}
          onClose={() => setSwitching(false)}
          workMode={settings.workMode}
          onToggleWorkMode={toggleWorkMode}
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
          // Les sections des seuls modules visibles ; le choix du mode travail porte sur tous.
          modules={shown}
          allModules={MODULES}
          onDemo={DEMO_MODULE ? undefined : openDemo}
          // Inutile de proposer de « changer de module » si on est déjà sur
          // l'écran qui les liste.
          onBackToHub={activeModule ? () => navigate(null) : undefined}
        />
      )}
    </>
  );
}
