/**
 * Des idées pour démarrer — bibliothèque pure (docs/etude-hauts-faits.md §11).
 *
 * Un module rétroactif commence par une page blanche intimidante : quelques
 * hauts faits que presque tout le monde a vécus, qu'un toucher pré-remplit.
 * Une idée disparaît dès qu'un haut fait porte déjà ce titre.
 */
import type { DatePrecision, FeatCategory } from './types';

export interface Suggestion {
  title: string;
  category: FeatCategory;
  /** La précision qu'on connaît le plus souvent : l'année du brevet, le jour du semi. */
  precision: DatePrecision;
}

export const SUGGESTIONS: readonly Suggestion[] = [
  { title: 'Brevet des collèges', category: 'etudes', precision: 'year' },
  { title: 'Baccalauréat', category: 'etudes', precision: 'year' },
  { title: 'Permis de conduire', category: 'autre', precision: 'month' },
  { title: 'Premier appartement', category: 'chezsoi', precision: 'month' },
  { title: 'Premier emploi', category: 'travail', precision: 'month' },
  { title: 'Diplôme', category: 'etudes', precision: 'month' },
  { title: 'Premier semi-marathon', category: 'sport', precision: 'day' },
  { title: 'Premier voyage seul', category: 'voyage', precision: 'month' },
  { title: 'Vivre à l’étranger', category: 'voyage', precision: 'month' },
];

/** Casse, accents, apostrophes et espaces ignorés : « premier  Appartement » = « Premier appartement ». */
export function normalizeTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function remainingSuggestions(existingTitles: readonly string[]): Suggestion[] {
  const taken = new Set(existingTitles.map(normalizeTitle));
  return SUGGESTIONS.filter((s) => !taken.has(normalizeTitle(s.title)));
}
