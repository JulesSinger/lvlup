/**
 * Conversion euros ↔ centimes, sans jamais passer par un flottant.
 *
 * `0,1 + 0,2` ne fait pas `0,3` en virgule flottante ; passer par
 * `parseFloat` puis `× 100` réintroduit exactement l'erreur que les
 * centimes entiers évitent (voir docs/astra-import-boursobank.md §1 et
 * docs/etude-astra.md §2). Toute l'arithmétique ici reste en entiers.
 */

/**
 * Lit un montant **positif** tapé par l'utilisateur (virgule ou point,
 * zéro à deux décimales) et rend des centimes entiers. Le signe n'est pas
 * géré ici : le formulaire de saisie demande séparément « dépense » ou
 * « entrée », ce qui évite de faire deviner à l'utilisateur s'il doit
 * taper un signe — et évite le piège de parser un signe mal placé.
 *
 * Rend `null` si le texte n'est pas un montant reconnaissable.
 */
export function parsePositiveAmountToCents(raw: string): number | null {
  const trimmed = raw.trim().replace(/\s/g, '');
  if (trimmed === '') return null;
  // Une seule virgule OU un seul point comme séparateur décimal — jamais les
  // deux, et jamais de séparateur de milliers en saisie manuelle.
  const match = /^(\d+)(?:[.,](\d{0,2}))?$/.exec(trimmed);
  if (!match) return null;
  const whole = match[1];
  const frac = (match[2] ?? '').padEnd(2, '0');
  const cents = Number(whole) * 100 + Number(frac);
  return Number.isFinite(cents) ? cents : null;
}

/** Formate des centimes entiers en euros pour préremplir un champ de saisie : `4500` → `"45,00"`. */
export function centsToInputValue(cents: number): string {
  const abs = Math.abs(Math.trunc(cents));
  const euros = Math.floor(abs / 100);
  const rest = String(abs % 100).padStart(2, '0');
  return `${euros},${rest}`;
}

/** Formate des centimes signés pour l'affichage : `-4500` → `"-45,00 €"`. */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '+';
  const abs = Math.abs(Math.trunc(cents));
  const euros = Math.floor(abs / 100);
  const rest = String(abs % 100).padStart(2, '0');
  return `${sign}${euros},${rest} €`;
}
