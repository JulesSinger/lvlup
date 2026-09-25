/**
 * Recherche d'aliments — bibliothèque pure (docs/etude-nutrition.md §7).
 *
 * Elle tourne entièrement dans le navigateur, sur la table CIQUAL embarquée
 * et les aliments perso : Open Food Facts interdit la recherche pendant la
 * frappe (étude §4), et quelques milliers de noms se parcourent de toute
 * façon en une fraction de milliseconde.
 *
 * Règle : chaque mot tapé doit être le DÉBUT d'un mot du nom, sans tenir
 * compte des accents, de la casse, ni d'un pluriel en -s/-x. « poul roti »
 * trouve « Poulet, filet, rôti » ; « pommes » trouve « Pomme, crue ».
 */

/** Minuscules, sans accents ni ligatures, ponctuation remplacée par des espaces. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Un pluriel ne doit pas faire rater un aliment. On retire un -s/-x final
 * aux mots de plus de trois lettres, des deux côtés — assez pour « pommes »,
 * « noix » reste « noix » (quatre lettres, mais « noi » serait le même
 * préfixe des deux côtés, donc sans conséquence).
 */
function stem(word: string): string {
  return word.length > 3 && /[sx]$/.test(word) ? word.slice(0, -1) : word;
}

function words(text: string): string[] {
  const norm = normalize(text);
  return norm ? norm.split(' ').map(stem) : [];
}

export interface IndexedFood<T> {
  item: T;
  words: string[];
  /** Longueur du nom : à pertinence égale, le nom le plus court (le plus générique) d'abord. */
  length: number;
}

/**
 * Prépare une liste pour la recherche. À faire une fois, pas à chaque
 * frappe : c'est la normalisation qui coûte, pas la comparaison.
 */
export function buildIndex<T>(items: readonly T[], nameOf: (item: T) => string): IndexedFood<T>[] {
  return items.map((item) => {
    const name = nameOf(item);
    return { item, words: words(name), length: name.length };
  });
}

export interface SearchOptions<T> {
  /**
   * Priorité d'un aliment (récents, favoris) : plus elle est haute, plus il
   * remonte, avant toute autre considération. 0 par défaut.
   */
  priority?: (item: T) => number;
  limit?: number;
}

/**
 * Les aliments dont le nom contient tous les mots tapés, les meilleurs
 * d'abord : priorité, puis nom qui COMMENCE par le premier mot tapé, puis
 * position du premier mot trouvé, puis nom le plus court.
 */
export function searchFoods<T>(
  index: readonly IndexedFood<T>[],
  query: string,
  { priority = () => 0, limit = 30 }: SearchOptions<T> = {},
): T[] {
  const tokens = words(query);
  if (tokens.length === 0) return [];

  const matches: { entry: IndexedFood<T>; position: number; priority: number }[] = [];
  for (const entry of index) {
    let firstPosition = -1;
    let all = true;
    for (let t = 0; t < tokens.length; t++) {
      const position = entry.words.findIndex((w) => w.startsWith(tokens[t]));
      if (position === -1) {
        all = false;
        break;
      }
      if (t === 0) firstPosition = position;
    }
    if (all) matches.push({ entry, position: firstPosition, priority: priority(entry.item) });
  }

  matches.sort(
    (a, b) => b.priority - a.priority || a.position - b.position || a.entry.length - b.entry.length,
  );
  return matches.slice(0, limit).map((m) => m.entry.item);
}
