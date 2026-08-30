/**
 * Jour local, au format YYYY-MM-DD.
 *
 * Copie volontaire de `modules/objectifs/lib/streak.ts` — un module n'importe
 * jamais depuis un autre (garde-fou `conventions.test.ts`), et ces quelques
 * lignes coûtent moins cher à dupliquer qu'à faire remonter au socle pour un
 * seul appelant. Le fuseau de l'appareil fait foi : une carte due
 * « aujourd'hui » ne doit jamais se dérober pour cause de décalage UTC
 * (docs/etude-flashcards.md §6).
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
