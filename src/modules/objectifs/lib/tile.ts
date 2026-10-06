/**
 * La tuile d'un objectif — bibliothèque pure.
 *
 * Demande de Jules (06/10/2026) : sur la page Objectifs, les cartes avaient
 * des hauteurs différentes selon qu'un objectif était neuf, avait une grille
 * d'activité ou une courbe, et la grille laissait des trous. Toutes les tuiles
 * ont désormais la même structure ; la grande grille des 12 semaines vit dans
 * la fiche, la tuile n'en garde qu'une bande : une barre par semaine.
 */
import { goalHeatmap, HEATMAP_WEEKS } from './heatmap';
import type { Checkin, Goal } from './types';

export interface StripWeek {
  /** Lundi de la semaine. */
  monday: string;
  /** Jours de la semaine où l'objectif a été travaillé, de 0 à 7. */
  days: number;
  /**
   * La semaine compte : au moins un de ses jours est entre la création de
   * l'objectif et aujourd'hui. Avant, la tuile ne dessine qu'un point — un
   * objectif tout neuf n'a pas à ressembler à douze semaines d'échec.
   */
  inRange: boolean;
}

/** Les douze dernières semaines d'un objectif, la dernière contenant aujourd'hui. */
export function weekStrip(goal: Goal, checkins: Checkin[], today: string, weeks = HEATMAP_WEEKS): StripWeek[] {
  const map = goalHeatmap(goal, checkins, { weeks, today });
  const strip: StripWeek[] = [];
  for (let col = 0; col < map.columns; col++) {
    const cells = map.cells.slice(col * 7, col * 7 + 7);
    strip.push({
      monday: cells[0].day,
      days: cells.filter((c) => c.inRange && c.count > 0).length,
      inRange: cells.some((c) => c.inRange),
    });
  }
  return strip;
}

/** Un objectif jamais travaillé : la tuile le dit « nouveau » plutôt que vide. */
export function isUntouched(goal: Goal, checkins: Checkin[]): boolean {
  return !checkins.some((c) => c.goalId === goal.id);
}

/*
 * L'adresse d'un objectif ouvert : `#/objectifs/<id>`. Le socle ne lit que le
 * premier segment (`core/lib/moduleRoute.ts`), le reste appartient au module.
 * C'est ce qui permet au geste « retour » du téléphone de revenir aux tuiles
 * au lieu de quitter Objectifs.
 */
const ROUTE = /^#\/objectifs\/([^/?#]+)/;

export function goalIdFromHash(hash: string): string | null {
  const match = ROUTE.exec(hash);
  return match ? decodeURIComponent(match[1]) : null;
}

export function hashForGoal(id: string): string {
  return `#/objectifs/${encodeURIComponent(id)}`;
}
