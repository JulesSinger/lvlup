/**
 * La typologie d'un achat — bibliothèque pure (docs/etude-courses-typologies.md §3).
 *
 * Le rayon sert à se déplacer dans le magasin ; la typologie sert à comprendre
 * la dépense. Deux niveaux : une typologie, liste fixe (Alimentation, Hygiène et
 * beauté…), et pour l'alimentation seulement, un sous-type (essentiel, plaisir,
 * alcool) — décisions de Jules, 14/10/2026.
 *
 * Un article reçoit sa typologie, dans cet ordre : celle qu'on lui a donnée
 * (l'article du catalogue la garde, et ses courses passées la suivent — « aussi
 * pour les passés ») ; sinon, devinée de mots-clés, puis de son rayon.
 */
import { normalize, singular } from './aisles';
import type { Aisle, Item, TripItem } from './types';

export const TYPOLOGIES = ['alimentation', 'hygiene', 'entretien', 'maison', 'bebe', 'animaux', 'autre'] as const;
export type Typology = (typeof TYPOLOGIES)[number];

export const TYPOLOGY_LABELS: Record<Typology, string> = {
  alimentation: 'Alimentation',
  hygiene: 'Hygiène et beauté',
  entretien: 'Entretien',
  maison: 'Maison et équipement',
  bebe: 'Bébé',
  animaux: 'Animaux',
  autre: 'Autre',
};

export const TYPOLOGY_EMOJIS: Record<Typology, string> = {
  alimentation: '🥖',
  hygiene: '🧴',
  entretien: '🧽',
  maison: '🏠',
  bebe: '👶',
  animaux: '🐾',
  autre: '📦',
};

/** Le second niveau, pour l'alimentation seulement. */
export const FOOD_KINDS = ['essentiel', 'plaisir', 'alcool'] as const;
export type FoodKind = (typeof FOOD_KINDS)[number];

export const FOOD_KIND_LABELS: Record<FoodKind, string> = {
  essentiel: 'Essentiel',
  plaisir: 'Plaisir',
  alcool: 'Alcool',
};

/** Le rayon dit la typologie, quand aucun mot ne dit mieux. */
export const AISLE_TYPOLOGY: Record<Aisle, Typology> = {
  fruits_legumes: 'alimentation',
  boulangerie: 'alimentation',
  cremerie: 'alimentation',
  boucherie_poissonnerie: 'alimentation',
  epicerie_salee: 'alimentation',
  epicerie_sucree: 'alimentation',
  surgeles: 'alimentation',
  boissons: 'alimentation',
  hygiene: 'hygiene',
  entretien: 'entretien',
  bebe: 'bebe',
  animaux: 'animaux',
  autre: 'autre',
};

/**
 * Ce que le rayon ne dit pas : l'équipement de la maison (rangé en « autre »),
 * et dans l'alimentation, le plaisir et l'alcool. Mots entiers, au singulier,
 * sans accents ; le plus long l'emporte (« vin blanc » avant « vin »), comme
 * pour les rayons (`guessAisle`).
 */
export const TYPOLOGY_KEYWORDS: [Typology, string[]][] = [
  [
    'maison',
    ['ampoule', 'pile', 'abattant', 'pese personne', 'balance', 'cuvette', 'bassine', 'seau', 'poele', 'casserole', 'assiette', 'verre a', 'couvert',
     'torchon', 'serviette de bain', 'drap', 'oreiller', 'bougie', 'rallonge', 'multiprise', 'chargeur', 'cable', 'boite de rangement', 'cintre',
     'tournevis', 'scotch', 'ruban adhesif', 'colle', 'cadenas', 'plante', 'pot de fleur', 'vaisselle', 'tupperware', 'cafetiere', 'bouilloire'],
  ],
  ['hygiene', ['papier toilette', 'mouchoir', 'coton tige', 'creme hydratante', 'maquillage', 'vernis', 'parfum', 'protection periodique']],
];

export const FOOD_KIND_KEYWORDS: [FoodKind, string[]][] = [
  ['alcool', ['biere', 'vin', 'vin blanc', 'vin rouge', 'vin rose', 'champagne', 'cidre', 'whisky', 'rhum', 'vodka', 'gin', 'pastis', 'ricard', 'aperol', 'spritz', 'liqueur', 'cremant', 'prosecco', 'porto', 'martini']],
  [
    'plaisir',
    ['chip', 'cacahuete', 'pistache', 'olive', 'biscuit apero', 'gateau apero', 'crackers', 'tuc', 'saucisson', 'tapenade', 'houmous', 'guacamole', 'dip',
     'bonbon', 'chocolat', 'barre chocolatee', 'glace', 'sorbet', 'gateau', 'cookie', 'brownie', 'patisserie', 'viennoiserie', 'croissant', 'pain au chocolat',
     'soda', 'coca', 'limonade', 'ice tea', 'pizza', 'burger', 'nugget', 'frite', 'nutella', 'pate a tartiner', 'bonbon', 'confiserie', 'dessert', 'creme dessert',
     'tiramisu', 'macaron', 'kit tacos', 'kit fajitas'],
  ],
];

function bestMatch<T extends string>(name: string, table: [T, string[]][]): T | null {
  const text = ` ${singular(normalize(name))} `;
  let best: { key: T; length: number } | null = null;
  for (const [key, words] of table) {
    for (const word of words) {
      if (text.includes(` ${word} `) && (!best || word.length > best.length)) best = { key, length: word.length };
    }
  }
  return best?.key ?? null;
}

export interface Classification {
  typology: Typology;
  /** Seulement pour l'alimentation */
  foodKind: FoodKind | null;
}

