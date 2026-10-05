/**
 * Les montants — bibliothèque pure. En centimes entiers partout, comme
 * Budget ; recopié plutôt qu'importé, aucun module n'important d'un autre.
 */

/**
 * « 900 », « 1 234,50 », « 1234.5 € » → centimes. `null` pour un champ vide,
 * `undefined` pour une saisie qui n'est pas un montant positif.
 */
export function parseEuros(text: string): number | null | undefined {
  const cleaned = text.replace(/[\s  €]/g, '').replace(',', '.');
  if (cleaned === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return undefined;
  const [whole, decimals = ''] = cleaned.split('.');
  return Number(whole) * 100 + Number(decimals.padEnd(2, '0'));
}

/** 123456 → « 1 234,56 € » ; les centimes ronds ne s'écrivent pas (« 900 € »). */
export function formatEuros(cents: number): string {
  const euros = Math.floor(Math.abs(cents) / 100);
  const rest = Math.abs(cents) % 100;
  const whole = euros.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return `${cents < 0 ? '−' : ''}${whole}${rest ? `,${String(rest).padStart(2, '0')}` : ''} €`;
}

/** Pour remplir un champ : 90000 → « 900 », 12345 → « 123,45 ». */
export function centsToInput(cents: number | null): string {
  if (cents === null) return '';
  const rest = cents % 100;
  return `${Math.floor(cents / 100)}${rest ? `,${String(rest).padStart(2, '0')}` : ''}`;
}
