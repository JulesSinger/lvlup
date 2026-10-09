import { useEffect, useState } from 'react';
import { NotificationSetup } from '../../core/components/NotificationSetup';
import { dayString } from '../../core/lib/day';
import type { ModuleSettingsProps } from '../../core/lib/module';
import { hautsFaitsStore } from './data';
import { buildPhotoArchive } from './data/photoArchive';
import { settingsChanged } from './data/settingsSignal';
import { syncReminders } from './data/syncReminders';
import { formatBytes } from '../../core/lib/images';
import { DEFAULT_HAUTSFAITS_SETTINGS, type HautsFaitsSettings } from './lib/types';

/**
 * La date de naissance, dans le panneau de réglages commun. Facultative :
 * sans elle, la frise ne dit pas l'âge qu'on avait (docs/etude-hauts-faits.md
 * §3). Elle est rangée avec le compte, pas sur l'appareil.
 *
 * Et la place prise par les photos (étude §5.2) : avec un compte, le Go
 * gratuit du projet est commun à tous ceux qui utilisent Atlas.
 *
 * Depuis l'étape 6 : le rappel « Ce jour-là » (coupé par défaut, avec un
 * compte seulement) et « Télécharger toutes mes photos », la copie des
 * photos que la sauvegarde JSON ne contient pas (étude §5.6).
 */
export function HautsFaitsSettingsSection({ user }: ModuleSettingsProps) {
  const [settings, setSettings] = useState<HautsFaitsSettings | null>(null);
  const [usage, setUsage] = useState<{ count: number; bytes: number } | null>(null);
  const [problem, setProblem] = useState('');
  const [archiving, setArchiving] = useState<{ done: number; total: number } | null>(null);
  const [archiveNote, setArchiveNote] = useState('');
  const local = !user || user.isLocal;

  useEffect(() => {
    hautsFaitsStore.getSettings().then(setSettings, () => setSettings({ ...DEFAULT_HAUTSFAITS_SETTINGS }));
    hautsFaitsStore.listPhotos().then(
      (photos) => setUsage({ count: photos.length, bytes: photos.reduce((sum, p) => sum + p.bytes, 0) }),
      () => setUsage(null),
    );
  }, []);

  async function change(patch: Partial<HautsFaitsSettings>) {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    setProblem('');
    try {
      await hautsFaitsStore.saveSettings(patch);
      settingsChanged(next);
      if ('onThisDayReminder' in patch) await syncReminders();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Enregistrement impossible.');
    }
  }

  async function downloadArchive() {
    setArchiveNote('');
    setArchiving({ done: 0, total: usage?.count ?? 0 });
    try {
      const { blob, missing } = await buildPhotoArchive((done, total) => setArchiving({ done, total }));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hauts-faits-photos-${dayString()}.zip`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      if (missing) setArchiveNote(`${missing} photo${missing > 1 ? 's' : ''} introuvable${missing > 1 ? 's' : ''}, laissée${missing > 1 ? 's' : ''} de côté.`);
    } catch (err) {
      setArchiveNote(err instanceof Error ? err.message : 'L’archive n’a pas pu être préparée.');
    }
    setArchiving(null);
  }

  if (!settings) return null;

  return (
    <section className="settings-block hautsfaits-settings">
      <h3 className="settings-title">Ta date de naissance</h3>
      <p className="settings-hint">Pour que la frise de tes hauts faits dise l’âge que tu avais. Facultative.</p>
      <label className="settings-time">
        <span>Née ou né le</span>
        <input
          type="date"
          aria-label="Date de naissance"
          max={dayString()}
          value={settings.birthDate ?? ''}
          onChange={(e) => void change({ birthDate: e.target.value || null })}
        />
      </label>
      {usage && usage.count > 0 && (
        <p className="settings-hint hautsfaits-usage">
          Tes photos : {usage.count} photo{usage.count > 1 ? 's' : ''}, {formatBytes(usage.bytes)}
          {local ? ', rangées dans ce navigateur.' : ' — le Go gratuit d’Atlas est commun à tous ses comptes.'}
        </p>
      )}
      {usage && usage.count > 0 && (
        <div className="hautsfaits-archive">
          <button className="btn btn-sm" disabled={archiving !== null} onClick={() => void downloadArchive()}>
            {archiving ? `Préparation… ${archiving.done} / ${archiving.total}` : 'Télécharger toutes mes photos (.zip)'}
          </button>
          <p className="settings-hint">La sauvegarde garde la liste de tes photos, pas les images : cette archive en est la copie.</p>
          {archiveNote && <p className="settings-problem">{archiveNote}</p>}
        </div>
      )}

      <h3 className="settings-title">Ce jour-là</h3>
      <p className="settings-hint">Une notification le matin, à 9 h, le jour anniversaire d’un haut fait daté au jour près.</p>
      {local ? (
        <div className="notice info">Les rappels demandent un compte : sans serveur, rien ne peut partir.</div>
      ) : (
        <>
          <label className="switch">
            <input type="checkbox" checked={settings.onThisDayReminder} onChange={(e) => void change({ onThisDayReminder: e.target.checked })} />
            <span>Me rappeler les anniversaires de mes hauts faits</span>
          </label>
          {settings.onThisDayReminder && <NotificationSetup />}
        </>
      )}
      {problem && <p className="settings-problem">{problem}</p>}
    </section>
  );
}
