import { useMemo } from 'react';
import { renderDrawings } from '../lib/drawing';

interface Props {
  html: string;
  className?: string;
}

/**
 * Affiche le recto/verso d'une carte, écrit par l'éditeur Tiptap de
 * `CardEditor` (§19-§20 de l'étude). `front`/`back` sont du HTML de
 * confiance : il ne provient que du schéma restreint de l'éditeur (les huit
 * boutons de `EditorToolbar` — voir les extensions désactivées dans
 * `CardEditor.tsx`), jamais d'une saisie brute injectée telle quelle. Une
 * carte créée en masse (`BulkImport`) est du texte simple sans balise : il
 * s'affiche tel quel, sans erreur.
 */
export function RichText({ html, className }: Props) {
  // Un dessin n'est stocké que sous forme de traits : son SVG est recalculé
  // ici, depuis des nombres validés (`lib/drawing.ts`).
  const rendered = useMemo(() => renderDrawings(html), [html]);
  return (
    <div
      className={`flashcards-richtext${className ? ` ${className}` : ''}`}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
}
