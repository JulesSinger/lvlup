import { supabaseConfig } from '../../../core/data';
import type { BudgetStore } from './budgetStore';
import { LocalBudget } from './localBudget';
import { SupabaseBudget } from './supabaseBudget';

/** Même bascule que le socle : le module ne relit pas les variables d'env. */
export const budgetStore: BudgetStore = supabaseConfig
  ? new SupabaseBudget(supabaseConfig.url, supabaseConfig.anonKey)
  : new LocalBudget();

export type { BudgetStore };
