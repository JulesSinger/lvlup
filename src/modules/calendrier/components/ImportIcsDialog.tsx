import { useMemo, useState } from 'react';
import { dayString, shiftDay } from '../../../core/lib/day';
import { COLOR_LABELS } from '../lib/calendarBridge';
import { parseIcs, type IcsImport, type ImportedEvent } from '../lib/ics';
import { deviceTimezone, EVENT_COLORS, type CalendarEvent, type EventColor } from '../lib/types';

interface Props {
  /** Les événements déjà là : ceux qui viennent du même calendrier ne sont pas redoublés. */
  existing: readonly CalendarEvent[];
  onImport(items: ImportedEvent[]): Promise<number>;
  onClose(): void;
}

type Since = 'all' | 'year' | 'future';
const SINCE_LABELS: Record<Since, string> = { all: 'Tout', year: 'Depuis un an', future: 'À venir seulement' };

/** Un événement encore utile à partir de `cutoff` : il finit après, ou c'est une série qui n'est pas finie. */
function keeps(item: ImportedEvent, cutoff: string | null): boolean {
  if (!cutoff) return true;
  const { recurrence, endDay } = item.event;
  if (!recurrence) return endDay >= cutoff;
  return !recurrence.until || recurrence.until >= cutoff;
}

/**
 * Importer un calendrier exporté en `.ics` — le Calendrier du Mac : *Fichier →
 * Exporter → Exporter…* (docs/etude-calendrier.md §20). Rien n'est enregistré
 * avant « Ajouter » ; rien de ce qui est déjà dans Atlas n'est touché.
 */
export function ImportIcsDialog({ existing, onImport, onClose }: Props) {
  const [files, setFiles] = useState<{ name: string; parsed: IcsImport }[]>([]);
  const [color, setColor] = useState<EventColor>('bleu');
  const [since, setSince] = useState<Since>('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<number | null>(null);

  async function choose(list: FileList | null) {
    setError('');
    setDone(null);
    const read: { name: string; parsed: IcsImport }[] = [];
    for (const file of Array.from(list ?? [])) {
      if (file.size > 20 * 1024 * 1024) {
        setError(`« ${file.name} » est trop gros (20 Mo au plus).`);
        continue;
      }
      const parsed = parseIcs(await file.text(), deviceTimezone());
      if (parsed.events.length === 0 && parsed.warnings.length === 0) setError(`« ${file.name} » ne contient aucun événement de calendrier.`);
      else read.push({ name: file.name, parsed });
    }
    setFiles(read);
  }

  const known = useMemo(() => new Set(existing.map((e) => e.sourceUid).filter(Boolean)), [existing]);
  const cutoff = since === 'all' ? null : since === 'year' ? shiftDay(dayString(), -365) : dayString();
  const all = files.flatMap((f) => f.parsed.events);
  const wanted = all.filter((e) => keeps(e, cutoff));
  const fresh = wanted.filter((e, i) => !known.has(e.uid) && wanted.findIndex((x) => x.uid === e.uid) === i);
  const already = wanted.filter((e) => known.has(e.uid)).length;
  const warnings = files.flatMap((f) => f.parsed.warnings);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const added = await onImport(fresh.map((e) => ({ ...e, event: { ...e.event, color } })));
      setDone(added);
      setFiles([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import impossible.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="overlay">
      <div className="modal calendrier-import" role="dialog" aria-modal="true" aria-label="Importer un calendrier" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="modal-title">Importer un calendrier</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p className="field-hint">
            Depuis le Calendrier du Mac : choisis un calendrier dans la liste, puis <strong>Fichier → Exporter → Exporter…</strong> Ce
            qui est déjà dans Atlas n’est jamais touché, et un événement déjà importé ne revient pas en double.
          </p>
          <div className="field">
            <label htmlFor="calendrier-ics">Fichier .ics</label>
            <input id="calendrier-ics" type="file" accept=".ics,text/calendar" multiple onChange={(e) => void choose(e.target.files)} />
          </div>

          {files.length > 0 && (
            <>
              <div className="calendrier-import-summary" role="status">
                {files.map((f) => (
                  <p key={f.name}>
                    <strong>{f.parsed.calendarName ?? f.name}</strong> : {f.parsed.events.length} événement{f.parsed.events.length > 1 ? 's' : ''}
                    {f.parsed.events.some((e) => e.event.recurrence) &&
                      `, dont ${f.parsed.events.filter((e) => e.event.recurrence).length} répété${f.parsed.events.filter((e) => e.event.recurrence).length > 1 ? 's' : ''}`}
                  </p>
                ))}
                <p className="calendrier-import-count">
                  {fresh.length === 0
                    ? 'Rien de nouveau à ajouter.'
                    : `${fresh.length} événement${fresh.length > 1 ? 's' : ''} à ajouter`}
                  {already > 0 && ` · ${already} déjà dans Atlas`}
                  {wanted.length < all.length && ` · ${all.length - wanted.length} passé${all.length - wanted.length > 1 ? 's' : ''} laissé${all.length - wanted.length > 1 ? 's' : ''} de côté`}
                </p>
              </div>

              <div className="field">
                <label>Période</label>
                <div className="calendrier-import-since" role="radiogroup" aria-label="Période">
                  {(Object.keys(SINCE_LABELS) as Since[]).map((s) => (
                    <button key={s} type="button" role="radio" aria-checked={since === s} className={`btn btn-sm${since === s ? '' : ' btn-ghost'}`} onClick={() => setSince(s)}>
                      {SINCE_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label>Couleur dans Atlas</label>
                <div className="calendrier-colors" role="radiogroup" aria-label="Couleur">
                  {EVENT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={color === c}
                      aria-label={COLOR_LABELS[c]}
                      title={COLOR_LABELS[c]}
                      className={`calendrier-color calendrier-color-${c}${color === c ? ' on' : ''}`}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </div>

              {warnings.length > 0 && (
                <details className="calendrier-import-warnings">
                  <summary>
                    {warnings.length} point{warnings.length > 1 ? 's' : ''} à savoir
                  </summary>
                  <ul>
                    {warnings.slice(0, 50).map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                    {warnings.length > 50 && <li>… et {warnings.length - 50} autres.</li>}
                  </ul>
                </details>
              )}
            </>
          )}

          {done !== null && (
            <p className="calendrier-import-done" role="status">
              {done === 0 ? 'Rien de nouveau : tout était déjà dans Atlas.' : `${done} événement${done > 1 ? 's' : ''} ajouté${done > 1 ? 's' : ''}.`}
            </p>
          )}
          {error && <div className="notice error">{error}</div>}
        </div>
        <div className="modal-foot">
          <button className="btn btn-ghost" onClick={onClose}>
            {done !== null ? 'Fermer' : 'Annuler'}
          </button>
          {files.length > 0 && (
            <button className="btn btn-primary" onClick={() => void submit()} disabled={busy || fresh.length === 0}>
              {busy ? 'Ajout…' : `Ajouter ${fresh.length} événement${fresh.length > 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
