/**
 * Compléter une ligne déjà sur la liste plutôt que d'en ajouter une seconde
 * (une seule ligne par article, comme à la clôture d'une course). Sorti de
 * `data/shoppingService.ts` le 28/11/2026 : les modèles de liste s'en servent
 * aussi (`lib/templates.ts`).
 */

/** Les bornes de la base (`courses_list`). */
export const QUANTITY_MAX = 30;
export const NOTE_MAX = 200;

/**
 * Compléter une quantité déjà sur la liste : « 1 kg » + « 500 g » →
 * « 1 kg + 500 g ». Trop long pour la colonne (30 caractères) : l'ajout part
 * dans la note, jamais perdu.
 */
export function mergeQuantity(old: string, extra: string, note: string): { quantity: string; note: string } {
  if (!extra) return { quantity: old, note };
  if (!old) return { quantity: extra.slice(0, QUANTITY_MAX), note };
  const merged = `${old} + ${extra}`;
  if (merged.length <= QUANTITY_MAX) return { quantity: merged, note };
  return { quantity: old, note: [note, `+ ${extra}`].filter(Boolean).join(' ') };
}

export const joinNote = (old: string, extra: string) => [old, extra].filter(Boolean).join(' · ').slice(0, NOTE_MAX);
