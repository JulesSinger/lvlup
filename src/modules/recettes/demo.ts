import { shiftDay } from '../../core/lib/day';
import type { ModuleDemo } from '../../core/lib/module';
import { recettesStore as store } from './data';
import type { Step } from './lib/types';

const lines = (text: string) => text.split('\n').map((t) => ({ text: t, section: null }));

/** Les pâtes aux lardons de l'étude, minutées (docs/etude-recettes.md §20) : le plan et « En cuisine » à montrer. */
const PATES_STEPS: Step[] = [
  { id: 'eau', text: 'Porter à ébullition une grande casserole d’eau salée.', station: 'Casserole', minutes: 8, hands: false, start: { after: 'launch' } },
  { id: 'oignon', text: 'Pendant ce temps, émincer l’oignon.', station: 'Plan de travail', minutes: 3, hands: true, start: { after: 'start', of: 'eau', offset: 0 } },
  { id: 'lardons', text: 'Faire revenir les lardons et l’oignon dans une poêle 7 minutes.', station: 'Poêle', minutes: 7, hands: false },
  { id: 'pates', text: 'Quand l’eau bout, cuire les pâtes 10 minutes.', station: 'Casserole', minutes: 10, hands: false, start: { after: 'end', of: 'eau' } },
  { id: 'oeufs', text: 'Battre les œufs avec la crème et le parmesan.', station: 'Plan de travail', minutes: 3, hands: true, start: { after: 'start', of: 'pates', offset: 0 } },
  { id: 'fin', text: 'Égoutter les pâtes et mélanger le tout hors du feu.', station: 'Casserole', minutes: 3, hands: true, start: { after: 'end', of: 'pates' } },
];

/**
 * La démo de Recettes (15/10/2026) : trois recettes (dont une minutée), une
 * favorite, une déjà faite et notée, et deux repas au menu de la semaine.
 */
export const recettesDemo: ModuleDemo = {
  async seed(today) {
    const pates = await store.createRecipe({
      title: 'Pâtes aux lardons',
      category: 'plat',
      servings: 2,
      prepMinutes: 10,
      cookMinutes: 15,
      tags: ['rapide'],
      favorite: true,
      ingredients: lines('200 g de pâtes\n150 g de lardons\n1 oignon\n2 œufs\n10 cl de crème fraîche\n40 g de parmesan'),
      steps: PATES_STEPS,
    });
    const curry = await store.createRecipe({
      title: 'Curry de pois chiches',
      category: 'plat',
      servings: 4,
      prepMinutes: 15,
      cookMinutes: 25,
      tags: ['végétarien'],
      ingredients: lines('400 g de pois chiches\n40 cl de lait de coco\n1 oignon\n2 gousses d’ail\n2 c. à soupe de curry\n200 g de riz basmati'),
      steps: [
        { text: 'Faire revenir l’oignon et l’ail émincés 5 minutes.' },
        { text: 'Ajouter le curry, puis les pois chiches et le lait de coco.' },
        { text: 'Laisser mijoter 20 minutes ; servir avec le riz.' },
      ],
    });
    await store.createRecipe({
      title: 'Crêpes',
      category: 'dessert',
      servings: 15,
      yieldLabel: 'crêpes',
      prepMinutes: 10,
      restMinutes: 60,
      ingredients: lines('250 g de farine\n4 œufs\n50 cl de lait\n1 pincée de sel\n50 g de beurre fondu'),
      steps: [{ text: 'Mélanger farine et œufs, puis le lait petit à petit.' }, { text: 'Ajouter le beurre fondu, laisser reposer 1 heure.' }, { text: 'Cuire à la poêle bien chaude.' }],
    });
    await store.addCooked({ recipeId: curry.id, day: shiftDay(today, -6), servings: 4, rating: 5, comment: 'Doubler l’ail' });
    await store.addPlanEntry({ day: today, meal: 'soir', recipeId: pates.id, title: '', servings: 2, position: 0 });
    await store.addPlanEntry({ day: shiftDay(today, 1), meal: 'midi', recipeId: null, title: 'Restes', servings: null, position: 0 });
  },
  tour: [
    {
      target: '.recettes-card',
      title: 'Ton carnet',
      body: 'Chaque recette s’ouvre sur sa fiche : les quantités se règlent au nombre de personnes, et « Je l’ai faite » garde une note et un mot.',
    },
    {
      target: '.recettes-search',
      title: 'Chercher, ou cuisiner avec ce qu’on a',
      body: 'Un mot du titre, d’un ingrédient ou d’une étiquette ; ou les filtres, dont « avec ce que j’ai ».',
    },
    {
      target: '.topbar-add',
      title: 'Ajouter une recette',
      body: 'Tape-la, colle-la depuis un message ou un PDF, ou donne le lien d’un site : Atlas sépare ingrédients et étapes.',
    },
    {
      target: '.recettes-nav',
      title: 'Le menu de la semaine',
      body: 'Midi et soir, une recette ou « Restes » ; les ingrédients de la semaine partent dans Courses, d’un geste.',
    },
    {
      title: 'À toi',
      body: 'Ouvre « Pâtes aux lardons » : son plan montre ce qui se fait en parallèle, et « Cuisiner » lance l’écran En cuisine. Ce sont des exemples : rien n’est enregistré dans ton compte.',
    },
  ],
};
