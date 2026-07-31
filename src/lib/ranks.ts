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
 * Rangs proposés par défaut à la création d'un objectif de `count` paliers.
 * L'utilisateur reste libre de les changer un par un.
 */
export function suggestRanks(count: number): RankId[] {
  if (count <= 0) return [];
  if (count === 1) return ['or'];
  const first = 2; // Bronze
  const last = RANKS.length; // Challenger
  return Array.from({ length: count }, (_, i) => {
    const value = first + ((last - first) * i) / (count - 1);
    return rankByValue(value).id;
  });
}
