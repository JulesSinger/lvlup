import { supabaseConfig } from '../../../core/data';
import type { FlashcardsStore } from './flashcardsStore';
import { LocalFlashcards } from './localFlashcards';
import { SupabaseFlashcards } from './supabaseFlashcards';

/** Même bascule que le socle : le module ne relit pas les variables d'env. */
export const flashcardsStore: FlashcardsStore = supabaseConfig
  ? new SupabaseFlashcards(supabaseConfig.url, supabaseConfig.anonKey)
  : new LocalFlashcards();

export type { FlashcardsStore };
