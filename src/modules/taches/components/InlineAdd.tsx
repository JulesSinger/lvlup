import { useRef, useState } from 'react';
import { parseQuickAdd, type QuickAdd } from '../lib/quickAdd';
import type { TaskList } from '../lib/types';

interface Props {
  today: string;
  lists: readonly TaskList[];
  /** Rejette en cas d'échec : le texte reste dans la ligne. */
  onAdd: (parsed: QuickAdd) => Promise<void>;
}

/**
 * Ajouter une ligne en touchant sous la dernière tâche (demande de Jules,
 * 06/10/2026), comme dans une liste papier : une ligne vide apparaît à la
 * suite, avec un texte d'exemple. Entrée l'ajoute et en ouvre une autre ;
 * Échap, ou quitter la ligne sans rien y avoir écrit, la referme. Le texte
 * est lu comme dans la barre du haut (« demain 9h », « !! »), sans les
 * pastilles : c'est le geste rapide, la barre reste là pour le détail.
 */
export function InlineAdd({ today, lists, onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  /**
   * La ligne était-elle ouverte au moment d'appuyer ? Toucher sous la liste
   * fait d'abord perdre le curseur à la ligne (qui se referme), puis ce même
   * toucher la rouvrait aussitôt : on ne pouvait pas l'annuler en touchant
   * à côté (signalé par Jules, 06/10/2026). `mousedown` arrive avant la perte
   * du curseur : c'est là qu'on regarde.
   */
  const wasOpen = useRef(false);

  async function submit(keepOpen: boolean) {
    const parsed = parseQuickAdd(text, today, lists, new Set());
    if (!parsed.title) {
      if (!keepOpen) setOpen(false);
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      await onAdd(parsed);
      setText('');
      if (!keepOpen) setOpen(false);
    } catch {
      // L'erreur est affichée par l'écran ; le texte reste pour réessayer.
    } finally {
      setBusy(false);
      // Le curseur reste dans la ligne pour la tâche suivante.
      if (keepOpen) requestAnimationFrame(() => input.current?.focus());
    }
  }

  return (
    <div
      className="taches-inline-add"
      onMouseDown={() => {
        wasOpen.current = open;
      }}
      onClick={() => {
        if (wasOpen.current) {
          // Toucher à côté d'une ligne ouverte la referme (ce qui était écrit est ajouté par la perte du curseur).
          wasOpen.current = false;
          setOpen(false);
          return;
        }
        setOpen(true);
        // Après le rendu de la ligne : le champ reçoit le curseur.
        requestAnimationFrame(() => input.current?.focus());
      }}
    >
      {open ? (
        <div className="taches-row-main taches-inline-row" onClick={(e) => e.stopPropagation()}>
          <span className="taches-check taches-inline-check" aria-hidden="true" />
          <input
            ref={input}
            className="taches-inline-input"
            type="text"
            aria-label="Nouvelle tâche"
            placeholder="Nouvelle tâche"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit(true);
              if (e.key === 'Escape') {
                setText('');
                setOpen(false);
              }
            }}
            onBlur={() => void submit(false)}
          />
        </div>
      ) : (
        <span className="taches-inline-hint">Toucher ici pour ajouter une tâche</span>
      )}
    </div>
  );
}
