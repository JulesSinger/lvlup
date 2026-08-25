/**
 * Échelle de rangs inspirée de League of Legends.
 * `value` sert au calcul du rang global du profil : plus il est haut, plus le rang est prestigieux.
 * L'ordre du tableau fait foi, ne pas réordonner sans mettre `value` à jour.
 */
export type RankId =
  | 'fer'
  | 'bronze'
  | 'argent'
  | 'or'
  | 'platine'
  | 'emeraude'
  | 'diamant'
  | 'maitre'
  | 'grand-maitre'
  | 'challenger';

export interface Rank {
  id: RankId;
  label: string;
  value: number;
  /** Couleur principale du badge */
  color: string;
  /** Couleur secondaire, utilisée pour le dégradé du badge */
  color2: string;
  /** Couleur du texte posé sur le badge */
  ink: string;
}

export const RANKS: Rank[] = [
  { id: 'fer', label: 'Fer', value: 1, color: '#6b625c', color2: '#8d8078', ink: '#ffffff' },
  { id: 'bronze', label: 'Bronze', value: 2, color: '#a2643a', color2: '#cd8b52', ink: '#ffffff' },
  { id: 'argent', label: 'Argent', value: 3, color: '#8a949e', color2: '#c3cbd3', ink: '#1b1f24' },
  { id: 'or', label: 'Or', value: 4, color: '#c8992c', color2: '#f0cf5e', ink: '#2b2000' },
  { id: 'platine', label: 'Platine', value: 5, color: '#2e9c95', color2: '#6fe0d3', ink: '#04211f' },
  { id: 'emeraude', label: 'Émeraude', value: 6, color: '#1f9d55', color2: '#5be08d', ink: '#04210f' },
  { id: 'diamant', label: 'Diamant', value: 7, color: '#3f7fd6', color2: '#8cc4ff', ink: '#04152b' },
  { id: 'maitre', label: 'Maître', value: 8, color: '#8b45cf', color2: '#c98cff', ink: '#ffffff' },
  { id: 'grand-maitre', label: 'Grand Maître', value: 9, color: '#c0392b', color2: '#ff7a6b', ink: '#ffffff' },
  { id: 'challenger', label: 'Challenger', value: 10, color: '#1f8ecf', color2: '#f2d98a', ink: '#04152b' },
];

const BY_ID = new Map<RankId, Rank>(RANKS.map((r) => [r.id, r]));

export function getRank(id: RankId | null | undefined): Rank {
  return (id && BY_ID.get(id)) || RANKS[0];
}

export function rankByValue(value: number): Rank {
  const clamped = Math.max(1, Math.min(RANKS.length, Math.round(value)));
  return RANKS[clamped - 1];
}

/**
 * Rangs proposés par défaut selon le nombre d'étapes.
 *
 * Une simple répartition linéaire donnait des échelles incohérentes : trois
 * étapes produisaient Bronze / Émeraude / Challenger, ce qui n'a aucun sens —
 * on n'atteint pas le sommet du classement en trois pas.
 *
 * Le principe retenu est explicite plutôt que calculé :
 *  · la première étape reste toujours accessible (Bronze, ou Fer sur les
 *    très longues échelles) ;
 *  · le sommet monte avec l'ambition — une échelle courte plafonne à Or,
 *    Challenger se mérite à partir de quatre étapes ;
 *  · les rangs intermédiaires se remplissent du bas vers le haut.
 *
 * Chaque rang reste modifiable individuellement une fois l'objectif créé.
 */
const RANK_LADDERS: RankId[][] = [
  [], // 0 étape
  ['or'],
  ['bronze', 'or'],
  ['bronze', 'argent', 'or'],
  ['bronze', 'argent', 'or', 'challenger'],
  ['bronze', 'argent', 'or', 'diamant', 'challenger'],
  ['bronze', 'argent', 'or', 'platine', 'diamant', 'challenger'],
  ['bronze', 'argent', 'or', 'platine', 'emeraude', 'diamant', 'challenger'],
  ['fer', 'bronze', 'argent', 'or', 'platine', 'emeraude', 'diamant', 'challenger'],
  ['fer', 'bronze', 'argent', 'or', 'platine', 'emeraude', 'diamant', 'maitre', 'challenger'],
  [
    'fer',
    'bronze',
    'argent',
    'or',
    'platine',
    'emeraude',
    'diamant',
    'maitre',
    'grand-maitre',
    'challenger',
  ],
];

