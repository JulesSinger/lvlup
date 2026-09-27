/**
 * Jours du calendrier, au format `AAAA-MM-JJ` — toujours des jours LOCAUX.
 *
 * `dayString`/`shiftDay` sont copiés de `modules/nutrition/lib/day.ts` : un
 * module n'importe jamais depuis un autre (`conventions.test.ts`). Les
 * écarts entre jours se calculent en UTC pur (`Date.UTC`), jamais avec des
 * `Date` locales : un changement d'heure ferait sinon durer un jour 23 ou
 * 25 heures, et une division par 24 h tomberait à côté.
 */
export function dayString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Jour décalé de `offset` jours (0 = même jour). */
export function shiftDay(day: string, offset: number): string {
  const [y, m, d] = day.split('-').map(Number);
  // Midi local : neutralise les changements d'heure été/hiver.
  return dayString(new Date(y, m - 1, d + offset, 12));
}

function utc(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Nombre de jours de `a` à `b` (négatif si `b` est avant `a`). */
export function daysBetween(a: string, b: string): number {
  return Math.round((utc(b) - utc(a)) / 86_400_000);
}

/** Jour de la semaine : 0 = dimanche … 6 = samedi (convention de `Date.getDay`). */
export function weekday(day: string): number {
  return new Date(utc(day)).getUTCDay();
}

/** Le lundi de la semaine du jour : les semaines commencent le lundi (RFC 5545 par défaut). */
export function mondayOf(day: string): string {
  return shiftDay(day, -((weekday(day) + 6) % 7));
}

/** Nombre de mois calendaires de `a` à `b`, jours ignorés (« 2026-01-31 » → « 2026-02-01 » = 1). */
export function monthsBetween(a: string, b: string): number {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
}

/** Le plus tôt, le plus tard de deux jours (les chaînes `AAAA-MM-JJ` se comparent dans l'ordre). */
export const minDay = (a: string, b: string) => (a < b ? a : b);
export const maxDay = (a: string, b: string) => (a > b ? a : b);
