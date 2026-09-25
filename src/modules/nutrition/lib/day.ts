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

const DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTH_NAMES = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/**
 * Le nom d'un jour tel qu'on le dit : « Aujourd’hui », « Hier », « Demain »,
 * sinon « jeudi 24 septembre » (l'année seulement si ce n'est pas celle de
 * `today`). Écrit à la main plutôt qu'avec `toLocaleDateString`, dont le
 * résultat dépend de la langue de l'appareil.
 */
export function dayLabel(day: string, today: string): string {
  if (day === today) return 'Aujourd’hui';
  if (day === shiftDay(today, -1)) return 'Hier';
  if (day === shiftDay(today, 1)) return 'Demain';
  const [y, m, d] = day.split('-').map(Number);
  const weekday = DAY_NAMES[new Date(y, m - 1, d, 12).getDay()];
  const year = day.slice(0, 4) === today.slice(0, 4) ? '' : ` ${y}`;
  return `${weekday} ${d} ${MONTH_NAMES[m - 1]}${year}`;
}
