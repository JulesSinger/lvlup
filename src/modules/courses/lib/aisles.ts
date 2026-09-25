/**
 * Les rayons — bibliothèque pure (docs/etude-courses.md §6) : deviner le
 * rayon d'un article d'après son nom, et trier la liste dans l'ordre d'un
 * parcours de magasin.
 */
import { AISLES, type Aisle, type Item, type ListEntry } from './types';

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
 * Mots qui trahissent un rayon, au singulier et sans accents. L'ordre des
 * rayons compte : le premier qui reconnaît un mot l'emporte, d'où les
 * rayons les plus précis d'abord (« lait de coco » est de l'épicerie, pas
 * de la crèmerie ; « eau de javel » de l'entretien, pas une boisson).
 */
const KEYWORDS: [Aisle, string[]][] = [
  ['bebe', ['couche', 'lingette bebe', 'petit pot', 'lait infantile', 'biberon']],
  ['animaux', ['croquette', 'litiere', 'patee', 'chat', 'chien']],
  ['entretien', ['javel', 'lessive', 'liquide vaisselle', 'eponge', 'sac poubelle', 'essuie tout', 'papier toilette', 'nettoyant', 'adoucissant', 'pastille lave']],
  ['hygiene', ['shampoing', 'shampooing', 'gel douche', 'savon', 'dentifrice', 'brosse a dent', 'deodorant', 'coton', 'rasoir', 'mouchoir', 'serviette hygienique', 'tampon']],
  ['surgeles', ['surgele', 'glace', 'frite surgelee', 'pizza surgelee', 'poelee']],
  ['epicerie_salee', ['lait de coco', 'pate', 'riz', 'semoule', 'farine', 'huile', 'vinaigre', 'sel', 'poivre', 'epice', 'conserve', 'thon', 'sauce', 'moutarde', 'ketchup', 'mayonnaise', 'lentille', 'pois chiche', 'haricot', 'soupe', 'bouillon', 'chips', 'olive', 'quinoa']],
  ['epicerie_sucree', ['sucre', 'cafe', 'the', 'chocolat', 'confiture', 'miel', 'cereale', 'biscuit', 'gateau', 'compote', 'pate a tartiner', 'bonbon', 'muesli', 'flocon']],
  ['boissons', ['eau', 'jus', 'soda', 'coca', 'biere', 'vin', 'sirop', 'limonade']],
  ['boulangerie', ['pain', 'baguette', 'croissant', 'brioche', 'viennoiserie', 'pain de mie']],
  ['cremerie', ['lait', 'yaourt', 'yogourt', 'fromage', 'beurre', 'creme', 'oeuf', 'skyr', 'emmental', 'comte', 'mozzarella', 'camembert', 'fromage blanc']],
  ['boucherie_poissonnerie', ['poulet', 'boeuf', 'porc', 'veau', 'agneau', 'dinde', 'jambon', 'lardon', 'saucisse', 'steak', 'viande', 'poisson', 'saumon', 'cabillaud', 'crevette', 'charcuterie']],
  ['fruits_legumes', ['pomme', 'poire', 'banane', 'orange', 'citron', 'fraise', 'raisin', 'kiwi', 'tomate', 'salade', 'carotte', 'courgette', 'aubergine', 'poivron', 'oignon', 'ail', 'echalote', 'avocat', 'concombre', 'champignon', 'brocoli', 'epinard', 'legume', 'fruit', 'pomme de terre', 'patate', 'poireau', 'melon', 'peche']],
];

/** Un -s/-x final retiré aux mots de plus de trois lettres : « tomates » = « tomate ». */
const singular = (text: string) =>
  text
    .split(' ')
    .map((w) => (w.length > 3 && /[sx]$/.test(w) ? w.slice(0, -1) : w))
    .join(' ');

/**
 * Le rayon probable d'un article, d'après son nom. Une proposition
 * seulement : l'utilisateur la corrige d'un geste, et l'article garde
 * ensuite son rayon. « autre » si rien ne correspond.
 *
 * Un mot-clé doit correspondre à des mots entiers (« the » ne doit pas
 * reconnaître « thon »). Parmi les candidats, le mot-clé le plus long
 * l'emporte (« pomme de terre » avant « pomme »), puis l'ordre des rayons.
 */
export function guessAisle(name: string): Aisle {
  const text = ` ${singular(normalize(name))} `;
  let best: { aisle: Aisle; length: number } | null = null;
  for (const [aisle, words] of KEYWORDS) {
    for (const word of words) {
      if (text.includes(` ${word} `) && (!best || word.length > best.length)) {
        best = { aisle, length: word.length };
      }
    }
  }
  return best?.aisle ?? 'autre';
}

/** Une ligne de la liste avec son article, telle que l'écran l'affiche. */
export interface ListLine {
  entry: ListEntry;
  item: Item;
}

export interface AisleGroup {
  aisle: Aisle;
  lines: ListLine[];
}

/**
 * La liste rangée par rayon, dans l'ordre de `AISLES` (celui d'un parcours
 * de magasin), rayons vides omis. Dans un rayon : ce qui reste à prendre
 * d'abord, par ordre alphabétique, puis ce qui est déjà dans le panier.
 * Une ligne dont l'article a disparu n'est pas affichée.
 */
export function groupByAisle(entries: readonly ListEntry[], items: readonly Item[]): AisleGroup[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const groups = new Map<Aisle, ListLine[]>();
  for (const entry of entries) {
    const item = byId.get(entry.itemId);
    if (!item) continue;
    groups.set(item.aisle, [...(groups.get(item.aisle) ?? []), { entry, item }]);
  }
  return AISLES.filter((a) => groups.has(a)).map((aisle) => ({
    aisle,
    lines: (groups.get(aisle) as ListLine[]).sort(
      (a, b) =>
        Number(a.entry.checked) - Number(b.entry.checked) || a.item.name.localeCompare(b.item.name, 'fr'),
    ),
  }));
}
