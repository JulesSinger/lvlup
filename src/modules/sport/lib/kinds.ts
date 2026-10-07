import type { RunKind, RunSource } from './types';

/** Les sortes de sortie, dites en français. */
export const KIND_LABELS: Record<RunKind, string> = {
  footing: 'Footing',
  fractionne: 'Fractionné',
  seuil: 'Seuil',
  longue: 'Sortie longue',
  allure: 'Allure marathon',
  course: 'Course',
  autre: 'Autre',
};

/** Les séances qui fatiguent : jamais deux d'affilée dans une semaine du plan. */
export const HARD_KINDS: readonly RunKind[] = ['fractionne', 'seuil', 'allure', 'longue', 'course'];

export const SOURCE_LABELS: Record<RunSource, string> = {
  manuel: 'Saisie à la main',
  raccourci: 'Apple Watch',
  strava: 'Archive Strava',
  gpx: 'Fichier GPX',
  tcx: 'Fichier TCX',
  fit: 'Fichier FIT',
};
