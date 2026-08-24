/** Le mois se déduit de `day` (docs/etude-astra.md §2) : pas de colonne dédiée, pas de calcul flottant non plus ici — tout en chaînes et entiers. */

const MONTH_NAMES = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** `'2026-07-04'` → `'2026-07'`. */
export function monthKeyOf(day: string): string {
  return day.slice(0, 7);
}

/** Le mois courant, au format `'AAAA-MM'`. */
export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** `'2026-07'` → `'juillet 2026'`. */
export function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** `('2026-07', -1)` → `'2026-06'` ; `('2026-01', -1)` → `'2025-12'`. */
export function shiftMonthKey(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split('-').map(Number);
  const zeroBased = month - 1 + delta;
  const newYear = year + Math.floor(zeroBased / 12);
  const newMonth = ((zeroBased % 12) + 12) % 12;
  return `${newYear}-${String(newMonth + 1).padStart(2, '0')}`;
}
