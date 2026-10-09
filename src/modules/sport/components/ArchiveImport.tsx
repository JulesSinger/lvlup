import { useState } from 'react';
import { newId } from '../../../core/data/coreStore';
import { openArchive, summarizeFile, type OpenedArchive } from '../data/readArchive';
import { planArchiveImport, readableTrack, type ArchivePlan } from '../lib/archiveImport';
import { formatKm } from '../lib/format';
import type { RunImport } from '../lib/types';
import { Modal } from './Modal';

type Step =
  | { kind: 'choose' }
  | { kind: 'reading'; done: number; total: number }
  | { kind: 'preview'; plan: ArchivePlan }
  | { kind: 'saving' }
  | { kind: 'done'; added: number };

/**
 * Reprendre l'historique depuis l'archive de Strava (docs/etude-sport.md §12) :
 * le zip tel que Strava l'envoie, ou `activities.csv` seul. Tout se lit sur
 * l'appareil ; un aperçu dit ce qui sera ajouté avant d'écrire quoi que ce
 * soit, et un second import n'ajoute rien de ce qui est déjà là.
 */
export function ArchiveImport({ knownRefs, existing, onImport, onClose }: {
  knownRefs: ReadonlySet<string>;
  /** Les sorties déjà là : celles venues du raccourci ne doivent pas revenir par l'archive. */
  existing: readonly { startedAt: string; distanceM: number }[];
  onImport: (runs: RunImport[]) => Promise<number>;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>({ kind: 'choose' });
  const [error, setError] = useState('');

  async function read(file: File) {
    setError('');
    let opened: OpenedArchive;
    try {
      opened = await openArchive(file.name, new Uint8Array(await file.arrayBuffer()));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cette archive ne se lit pas.');
      return;
    }
    // Ne lire que les fichiers des sorties nouvelles : un second import est instantané.
    const wanted = opened.reading.runs.filter((r) => !knownRefs.has(r.sourceRef) && r.file && readableTrack(r.file));
    const tracks = new Map<string, Awaited<ReturnType<typeof summarizeFile>>>();
    setStep({ kind: 'reading', done: 0, total: wanted.length });
    for (const [i, r] of wanted.entries()) {
      const data = opened.files.get(r.file!);
      if (data) tracks.set(r.file!, await summarizeFile(r.file!, data));
      if (i % 20 === 19) setStep({ kind: 'reading', done: i + 1, total: wanted.length });
    }
    setStep({ kind: 'preview', plan: planArchiveImport(opened.reading, knownRefs, tracks, newId, existing) });
  }

  async function save(plan: ArchivePlan) {
    setStep({ kind: 'saving' });
    try {
      setStep({ kind: 'done', added: await onImport(plan.runs) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import impossible.');
      setStep({ kind: 'preview', plan });
    }
  }

  const footer =
    step.kind === 'preview' ? (
      <>
        <span className="sport-spacer" />
        <button className="btn" onClick={onClose}>
          Annuler
        </button>
        <button className="btn btn-primary" disabled={step.plan.runs.length === 0} onClick={() => void save(step.plan)}>
          Importer {step.plan.runs.length} sortie{step.plan.runs.length > 1 ? 's' : ''}
        </button>
      </>
    ) : step.kind === 'done' ? (
      <>
        <span className="sport-spacer" />
        <button className="btn btn-primary" onClick={onClose}>
          Fermer
        </button>
      </>
    ) : undefined;

  return (
    <Modal title="Reprendre l’historique Strava" onClose={onClose} footer={footer}>
      {step.kind === 'choose' && (
        <>
          <p className="sport-hint">
            Sur strava.com : Paramètres → Mon compte → « Télécharger ou supprimer votre compte » → demander une archive. Elle
            arrive par e-mail : dépose ici le zip tel quel (ou le fichier <code>activities.csv</code>). Tout se lit sur ton
            appareil.
          </p>
          <label className="sport-file">
            <input type="file" accept=".zip,.csv" aria-label="Archive Strava" onChange={(e) => e.target.files?.[0] && void read(e.target.files[0])} />
          </label>
        </>
      )}
      {step.kind === 'reading' && (
        <p className="sport-hint" role="status">
          Lecture des tracés… {step.done} / {step.total}
        </p>
      )}
      {step.kind === 'preview' && (
        <div className="sport-import-preview" role="status">
          <p>
            <b>{step.plan.runs.length}</b> course{step.plan.runs.length > 1 ? 's' : ''} à ajouter
            {step.plan.runs.length > 0 && <> · {formatKm(step.plan.runs.reduce((s, r) => s + r.distanceM, 0))}</>}
          </p>
          <ul className="sport-import-facts">
            {step.plan.alreadyKnown > 0 && <li>{step.plan.alreadyKnown} déjà dans Sport, ignorée{step.plan.alreadyKnown > 1 ? 's' : ''}</li>}
            {step.plan.withTrack > 0 && <li>{step.plan.withTrack} avec leurs temps au kilomètre</li>}
            {step.plan.otherActivities > 0 && <li>{step.plan.otherActivities} autre{step.plan.otherActivities > 1 ? 's' : ''} activité{step.plan.otherActivities > 1 ? 's' : ''} (vélo, marche…) laissée{step.plan.otherActivities > 1 ? 's' : ''} de côté</li>}
            {step.plan.unreadable > 0 && <li>{step.plan.unreadable} course{step.plan.unreadable > 1 ? 's' : ''} illisible{step.plan.unreadable > 1 ? 's' : ''} (date ou distance manquante)</li>}
          </ul>
        </div>
      )}
      {step.kind === 'saving' && <p className="sport-hint" role="status">Enregistrement…</p>}
      {step.kind === 'done' && (
        <p className="sport-import-done" role="status">
          {step.added} sortie{step.added > 1 ? 's' : ''} ajoutée{step.added > 1 ? 's' : ''}.
        </p>
      )}
      {error && <p className="sport-error" role="alert">{error}</p>}
    </Modal>
  );
}
