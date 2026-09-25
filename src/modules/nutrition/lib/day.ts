/**
 * Jour local, au format YYYY-MM-DD.
 *
 * Copie volontaire de `modules/flashcards/lib/day.ts` — un module n'importe
 * jamais depuis un autre (garde-fou `conventions.test.ts`). Le fuseau de
 * l'appareil fait foi : un dîner noté à 23 h appartient à ce jour-là, pas au
 * lendemain en UTC.
 */
export function dayString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Jour local décalé de `offset` jours (0 = même jour). */
export function shiftDay(day: string, offset: number): string {
  const [y, m, d] = day.split('-').map(Number);
  // Midi local : neutralise les changements d'heure été/hiver.
  return dayString(new Date(y, m - 1, d + offset, 12));
}