/**
 * Rangs proposés par défaut à la création d'un objectif de `count` étapes.
 * L'utilisateur reste libre de les changer un par un, plus tard.
 */
export function suggestRanks(count: number): RankId[] {
  if (count <= 0) return [];
  if (count < RANK_LADDERS.length) return [...RANK_LADDERS[count]];

  // Au-delà de dix étapes, on étale l'échelle complète en répétant les rangs
  // intermédiaires — la suite reste croissante, du plus bas au plus haut.
  return Array.from({ length: count }, (_, i) => {
    const index = Math.round((i * (RANKS.length - 1)) / (count - 1));
    return RANKS[index].id;
  });
}

/**
 * Déplacer un palier d'un cran, sans casser l'échelle.
 *
 * Le piège corrigé ici : `reorderTiers` ne réécrit que les positions, et le
 * rang restait collé au palier. Ajouter « Courir 15 km » à la fin (challenger)
 * puis le remonter d'un cran donnait
 *     bronze | argent | challenger | or
 * — une échelle qui **redescend** au dernier barreau, et un palier facile
 * décoré du rang le plus prestigieux. Tout le produit repose sur cette montée.
 *
 * La règle retenue : **les rangs appartiennent aux barreaux, pas aux paliers.**
 * Déplacer un palier déplace son contenu ; la suite des rangs, elle, ne bouge
 * pas. C'est aussi ce qu'on veut en glissant une étape entre deux autres : elle
 * prend le rang de la place qu'elle occupe.
 *
 * L'exception : **un palier déjà validé garde son rang**, parce que c'est un
 * trophée gagné à une date donnée — le réécrire réécrirait l'historique, ce que
 * le projet s'interdit partout ailleurs (les PP sont figés à l'enregistrement
 * pour la même raison). Un échange qui toucherait un palier validé est donc
 * refusé plutôt qu'exécuté à moitié : `movableTier` le dit à l'interface, qui
 * grise la flèche.
 */
export interface LadderRung {
  id: string;
  rank: RankId;
  completedAt: string | null;
}

/** Le déplacement est-il permis ? Refusé s'il toucherait un palier validé. */
export function movableTier(tiers: LadderRung[], index: number, direction: -1 | 1): boolean {
  const to = index + direction;
  if (index < 0 || index >= tiers.length || to < 0 || to >= tiers.length) return false;
  return tiers[index].completedAt === null && tiers[to].completedAt === null;
}

/**
 * Le nouvel ordre et les rangs à réécrire, ou `null` si le déplacement est
 * refusé. Les deux paliers échangent leur place *et* leur rang, ce qui revient
 * à laisser les rangs sur place.
 */
export function ladderMove(
  tiers: LadderRung[],
  tierId: string,
  direction: -1 | 1,
): { orderedIds: string[]; rankChanges: { id: string; rank: RankId }[] } | null {
  const from = tiers.findIndex((t) => t.id === tierId);
  if (!movableTier(tiers, from, direction)) return null;
  const to = from + direction;

  const orderedIds = tiers.map((t) => t.id);
  [orderedIds[from], orderedIds[to]] = [orderedIds[to], orderedIds[from]];

  const rankChanges =
    tiers[from].rank === tiers[to].rank
      ? [] // même rang des deux côtés : rien à réécrire
      : [
          { id: tiers[from].id, rank: tiers[to].rank },
          { id: tiers[to].id, rank: tiers[from].rank },
        ];

  return { orderedIds, rankChanges };
}

