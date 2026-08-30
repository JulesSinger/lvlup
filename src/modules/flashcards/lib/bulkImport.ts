/**
 * Import en masse — étape 7 (docs/etude-flashcards.md §9) : coller une liste
 * plutôt que créer les cartes une par une. Pas de format bancaire compliqué
 * ici (contrairement à Astra) : une carte par ligne, recto et verso séparés
 * par une tabulation ou un point-virgule — les deux, pour accepter aussi
 * bien un texte tapé à la main (« Hola ; Bonjour ») qu'un collage depuis un
 * tableur ou un export Anki (tabulations).
 *
 * Bibliothèque pure, testée avant tout écran, même discipline que
 * `lib/boxes.ts`.
 */

export interface ParsedCard {
  front: string;
  back: string;
}

export interface BulkImportResult {
  cards: ParsedCard[];
  /** Lignes non vides qui n'ont pas pu être comprises (pas de séparateur, ou un des deux côtés vide). */
  invalid: string[];
}

function splitLine(line: string): ParsedCard | null {
  const sep = line.includes('\t') ? '\t' : line.includes(';') ? ';' : null;
  if (sep === null) return null;
  const i = line.indexOf(sep);
  const front = line.slice(0, i).trim();
  const back = line.slice(i + 1).trim();
  return front && back ? { front, back } : null;
}

export function parseBulkImport(text: string): BulkImportResult {
  const cards: ParsedCard[] = [];
  const invalid: string[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue; // ligne vide : ignorée silencieusement, ce n'est pas une erreur
    const parsed = splitLine(line);
    if (parsed) cards.push(parsed);
    else invalid.push(line);
  }
  return { cards, invalid };
}

/**
 * Sépare ce qui est déjà dans le paquet (même recto, à la casse et aux
 * espaces près) — pour qu'un import recollé par erreur ne duplique pas tout.
 */
export function withoutDuplicates(
  cards: ParsedCard[],
  existingFronts: Iterable<string>,
): { fresh: ParsedCard[]; duplicates: ParsedCard[] } {
  const known = new Set([...existingFronts].map((f) => f.trim().toLowerCase()));
  const fresh: ParsedCard[] = [];
  const duplicates: ParsedCard[] = [];
  for (const card of cards) {
    (known.has(card.front.trim().toLowerCase()) ? duplicates : fresh).push(card);
  }
  return { fresh, duplicates };
}
