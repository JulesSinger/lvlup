import { useMemo } from 'react';
import { renderDrawings } from '../lib/drawing';
import { sanitizeCardHtml } from '../lib/sanitize';

interface Props {
  html: string;
  className?: string;
}

/**
 * Affiche le recto/verso d'une carte, écrit par l'éditeur Tiptap de
 * `CardEditor` (§19-§20 de l'étude). Ce HTML n'est **pas** de confiance : une
 * carte créée en masse (`BulkImport`) est du texte brut, une sauvegarde peut
 * être retouchée. Il passe donc par une liste blanche avant d'être affiché
 * (docs/securite.md §4) ; le texte brut s'y affiche tel quel, chevrons compris.
 */
export function RichText({ html, className }: Props) {
  // Le HTML est d'abord filtré (`lib/sanitize.ts`) : une carte importée ou une
  // sauvegarde retouchée ne peut rien exécuter. Un dessin n'est stocké que sous
  // forme de traits : son SVG est recalculé ici, depuis des nombres validés.
  const rendered = useMemo(() => renderDrawings(sanitizeCardHtml(html)), [html]);
  return (
    <div
      className={`flashcards-richtext${className ? ` ${className}` : ''}`}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
}