/** La typologie probable d'un article, d'après son nom et son rayon. */
export function guessTypology(name: string, aisle: Aisle): Classification {
  const typology = bestMatch(name, TYPOLOGY_KEYWORDS) ?? AISLE_TYPOLOGY[aisle];
  if (typology !== 'alimentation') return { typology, foodKind: null };
  return { typology, foodKind: bestMatch(name, FOOD_KIND_KEYWORDS) ?? 'essentiel' };
}

/**
 * La typologie retenue : celle donnée à la ligne (une ligne sans article du
 * catalogue), sinon celle de l'article, sinon devinée. Un sous-type n'a de
 * sens que pour l'alimentation : il est retiré ailleurs, et deviné s'il manque.
 */
export function classify(
  own: { typology: Typology | null; foodKind: FoodKind | null } | null,
  item: { typology: Typology | null; foodKind: FoodKind | null } | null,
  name: string,
  aisle: Aisle,
): Classification {
  const chosen = own?.typology ? own : item?.typology ? item : null;
  if (!chosen?.typology) return guessTypology(name, aisle);
  if (chosen.typology !== 'alimentation') return { typology: chosen.typology, foodKind: null };
  return { typology: 'alimentation', foodKind: chosen.foodKind ?? guessTypology(name, aisle).foodKind ?? 'essentiel' };
}

// --- Ce qu'une course a coûté, par typologie -----------------------------------------

/** Une clé de répartition : la typologie, et le sous-type pour l'alimentation. */
export const spendKey = (c: Classification) => (c.foodKind ? `${c.typology}:${c.foodKind}` : c.typology);

export interface SpendLine {
  /** La ligne de la course (`courses_trip_items.id`) */
  id: string;
  itemId: string | null;
  name: string;
  quantity: string;
  cents: number | null;
  classification: Classification;
}

export interface TripSpend {
  lines: SpendLine[];
  /** Somme des lignes, par clé (`spendKey`) */
  byKey: Map<string, number>;
  /**
   * Ce que le ticket a coûté de moins (négatif) ou de plus que ses lignes,
   * quand toutes ont un prix : les remises, montrées à part (décision de Jules).
   */
  adjustmentCents: number;
  /** Quand des lignes n'ont pas de prix : la part du total qu'on ne sait pas répartir */
  undetailedCents: number;
}

/**
 * La répartition d'une course. Les lignes chiffrées vont à leur typologie ;
 * l'écart avec le total du ticket est une remise si tout est chiffré, sinon
 * de la dépense « non détaillée ». Rien n'est réparti au prorata : ce serait
 * deviner.
 */
export function tripSpend(totalCents: number | null, lines: readonly SpendLine[]): TripSpend {
  const byKey = new Map<string, number>();
  let priced = 0;
  for (const line of lines) {
    if (line.cents === null) continue;
    priced += line.cents;
    const key = spendKey(line.classification);
    byKey.set(key, (byKey.get(key) ?? 0) + line.cents);
  }
  const unpriced = lines.some((l) => l.cents === null);
  const gap = totalCents === null ? 0 : totalCents - priced;
  return {
    lines: [...lines],
    byKey,
    adjustmentCents: unpriced && gap > 0 ? 0 : gap,
    undetailedCents: unpriced && gap > 0 ? gap : 0,
  };
}

/** Plusieurs courses additionnées. */
export function sumSpends(spends: readonly TripSpend[]): Omit<TripSpend, 'lines'> {
  const byKey = new Map<string, number>();
  let adjustmentCents = 0;
  let undetailedCents = 0;
  for (const s of spends) {
    for (const [k, v] of s.byKey) byKey.set(k, (byKey.get(k) ?? 0) + v);
    adjustmentCents += s.adjustmentCents;
    undetailedCents += s.undetailedCents;
  }
  return { byKey, adjustmentCents, undetailedCents };
}

export interface TypologyRow {
  typology: Typology;
  cents: number;
  /** Pour l'alimentation : essentiel, plaisir, alcool, dans cet ordre */
  kinds: { kind: FoodKind; cents: number }[];
}

/** Les typologies d'une répartition, la plus dépensière d'abord, celles à zéro omises. */
export function typologyRows(byKey: ReadonlyMap<string, number>): TypologyRow[] {
  return TYPOLOGIES.map((typology) => {
    const kinds = FOOD_KINDS.map((kind) => ({ kind, cents: byKey.get(`${typology}:${kind}`) ?? 0 })).filter((k) => k.cents !== 0);
    const cents = (byKey.get(typology) ?? 0) + kinds.reduce((s, k) => s + k.cents, 0);
    return { typology, cents, kinds: typology === 'alimentation' ? kinds : [] };
  })
    .filter((r) => r.cents !== 0)
    .sort((a, b) => b.cents - a.cents);
}

/** Les lignes d'une course, classées : la ligne, sinon son article, sinon devinée. */
export function spendLinesOf(tripId: string, tripItems: readonly TripItem[], itemOf: ReadonlyMap<string, Item>): SpendLine[] {
  return tripItems
    .filter((l) => l.tripId === tripId)
    .map((l) => {
      const item = l.itemId ? itemOf.get(l.itemId) : undefined;
      return {
        id: l.id,
        itemId: l.itemId,
        name: l.name,
        quantity: l.quantity,
        cents: l.priceCents,
        classification: classify(
          l.typology ? { typology: l.typology, foodKind: l.foodKind ?? null } : null,
          item?.typology ? { typology: item.typology, foodKind: item.foodKind ?? null } : null,
          l.name,
          l.aisle,
        ),
      };
    });
}
