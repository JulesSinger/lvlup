/**
 * Validation d'un haut fait — bibliothèque pure. Les règles de la base
 * (migration du 30/09/2026) dites en français, plus une qu'elle ne peut pas
 * vérifier seule : un haut fait est déjà arrivé, sa date n'est pas après
 * aujourd'hui (les hauts faits à venir sont le rôle d'Objectifs, décision du
 * 29/09/2026). La fin d'une période, elle, peut être prévue : six mois à
 * l'étranger commencés le mois dernier se notent déjà.
 */
import { alignDate } from './dates';
import {
  DATE_PRECISIONS,
  FEAT_CATEGORIES,
  FEAT_HIGHLIGHT_MAX,
  FEAT_PEOPLE_MAX,
  FEAT_PLACE_MAX,
  FEAT_STORY_MAX,
  FEAT_TITLE_MAX,
  type FeatInput,
} from './types';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function isRealDay(day: string): boolean {
  if (!DAY.test(day)) return false;
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Rend le message de la première règle enfreinte, ou `null`. */
export function validateFeat(input: FeatInput, today: string): string | null {
  const title = input.title.trim();
  if (!title) return 'Donne un titre à ce haut fait.';
  if (title.length > FEAT_TITLE_MAX) return `Le titre est trop long (${FEAT_TITLE_MAX} caractères au plus).`;
  if (!(FEAT_CATEGORIES as readonly string[]).includes(input.category)) return 'Choisis une catégorie.';
  if (!(DATE_PRECISIONS as readonly string[]).includes(input.datePrecision)) return 'Précision de date inconnue.';
  if (!isRealDay(input.dateStart)) return 'Date invalide.';
  if (alignDate(input.dateStart, input.datePrecision) !== input.dateStart) return 'La date doit être rangée au début de sa période.';
  if (input.dateStart > today) return 'Un haut fait est déjà arrivé : sa date ne peut pas être après aujourd’hui.';

  if (input.dateEnd) {
    const endPrecision = input.dateEndPrecision ?? input.datePrecision;
    if (!isRealDay(input.dateEnd)) return 'Date de fin invalide.';
    if (alignDate(input.dateEnd, endPrecision) !== input.dateEnd) return 'La date de fin doit être rangée au début de sa période.';
    if (input.dateEnd < input.dateStart) return 'La fin est avant le début.';
    if (input.dateEnd === input.dateStart && endPrecision === input.datePrecision) return 'La fin est la même que le début : retire-la.';
  } else if (input.dateEndPrecision) {
    return 'Une précision de fin sans date de fin.';
  }

  if ((input.highlight ?? '').trim().length > FEAT_HIGHLIGHT_MAX) return `Le chiffre clé est trop long (${FEAT_HIGHLIGHT_MAX} caractères au plus).`;
  if ((input.place ?? '').trim().length > FEAT_PLACE_MAX) return `Le lieu est trop long (${FEAT_PLACE_MAX} caractères au plus).`;
  if ((input.people ?? '').trim().length > FEAT_PEOPLE_MAX) return `« Avec qui » est trop long (${FEAT_PEOPLE_MAX} caractères au plus).`;
  if ((input.story ?? '').length > FEAT_STORY_MAX) return `Le récit est trop long (${FEAT_STORY_MAX} caractères au plus).`;
  return null;
}
