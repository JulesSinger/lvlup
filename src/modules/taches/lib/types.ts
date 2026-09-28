/**
 * Types du module tâches (Polaris). Conception complète :
 * docs/etude-taches.md, décisions de Jules au §12.
 *
 * Jours au format `AAAA-MM-JJ`, heures au format `HH:MM`, toujours LOCAUX.
 */
import type { Recurrence } from '../../../core/lib/recurrence';

export type { Recurrence };

/**
 * La longueur maximale d'un titre de tâche — 1000 caractères depuis le
 * 28/09/2026 (200 auparavant). Pendant de `taches_tasks_title_check`,
 * comparé par `lib/schema.test.ts`.
 */
export const TASK_TITLE_MAX = 1000;

/** Bornes d'une durée, en minutes — celles de `taches_tasks_duration_check`. */
export const DURATION_MIN = 5;
export const DURATION_MAX = 1440;
/** La taille d'un créneau sans durée dite, dans le calendrier. */
export const DEFAULT_SLOT_MINUTES = 30;

/** Couleurs d'une liste, par nom — pendant de `taches_lists_color_check`. */
export const LIST_COLORS = ['bleu', 'vert', 'orange', 'rose', 'violet', 'gris'] as const;
export type ListColor = (typeof LIST_COLORS)[number];

/**
 * Priorité, facultative (décision du 27/09/2026) : une tâche sans priorité
 * est « normale ». Pendant de `taches_tasks_priority_check`.
 */
export const PRIORITIES = ['normale', 'importante', 'urgente'] as const;
export type Priority = (typeof PRIORITIES)[number];

/**
 * D'où repart une tâche répétée quand on la coche (étude §3) : de sa règle
 * (« tous les lundis », qu'on l'ait faite à temps ou non) ou du jour où on
 * l'a faite (« 10 jours après »). Pendant de `taches_tasks_repeat_from_check`.
 */
export const REPEAT_FROM = ['schedule', 'completion'] as const;
export type RepeatFrom = (typeof REPEAT_FROM)[number];

/** Une liste de tâches. */
export interface TaskList {
  id: string;
  name: string;
  color: ListColor;
  position: number;
  archived: boolean;
  createdAt: string;
}

export interface ListInput {
  name: string;
  color?: ListColor;
}

/** Une tâche, ou une sous-tâche si `parentId` n'est pas nul (un seul niveau). */
export interface Task {
  id: string;
  /** `null` : la boîte de réception */
  listId: string | null;
  parentId: string | null;
  title: string;
  note: string;
  /** Le jour où l'on compte la faire : c'est lui qui la fait entrer dans « Aujourd'hui » */
  plannedDay: string | null;
  /** Seulement avec un jour prévu */
  plannedTime: string | null;
  /**
   * La durée, en minutes, facultative et seulement avec une heure (depuis le
   * 28/09/2026) : c'est elle qui donne sa taille au créneau dans Éclipse —
   * 30 minutes sans elle.
   */
  durationMinutes: number | null;
  /** L'échéance, facultative : le jour où elle doit être faite */
  dueDay: string | null;
  priority: Priority;
  /** Exige un jour prévu */
  recurrence: Recurrence | null;
  repeatFrom: RepeatFrom;
  position: number;
  /** `null` : pas encore faite */
  completedAt: string | null;
  createdAt: string;
}

export type TaskInput = Pick<Task, 'title'> &
  Partial<
    Pick<Task, 'listId' | 'parentId' | 'note' | 'plannedDay' | 'plannedTime' | 'durationMinutes' | 'dueDay' | 'priority' | 'recurrence' | 'repeatFrom' | 'position'>
  >;

/** Les réglages des rappels de Polaris (étape 5), les mêmes sur tous les appareils. */
export interface TachesSettings {
  /** Une notification à l'heure d'une tâche qui en a une */
  taskReminders: boolean;
  /** Le résumé du matin */
  morningEnabled: boolean;
  /** Son heure, locale, « HH:MM » */
  morningTime: string;
}

export const DEFAULT_TACHES_SETTINGS: TachesSettings = { taskReminders: true, morningEnabled: false, morningTime: '08:00' };

export type TaskPatch = Partial<Omit<TaskInput, 'title'> & Pick<Task, 'title' | 'completedAt'>>;
