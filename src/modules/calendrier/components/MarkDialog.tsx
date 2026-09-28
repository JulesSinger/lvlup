import { useEffect } from 'react';
import type { CalendarMark, CalendarSource } from '../../../core/lib/services';

interface Props {
  source: Pick<CalendarSource, 'id' | 'label' | 'color' | 'toggleMark'>;
  mark: CalendarMark;
  onClose: () => void;
  onToggle: () => void;
  /** Ouvrir la chose dans son module (« Modifier dans Polaris ») ; absent si le hub ne le permet pas */
  onOpenInModule?: () => void;
}

const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** « mardi 29 septembre, 9 h 30 » */
function when(mark: CalendarMark): string {
  const [y, m, d] = mark.day.split('-').map(Number);
  const day = `${DAYS[new Date(y, m - 1, d).getDay()]} ${d === 1 ? '1er' : d} ${MONTHS[m - 1]}`;
  if (!mark.time) return day;
  const [h, min] = mark.time.split(':').map(Number);
  return `${day}, ${h} h${min ? ` ${String(min).padStart(2, '0')}` : ''}`;
}

/**
 * La fenêtre d'une marque d'un autre module (depuis le 28/09/2026, demande de
 * Jules : toucher une tâche dans le calendrier la cochait, sans moyen de
 * l'ouvrir). Éclipse n'affiche que ce que la marque dit d'elle-même ; pour la
 * modifier, « Modifier dans Polaris » ouvre le module sur elle — un module
 * n'affiche jamais les écrans d'un autre.
 */
export function MarkDialog({ source, mark, onClose, onToggle, onOpenInModule }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const checkable = !!mark.checkable && !!source.toggleMark;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal calendrier-mark-dialog" role="dialog" aria-modal="true" aria-label={mark.title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <span className="calendrier-mark-source" style={{ '--calendrier-layer-color': source.color } as React.CSSProperties}>
            <span className="calendrier-layer-dot" aria-hidden="true" />
            {source.label}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p className={`calendrier-mark-dialog-title${mark.done ? ' done' : ''}`}>{mark.title}</p>
          <p className="calendrier-mark-dialog-when">{when(mark)}</p>
          {mark.detail && <p className="calendrier-mark-dialog-detail">{mark.detail}</p>}
          {checkable && <p className="calendrier-mark-dialog-state">{mark.done ? '✓ Faite' : 'À faire'}</p>}
          {mark.tentative && (
            <p className="calendrier-mark-dialog-state">
              ↻ Aperçu : elle reviendra ce jour-là. On coche l’occurrence en cours ; celle-ci prendra sa place.
            </p>
          )}
        </div>
        <div className="modal-foot calendrier-editor-foot">
          {checkable && (
            <button className="btn" onClick={onToggle}>
              {mark.done ? 'Remettre à faire' : '✓ Marquer comme faite'}
            </button>
          )}
          <span className="calendrier-editor-spacer" />
          {mark.link && onOpenInModule && (
            <button className="btn btn-primary" onClick={onOpenInModule}>
              Modifier dans {source.label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