/**
 * Insérer un palier à une place donnée de l'échelle.
 *
 * Même principe que `ladderMove` : **les rangs appartiennent aux barreaux**.
 * L'échelle gagne un barreau à la fin — le rang suivant de la suite — et les
 * paliers situés au-dessous du point d'insertion glissent d'un cran, chacun
 * prenant le rang de sa nouvelle place. Le nouveau venu hérite donc du rang que
 * portait la place qu'il occupe.
 *
 * Insérer « Courir 15 km » entre 10 et 21 sur bronze | argent | or donne
 * bronze | argent | or(15) | challenger(21) : la suite des rangs ne change
 * pas, seul son contenu descend d'une marche.
 *
 * On ne recalcule pas toute l'échelle depuis `suggestRanks` : un rang choisi à
 * la main est une liberté documentée, et l'écraser en douce serait un bug plus
 * sournois que celui qu'on corrige.
 *
 * Refusé — comme le déplacement — si un palier **validé** devait changer de
 * rang, c'est-à-dire dès qu'on insère au-dessus de lui : son rang est un
 * trophée daté.
 */
export function ladderInsert(
  tiers: LadderRung[],
  index: number,
): { rank: RankId; shifts: { id: string; rank: RankId }[] } | null {
  if (index < 0 || index > tiers.length) return null;
  if (tiers.slice(index).some((t) => t.completedAt !== null)) return null;

  // Une échelle jamais retouchée reprend simplement la suite standard de sa
  // nouvelle longueur : c'est ce que l'utilisateur aurait eu en créant
  // l'objectif avec un palier de plus, et ça évite deux barreaux au même rang
  // quand l'échelle touchait déjà le plafond. On ne le fait QUE dans ce cas :
  // dès qu'un rang a été choisi à la main, ce choix prime sur la convention.
  const standard = suggestRanks(tiers.length);
  if (tiers.every((t, i) => t.rank === standard[i])) {
    const suite = suggestRanks(tiers.length + 1);
    const ordre = [...tiers.slice(0, index), null, ...tiers.slice(index)];
    return {
      rank: suite[index],
      shifts: ordre
        .map((t, place) => (t === null ? null : { id: t.id, rank: suite[place] }))
        .filter((s): s is { id: string; rank: RankId } => s !== null)
        .filter((s) => s.rank !== tiers.find((t) => t.id === s.id)!.rank),
    };
  }

  // Le barreau ajouté au sommet de l'échelle : le rang juste au-dessus du
  // plus haut déjà posé. Prendre `suggestRanks(n + 1)` à cette place le ferait
  // parfois retomber SOUS le sommet actuel — c'est-à-dire recréer, par une
  // autre porte, l'échelle qui redescend qu'on vient de corriger.
  const sommet = tiers.reduce(
    (haut, t) => (getRank(t.rank).value > getRank(haut).value ? t.rank : haut),
    tiers[0]?.rank ?? 'bronze',
  );
  // Le rang que l'échelle porterait naturellement à cette longueur — c'est la
  // convention du produit (quatre étapes finissent sur Challenger) — mais
  // seulement s'il dépasse vraiment le sommet actuel. Sinon, le rang juste
  // au-dessus. Et au plafond, le nouveau barreau partage le sommet plutôt que
  // de rétrograder qui que ce soit.
  const conventionnel = suggestRanks(tiers.length + 1)[tiers.length];
  const dernier: RankId =
    conventionnel && getRank(conventionnel).value > getRank(sommet).value
      ? conventionnel
      : (RANKS.find((r) => r.value > getRank(sommet).value)?.id ?? sommet);

  const rank = tiers[index]?.rank ?? dernier;
  const shifts = tiers
    .slice(index)
    .map((t, offset) => ({ id: t.id, rank: tiers[index + offset + 1]?.rank ?? dernier }))
    .filter((s, offset) => s.rank !== tiers[index + offset].rank);

  return { rank, shifts };
}

/** Peut-on insérer un palier à cette place ? */
export function insertableAt(tiers: LadderRung[], index: number): boolean {
  return ladderInsert(tiers, index) !== null;
}
