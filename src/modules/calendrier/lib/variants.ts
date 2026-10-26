/**
 * Les variantes d'une série — bibliothèque pure (26/10/2026, demande de
 * Jules : « Travail », tous les jours de la semaine, tantôt au bureau, tantôt
 * en télétravail). C'est le même événement : mêmes heures, même série ; seule
 * la variante du jour change, et elle se voit dans le calendrier
 * (« Travail · 🏠 Télétravail », dans sa couleur si elle en a une).
 *
 * Une variante peut avoir ses jours (« Télétravail le lundi et le vendredi ») :
 * ces jours-là, elle est choisie d'office. Un jour donné se règle ensuite à la
 * main, et ce choix est rangé dans l'exception de l'occurrence
 * (`override.variant`) — `null` pour « sans variante ce jour-là ».
 *
 * Recopié dans le connecteur (`supabase/functions/atlas-mcp/calendar.ts`),
 * comparé par `mcpTools.test.ts`.
 */
import { weekday } from '../../../core/lib/day';
import { EVENT_COLORS, type EventColor } from './types';

export interface EventVariant {
  /** Choisi par l'app : renommer une variante garde les jours qui l'ont prise */
  id: string;
  name: string;
  /** `null` : la couleur de l'événement */
  color: EventColor | null;
  /** Les jours où elle est choisie d'office (0 = dimanche … 6 = samedi) */
  weekdays: number[];
}

export const VARIANTS_MAX = 6;
export const VARIANT_NAME_MAX = 40;

/** Celle que ses jours désignent, sans choix fait à la main. */
export function defaultVariantId(variants: readonly EventVariant[] | undefined, day: string): string | null {
  const wd = weekday(day);
  return (variants ?? []).find((v) => v.weekdays.includes(wd))?.id ?? null;
}

/**
 * La variante d'une occurrence : celle choisie ce jour-là (`chosen`), sinon
 * celle de ses jours. Un choix vers une variante retirée depuis revient à la
 * règle des jours, plutôt que de montrer un nom qui n'existe plus.
 */
export function variantOf(variants: readonly EventVariant[] | undefined, day: string, chosen: string | null | undefined): EventVariant | null {
  const list = variants ?? [];
  if (chosen === null) return null;
  const picked = chosen === undefined ? undefined : list.find((v) => v.id === chosen);
  if (picked) return picked;
  const id = defaultVariantId(list, day);
  return list.find((v) => v.id === id) ?? null;
}

/** Ce que le calendrier affiche : « Travail · 🏠 Télétravail ». */
export const variantTitle = (title: string, variant: Pick<EventVariant, 'name'> | null) => (variant ? `${title} · ${variant.name}` : title);

const fold = (s: string) => s.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Les seuls mots d'un nom : « 🏠 Télétravail » se retrouve en disant « télétravail ». */
const words = (s: string) => fold(s).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** Retrouver une variante par son nom, sans casse ni accents ni emoji (le connecteur parle en noms). */
export function findVariant(variants: readonly EventVariant[] | undefined, name: string): EventVariant | undefined {
  const list = variants ?? [];
  return list.find((v) => fold(v.name) === fold(name)) ?? (words(name) ? list.find((v) => words(v.name) === words(name)) : undefined);
}

/** Rend le message de la première règle enfreinte, ou `null`. */
export function validateVariants(variants: readonly EventVariant[] | undefined): string | null {
  const list = variants ?? [];
  if (list.length > VARIANTS_MAX) return `${VARIANTS_MAX} variantes au plus.`;
  const names = new Set<string>();
  const days = new Set<number>();
  for (const v of list) {
    if (!v.id || v.id.length > 40) return 'Une variante n’a pas d’identifiant.';
    const name = v.name.trim();
    if (!name) return 'Donne un nom à chaque variante.';
    if (name.length > VARIANT_NAME_MAX) return `Le nom d’une variante est trop long (${VARIANT_NAME_MAX} caractères au plus).`;
    if (names.has(fold(name))) return `Deux variantes s’appellent « ${name} ».`;
    names.add(fold(name));
    if (v.color !== null && !(EVENT_COLORS as readonly string[]).includes(v.color)) return 'Choisis la couleur d’une variante dans la liste.';
    for (const d of v.weekdays) {
      if (!Number.isInteger(d) || d < 0 || d > 6) return 'Un jour de variante n’existe pas.';
      // Un jour n'a qu'une variante d'office : sinon, laquelle ?
      if (days.has(d)) return 'Un même jour ne peut être d’office que dans une variante.';
      days.add(d);
    }
  }
  return null;
}

/** Un identifiant court pour une variante nouvelle. */
export const newVariantId = () => Math.random().toString(36).slice(2, 10);
