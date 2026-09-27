import { supabaseConfig } from '../../../core/data';
import type { CalendarStore } from './calendarStore';
import { LocalCalendar } from './localCalendar';
import { SupabaseCalendar } from './supabaseCalendar';

/** Même bascule que le socle : le module ne relit pas les variables d'env. */
export const calendarStore: CalendarStore = supabaseConfig
  ? new SupabaseCalendar(supabaseConfig.url, supabaseConfig.anonKey)
  : new LocalCalendar();

export type { CalendarStore };
