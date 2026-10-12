import type { CrossSessionKind, RunKind, RunSource, SessionKind } from './types';

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

/** Les séances d'à côté, dites en français. */
export const CROSS_LABELS: Record<CrossSessionKind, string> = {
  renfo: 'Renforcement',
  velo: 'Vélo',
};

/** Le nom d'une sorte de séance, de course ou d'à côté. */
export const sessionKindLabel = (kind: SessionKind): string => (kind in CROSS_LABELS ? CROSS_LABELS[kind as CrossSessionKind] : KIND_LABELS[kind as RunKind]);

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
