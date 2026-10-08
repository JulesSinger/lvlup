import type { RecipeCategory } from './types';

/** Les catégories dites en français, et leur emblème (la couverture d'une recette sans photo). */
export const CATEGORY_LABELS: Record<RecipeCategory, string> = {
  entree: 'Entrée',
  plat: 'Plat',
  dessert: 'Dessert',
  aperitif: 'Apéritif',
  'petit-dejeuner': 'Petit-déjeuner',
  accompagnement: 'Accompagnement',
  sauce: 'Sauce',
  boisson: 'Boisson',
  autre: 'Autre',
};

export const CATEGORY_EMOJIS: Record<RecipeCategory, string> = {
  entree: '🥗',
  plat: '🍲',
  dessert: '🍰',
  aperitif: '🫒',
  'petit-dejeuner': '🥐',
  accompagnement: '🥔',
  sauce: '🫙',
  boisson: '🍹',
  autre: '🍽️',
};
