/**
 * Dates d'une course — copie volontaire de `modules/nutrition/lib/day.ts`
 * pour `dayString` : un module n'importe jamais depuis un autre
 * (`conventions.test.ts`). Le fuseau de l'appareil fait foi : des courses
 * faites à 21 h appartiennent à ce jour-là, pas au lendemain en UTC.
 */
export function dayString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTH_NAMES = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/**
 * « jeudi 25 septembre », avec l'année seulement si ce n'est pas celle de
 * `today`. Écrit à la main plutôt qu'avec `toLocaleDateString`, dont le
 * résultat dépend de la langue de l'appareil.
 */
export function formatDay(day: string, today: string = dayString()): string {
  const [y, m, d] = day.split('-').map(Number);
  const weekday = DAY_NAMES[new Date(y, m - 1, d, 12).getDay()];
  const year = day.slice(0, 4) === today.slice(0, 4) ? '' : ` ${y}`;
  return `${weekday} ${d} ${MONTH_NAMES[m - 1]}${year}`;
}

/** « 2026-09 » → « septembre 2026 ». */
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}
