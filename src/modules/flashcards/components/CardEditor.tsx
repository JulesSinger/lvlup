import { useEffect, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import StarterKit from '@tiptap/starter-kit';
import type { Card } from '../lib/types';
import { EditorToolbar } from './EditorToolbar';

interface Props {
  card: Card | null;
  onCancel: () => void;
  onSave: (input: { front: string; back: string }) => Promise<void>;
}

/**
 * Un seul schéma pour le recto et le verso : gras, italique, souligné,
 * barré, surligné, code, liste à puces, liste numérotée — exactement les
 * huit boutons de `EditorToolbar`, rien de plus. Titres, citation, lien et
 * règle horizontale restent coupés : rares sur un recto/verso de carte, et
 * un schéma plus large que les boutons qui l'exposent serait un piège —
 * `Ctrl+1` ferait apparaître un titre qu'aucun bouton ne pourrait retirer.
 */
function bodyExtensions(placeholder: string) {
  return [
    StarterKit.configure({
      blockquote: false,
      codeBlock: false,
      heading: false,
      horizontalRule: false,
      link: false,
    }),
    Highlight,
    Placeholder.configure({ placeholder }),
  ];
}

function useCardBodyEditor(
  id: string,
  initialContent: string,
  placeholder: string,
  autofocus = false,
) {
  return useEditor({
    extensions: bodyExtensions(placeholder),
    content: initialContent,
    autofocus: autofocus ? 'end' : false,
    editorProps: {
      attributes: { id, class: 'flashcards-card-body', 'aria-label': placeholder },
    },
  });
}

/**
 * Créer ou éditer une carte : recto, verso, avec un éditeur de texte riche
 * (post-V1, voir docs/etude-flashcards.md §17-§20 — §3 avait exclu toute
 * mise en forme de la V1 ; §17-§18 réinventaient gras/liste/souligné/surligné
 * à la main avant que Jules ne préfère une bibliothèque éprouvée — Tiptap,
 * §19 — puis §20 a complété la palette avec italique/barré/code/liste
 * numérotée). Éditer ne touche jamais `box`/`dueDay` : c'est
 * `FlashcardsStore.updateCard` qui porte cette garantie, pas l'éditeur (§6
 * de l'étude).
 */
export function CardEditor({ card, onCancel, onSave }: Props) {
  const isEdit = card !== null;
  const frontEditor = useCardBodyEditor('flashcards-card-front', card?.front ?? '', 'Hola', true);
  const backEditor = useCardBodyEditor('flashcards-card-back', card?.back ?? '', 'Bonjour');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  async function submit() {
    if (!frontEditor || !backEditor) return;
    if (frontEditor.isEmpty || backEditor.isEmpty) {
      setError('Le recto et le verso sont tous les deux obligatoires.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({ front: frontEditor.getHTML(), back: backEditor.getHTML() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enregistrement impossible.');
      setSaving(false);
    }
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <div
        className="modal flashcards-card-editor"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <span className="modal-title">{isEdit ? 'Modifier la carte' : 'Nouvelle carte'}</span>
          <button className="btn btn-ghost btn-sm" onClick={onCancel} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label htmlFor="flashcards-card-front">Recto — la question</label>
            <EditorToolbar editor={frontEditor} />
            <EditorContent editor={frontEditor} />
          </div>

          <div className="field">
            <label htmlFor="flashcards-card-back">Verso — la réponse</label>
            <EditorToolbar editor={backEditor} />
            <EditorContent editor={backEditor} />
          </div>

          {error && <div className="notice error">{error}</div>}
        </div>

        <div className="modal-foot">
          <button className="btn" onClick={onCancel}>
            Annuler
          </button>
          <button className="btn btn-primary" onClick={() => void submit()} disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
