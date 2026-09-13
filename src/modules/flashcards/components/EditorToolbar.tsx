import { useEditorState, type Editor } from '@tiptap/react';

interface Props {
  editor: Editor | null;
}

type FormatKey =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'highlight'
  | 'code'
  | 'bulletList'
  | 'orderedList';

interface FormatButton {
  key: FormatKey;
  label: string;
  name: string;
  extraClass?: string;
  run: (editor: Editor) => void;
}

const BUTTONS: FormatButton[] = [
  {
    key: 'bold',
    label: 'G',
    name: 'Gras',
    extraClass: 'flashcards-format-btn-bold',
    run: (editor) => editor.chain().focus().toggleBold().run(),
  },
  {
    key: 'italic',
    label: 'I',
    name: 'Italique',
    extraClass: 'flashcards-format-btn-italic',
    run: (editor) => editor.chain().focus().toggleItalic().run(),
  },
  {
    key: 'underline',
    label: 'S',
    name: 'Souligner',
    extraClass: 'flashcards-format-btn-underline',
    run: (editor) => editor.chain().focus().toggleUnderline().run(),
  },
  {
    key: 'strike',
    label: 'B',
    name: 'Barré',
    extraClass: 'flashcards-format-btn-strike',
    run: (editor) => editor.chain().focus().toggleStrike().run(),
  },
  {
    key: 'highlight',
    label: '🖍',
    name: 'Surligner',
    extraClass: 'flashcards-format-btn-highlight',
    run: (editor) => editor.chain().focus().toggleHighlight().run(),
  },
  {
    key: 'code',
    label: '</>',
    name: 'Code',
    extraClass: 'flashcards-format-btn-code',
    run: (editor) => editor.chain().focus().toggleCode().run(),
  },
  {
    key: 'bulletList',
    label: '• Liste',
    name: 'Liste à puces',
    run: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    key: 'orderedList',
    label: '1. Liste',
    name: 'Liste numérotée',
    run: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
];

const INACTIVE: Record<FormatKey, boolean> = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  highlight: false,
  code: false,
  bulletList: false,
  orderedList: false,
};

/**
 * Boutons d'aide à la rédaction du recto/verso (§18 de l'étude, ré-écrit en
 * §19 sur Tiptap, complété en §20 avec italique/barré/code/liste numérotée —
 * les quatre premiers ne couvraient que ce qui avait été demandé mot pour
 * mot). Chaque bouton agit sur la position du curseur, pas sur une
 * sélection — comme n'importe quel éditeur de texte riche, cliquer sans
 * rien sélectionner met en forme ce qui va être tapé ensuite. `useEditorState`
 * (plutôt qu'un simple `editor.isActive(...)` lu au rendu) fait que le
 * bouton actif reste synchronisé avec la position du curseur au fil de la
 * frappe — Tiptap le recommande précisément pour ça.
 *
 * `onMouseDown` empêche le focus de quitter l'éditeur pour se poser sur le
 * bouton — sinon, sur une page qui a déjà déplacé le focus d'un éditeur
 * Tiptap à un autre (ici : passer du recto au verso), `editor.chain().focus()`
 * ne le lui rendait pas de façon fiable. Bug observé : la frappe qui suit un
 * clic sur « Liste » retombait sur le bouton — l'espace de « vino » le
 * réactivait (comportement natif d'un `<button>`), défaisant la liste.
 */
export function EditorToolbar({ editor }: Props) {
  const active =
    useEditorState({
      editor,
      selector: ({ editor }) => ({
        bold: editor?.isActive('bold') ?? false,
        italic: editor?.isActive('italic') ?? false,
        underline: editor?.isActive('underline') ?? false,
        strike: editor?.isActive('strike') ?? false,
        highlight: editor?.isActive('highlight') ?? false,
        code: editor?.isActive('code') ?? false,
        bulletList: editor?.isActive('bulletList') ?? false,
        orderedList: editor?.isActive('orderedList') ?? false,
      }),
    }) ?? INACTIVE;

  if (!editor) return null;

  return (
    <div className="flashcards-format-toolbar">
      {BUTTONS.map(({ key, label, name, extraClass, run }) => (
        <button
          key={key}
          type="button"
          className={`flashcards-format-btn${extraClass ? ` ${extraClass}` : ''}${active[key] ? ' on' : ''}`}
          title={name}
          aria-label={name}
          aria-pressed={active[key]}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => run(editor)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
