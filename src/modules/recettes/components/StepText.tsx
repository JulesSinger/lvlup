import { stepWithAmounts } from '../lib/cooking';
import type { Ingredient } from '../lib/types';

/** « 3 », « 1/2 » : un nombre sans unité se lit « ×3 » (« les oignons ×3 »). */
const countOnly = (amount: string) => /^[\d\s.,/½¼¾–-]+(?:à\s*[\d.,/]+)?$/.test(amount);

/**
 * Le texte d'une étape avec ses quantités là où l'ingrédient est nommé
 * (16/10/2026) : « chauffer l'huile 1 c. à soupe et le beurre 10 g », la
 * quantité en pastille, ajustée au nombre de personnes. Pas besoin de
 * remonter à la liste.
 */
export function StepText({ text, ingredients, factor }: { text: string; ingredients: Ingredient[]; factor: number }) {
  return (
    <>
      {stepWithAmounts(text, ingredients, factor).map((p, i) => (
        <span key={i}>
          {p.text}
          {p.amount && ' '}
          {p.amount && <span className="recettes-amount">{countOnly(p.amount) ? `×${p.amount}` : p.amount}</span>}
        </span>
      ))}
    </>
  );
}
