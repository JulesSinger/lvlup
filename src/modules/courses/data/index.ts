import { supabaseConfig } from '../../../core/data';
import type { CoursesStore } from './coursesStore';
import { LocalCourses } from './localCourses';
import { SupabaseCourses } from './supabaseCourses';

/** Même bascule que le socle : le module ne relit pas les variables d'env. */
export const coursesStore: CoursesStore = supabaseConfig
  ? new SupabaseCourses(supabaseConfig.url, supabaseConfig.anonKey)
  : new LocalCourses();

export type { CoursesStore };
