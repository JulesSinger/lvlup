import { shiftDay } from '../../core/lib/day';
import type { ModuleDemo } from '../../core/lib/module';
import { goalsStore as store } from './data';
import { DEMO_GOALS } from './lib/demo';

/** Les actions du quotidien des objectifs d'exemple, dans l'ordre de `DEMO_GOALS`. */
const ACTIONS = [
  { title: 'Sortie course', pp: 20, unit: 'km', defaultValue: 6 },
  { title: 'Soirée sans écran', pp: 10 },
  { title: 'Lire 20 pages', pp: 10 },
];

/** Les jours (en arrière d'aujourd'hui) où chaque action a été faite : une série vivante, avec un trou. */
const DONE = [
  [1, 3, 5, 8, 10, 12],
  [0, 1, 2, 3, 5, 6, 7, 9],
  [0, 1, 2, 4, 5, 6, 7, 8, 9, 11, 13],
];

/**
 * La démo d'Objectifs (15/10/2026) : les trois objectifs d'exemple du module
 * (`lib/demo.ts`), chacun avec son action du quotidien et deux semaines de
 * réalisations — de quoi voir la série, la grille et les rangs.
 */
export const objectifsDemo: ModuleDemo = {
  async seed(today) {
    for (const [i, demo] of DEMO_GOALS.entries()) {
      const goal = await store.createGoal({ title: demo.title, description: demo.description, emoji: demo.emoji }, demo.tiers, [ACTIONS[i]]);
      const action = (await store.listActions()).find((a) => a.goalId === goal.id);
      if (!action) continue;
      for (const back of DONE[i]) {
        await store.addCheckin(goal.id, shiftDay(today, -back), action.id, action.pp, ACTIONS[i].defaultValue ?? null);
      }
    }
  },
  tour: [
    {
      target: '.checkin-chip',
      title: 'Cocher sa journée',
      body: 'Chaque objectif a ses petites actions du quotidien. Coche ce que tu as fait aujourd’hui : chacune rapporte des points de progression.',
    },
    {
      target: '.day-band',
      title: 'Ta série',
      body: 'Les sept derniers jours, d’un coup d’œil : une flamme pour un jour fait, un gel quand un oubli a été couvert.',
    },
    {
      target: '.nav',
      title: 'Objectifs, historique, trophées',
      body: 'Chaque objectif a une échelle de paliers, de Fer à Challenger ; son rang est celui du plus haut palier atteint. Les trophées célèbrent les grands moments.',
    },
    {
      target: '.topbar-add',
      title: 'Un nouvel objectif',
      body: 'Pars d’un modèle (courir un semi, méditer, lire…) ou écris le tien, paliers et actions compris.',
    },
    {
      title: 'À toi',
      body: 'Ce sont des exemples : coche, ouvre un objectif, réordonne les tuiles. Rien n’est enregistré dans ton compte.',
    },
  ],
};
