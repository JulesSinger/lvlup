import { useState } from 'react';
import { Node, NodeViewWrapper, ReactNodeViewRenderer, mergeAttributes } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { decodeDrawing, drawingSvg } from '../lib/drawing';
import { DrawingPad } from './DrawingPad';

/**
 * Le bloc « dessin » de l'éditeur : un nœud atomique (on ne tape pas dedans)
 * qui ne garde qu'un attribut, les traits sous leur forme écrite
 * (`lib/drawing.ts`). Écrit dans le HTML de la carte comme
 * `<div data-drawing="…" class="flashcards-drawing"></div>` — vide : le SVG
 * est recalculé à chaque affichage, jamais stocké.
 */
export const DrawingExtension = Node.create({
  name: 'drawing',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      data: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-drawing') ?? '',
        renderHTML: (attributes) => ({ 'data-drawing': attributes.data as string }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-drawing]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'flashcards-drawing' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(DrawingNodeView);
  },
});

function DrawingNodeView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const [editing, setEditing] = useState(false);
  const data = node.attrs.data as string;
  return (
    <NodeViewWrapper className={`flashcards-drawing-node${selected ? ' selected' : ''}`} contentEditable={false}>
      <div
        className="flashcards-drawing"
        // SVG construit par `drawingSvg` depuis des traits validés : aucune
        // chaîne de la carte n'y est recopiée telle quelle.
        dangerouslySetInnerHTML={{ __html: drawingSvg(decodeDrawing(data)) }}
      />
      <div className="flashcards-drawing-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
          ✏️ Modifier le dessin
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => deleteNode()}>
          Retirer
        </button>
      </div>
      {editing && (
        <DrawingPad
          initial={data}
          onCancel={() => setEditing(false)}
          onSave={(encoded) => {
            updateAttributes({ data: encoded });
            setEditing(false);
          }}
        />
      )}
    </NodeViewWrapper>
  );
}
