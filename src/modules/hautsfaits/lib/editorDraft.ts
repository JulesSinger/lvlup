/**
 * Ce que tient la fenêtre d'un haut fait, et sa traduction en `FeatInput` —
 * bibliothèque pure.
 *
 * Une date se saisit selon sa précision : un calendrier pour un jour, un
 * mois et une année pour un mois, une année seule sinon. La fenêtre garde
 * les trois morceaux (`day`, `month`, `year`) pour qu'on puisse changer de
 * précision sans rien perdre : passer de « 2 mars 2025 » à « Mois » garde
 * mars 2025.
 */
import { alignDate } from './dates';
import type { DatePrecision, Feat, FeatCategory, FeatInput } from './types';

export interface DateDraft {
  precision: DatePrecision;
  /** AAAA-MM-JJ, pour la précision « jour ». */
  day: string;
  /** 1 à 12, pour la précision « mois ». */
  month: number;
  /** Tapée, donc du texte : « 2014 ». */
  year: string;
}

export interface FeatDraft {
  title: string;
  category: FeatCategory;
  start: DateDraft;
  isPeriod: boolean;
  end: DateDraft;
  major: boolean;
  highlight: string;
  place: string;
  people: string;
  story: string;
}

const parts = (day: string) => day.split('-').map(Number) as [number, number, number];

export function dateDraftFrom(day: string, precision: DatePrecision): DateDraft {
  const [y, m] = parts(day);
  return { precision, day, month: m, year: String(y) };
}

/** Le jour que la fenêtre décrit, rangé au début de sa période, ou `null` s'il est incomplet. */
export function dateFromDraft(d: DateDraft): string | null {
  if (d.precision === 'day') return /^\d{4}-\d{2}-\d{2}$/.test(d.day) ? d.day : null;
  const year = Number(d.year.trim());
  if (!Number.isInteger(year) || year < 1000 || year > 9999) return null;
  if (d.precision === 'year') return `${year}-01-01`;
  return `${year}-${String(d.month).padStart(2, '0')}-01`;
}

/**
 * Changer de précision garde ce qu'on a déjà dit : un jour donne son mois et
 * son année, une année devient le 1er janvier dans le calendrier.
 */
export function withPrecision(d: DateDraft, precision: DatePrecision): DateDraft {
  const current = dateFromDraft(d);
  if (!current) return { ...d, precision };
  // Le jour déjà choisi reste en mémoire tant qu'il tombe dans la période dite :
  // « 2 mars 2025 » → Mois → Jour revient au 2 mars, pas au 1er.
  const day = /^\d{4}-\d{2}-\d{2}$/.test(d.day) && alignDate(d.day, d.precision) === current ? d.day : current;
  return { ...dateDraftFrom(current, precision), day };
}

export function emptyDraft(today: string, seed: Partial<Pick<FeatDraft, 'title' | 'category'>> & { precision?: DatePrecision } = {}): FeatDraft {
  const precision = seed.precision ?? 'day';
  const start = dateDraftFrom(today, precision);
  return {
    title: seed.title ?? '',
    category: seed.category ?? 'autre',
    start,
    isPeriod: false,
    end: start,
    major: false,
    highlight: '',
    place: '',
    people: '',
    story: '',
  };
}

export function draftFromFeat(feat: Feat): FeatDraft {
  const start = dateDraftFrom(feat.dateStart, feat.datePrecision);
  return {
    title: feat.title,
    category: feat.category,
    start,
    isPeriod: feat.dateEnd !== null,
    end: feat.dateEnd ? dateDraftFrom(feat.dateEnd, feat.dateEndPrecision ?? feat.datePrecision) : start,
    major: feat.major,
    highlight: feat.highlight,
    place: feat.place,
    people: feat.people,
    story: feat.story,
  };
}

/** Le haut fait à enregistrer, ou le message qui dit ce qui manque à la date. */
export function inputFromDraft(draft: FeatDraft): FeatInput | string {
  const dateStart = dateFromDraft(draft.start);
  if (!dateStart) return draft.start.precision === 'day' ? 'Choisis le jour.' : 'Écris l’année (quatre chiffres).';
  let dateEnd: string | null = null;
  if (draft.isPeriod) {
    dateEnd = dateFromDraft(draft.end);
    if (!dateEnd) return draft.end.precision === 'day' ? 'Choisis le jour de la fin.' : 'Écris l’année de la fin (quatre chiffres).';
  }
  return {
    title: draft.title.trim(),
    category: draft.category,
    dateStart,
    datePrecision: draft.start.precision,
    dateEnd,
    dateEndPrecision: dateEnd ? draft.end.precision : null,
    major: draft.major,
    highlight: draft.highlight.trim(),
    place: draft.place.trim(),
    people: draft.people.trim(),
    story: draft.story.trim(),
  };
}
