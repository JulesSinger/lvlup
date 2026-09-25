/**
 * Euros ↔ centimes, sans jamais passer par un flottant (`0,1 + 0,2` ne fait
 * pas `0,3` en virgule flottante).
 *
 * Même logique que `modules/budget/lib/amount.ts`, recopiée plutôt
 * qu'importée : un module n'importe jamais depuis un autre
 * (`conventions.test.ts`). Un prix de course n'est jamais négatif, d'où
 * l'absence de signe.
 */

/** « 2,38 », « 2.38 », « 12 » → centimes entiers ; `null` si illisible. */
export function parseEurosToCents(raw: string): number | null {
  const trimmed = raw.trim().replace(/\s/g, '').replace(/€$/, '');
  if (trimmed === '') return null;
  const match = /^(\d+)(?:[.,](\d{0,2}))?$/.exec(trimmed);
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return Number.isFinite(cents) ? cents : null;
}

/** 238 → « 2,38 » : pour préremplir un champ. */
export function centsToInput(cents: number): string {
  const abs = Math.abs(Math.trunc(cents));
  return `${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}

/** 123456 → « 1 234,56 € » : pour l'affichage. */
export function formatEuros(cents: number): string {
  const abs = Math.abs(Math.trunc(cents));
  const euros = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${euros},${String(abs % 100).padStart(2, '0')} €`;
}
