import type { RankId } from './ranks';

export interface Tier {
  id: string;
  goalId: string;
  title: string;
  rank: RankId;
  /** Position dans la liste, 0 = premier palier */
  position: number;
  /** Date ISO de validation, null si le palier n'est pas encore atteint */
  completedAt: string | null;
  createdAt: string;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  emoji: string;
  position: number;
  archived: boolean;
  createdAt: string;
  tiers: Tier[];
}

export interface GoalInput {
  title: string;
  description: string;
  emoji: string;
}

export interface TierInput {
  title: string;
  rank: RankId;
}

export interface AppUser {
  id: string;
  email: string;
  /** true quand les données vivent seulement dans ce navigateur */
  isLocal: boolean;
}
