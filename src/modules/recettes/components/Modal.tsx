import type { ReactNode } from 'react';
import { useEscape } from './useEscape';

/**
 * Une fenêtre du module, sur les classes communes du socle (`overlay`,
 * `modal`). Un clic à côté ne la ferme pas : une recette à moitié tapée ne
 * doit pas se perdre d'un geste maladroit (même règle que Sport et Projets).
 */
export function Modal({ title, onClose, children, footer, className = '' }: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  useEscape(onClose);
  return (
    <div className="overlay">
      <div className={`modal recettes-modal ${className}`.trim()} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <span className="modal-title">{title}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot recettes-modal-foot">{footer}</div>}
      </div>
    </div>
  );
}
