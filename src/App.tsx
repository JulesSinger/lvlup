import { useEffect, useState } from 'react';
import { ModulePicker } from './core/components/ModulePicker';
import { PasswordRecovery } from './core/components/PasswordRecovery';
import { SettingsPanel } from './core/components/SettingsPanel';
import { coreStore } from './core/data';
import { exportBackup, importBackup, readBackupFile } from './core/data/backup';
import { DEFAULT_SETTINGS, type Settings } from './core/data/coreStore';
import { timezoneOffsetMinutes } from './core/lib/push';
import type { AppUser } from './core/lib/types';
import { MODULES } from './modules';
// Écran public d'avant connexion. Il reste porté par l'unique module
// existant — voir CLAUDE.md §4 : le renommage des surfaces publiques est
// volontairement reporté tant qu'Atlas n'a qu'un module à montrer. C'est le
// seul import de module que la coquille garde, et il devra migrer vers une
// page d'accueil propre au hub quand un second module la rendra visible.
import { Landing } from './modules/objectifs/components/Landing';

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
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [recovering, setRecovering] = useState(false);
  /**
   * Module actuellement affiché. Avec un seul module, on y entre directement
   * — l'écran de choix n'a de sens qu'à partir de deux, et c'est ce qui
   * permet à toutes les vérifications existantes de continuer à s'exécuter
   * sans passer par un clic supplémentaire.
   */
  const [moduleId, setModuleId] = useState<string | null>(
    MODULES.length === 1 ? MODULES[0].id : null,
  );
  /** Incrémenté après une restauration : signale au module actif de se relire. */
  const [reloadToken, setReloadToken] = useState(0);

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

  // Changement d'utilisateur : tout ce qui est à l'écran appartenait à la
  // session précédente. Sans ce ménage, on se connectait et le panneau de
  // réglages était déjà ouvert — celui d'où on venait de se déconnecter.
  useEffect(() => {
    setShowSettings(false);
    setError('');
    setModuleId(MODULES.length === 1 ? MODULES[0].id : null);
    if (!user) {
      setSettings(DEFAULT_SETTINGS);
      return;
    }
    void coreStore
      .getSettings()
      .then(setSettings)
      .catch((err) => setError(err instanceof Error ? err.message : 'Réglages illisibles.'));
  }, [user]);

  // Lien « mot de passe oublié » : on intercepte avant tout le reste.
  useEffect(() => coreStore.onPasswordRecovery(() => setRecovering(true)), []);

  // Le fuseau est réécrit à chaque ouverture : c'est ce qui garde le rappel à
  // la bonne heure après un changement d'heure ou un déplacement.
  useEffect(() => {
    if (!user || user.isLocal || !settings.reminderEnabled) return;
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
  if (!authReady) {
    return <div className="auth-screen">Chargement…</div>;
  }
  if (coreStore.isRemote && !user) {
    return <Landing />;
  }

  const activeModule = MODULES.find((m) => m.id === moduleId) ?? null;

  return (
    <>
      {!activeModule ? (
        <ModulePicker
          modules={MODULES}
          user={user!}
          onSelect={setModuleId}
          onOpenSettings={() => setShowSettings(true)}
        />
      ) : (
        <activeModule.Screen
          user={user!}
          settings={settings}
          error={error}
          onError={setError}
          onOpenSettings={() => setShowSettings(true)}
          onBackToHub={() => setModuleId(null)}
          reloadToken={reloadToken}
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
          modules={MODULES}
          // Inutile de proposer de « changer de module » si on est déjà sur
          // l'écran qui les liste.
          onBackToHub={activeModule ? () => setModuleId(null) : undefined}
        />
      )}
    </>
  );
}
