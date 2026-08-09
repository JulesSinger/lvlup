import type { GoalInput, TierInput } from './types';

/** Exemples chargeables en un clic depuis l'écran vide. */
export const DEMO_GOALS: (GoalInput & { tiers: TierInput[] })[] = [
  {
    title: 'Courir un marathon',
    description: 'Passer de coureur du dimanche à finisher.',
    emoji: '🏃',
    tiers: [
      { title: "Courir 5 km sans m'arrêter", rank: 'bronze' },
      { title: 'Courir 10 km', rank: 'argent' },
      { title: 'Courir 15 km', rank: 'or' },
      { title: 'Courir 21,1 km', rank: 'diamant' },
      { title: 'Courir 42,2 km', rank: 'challenger' },
    ],
  },
  {
    title: "Réduire mon temps d'écran",
    description: 'Reprendre la main sur mes soirées.',
    emoji: '📵',
    tiers: [
      { title: "7 jours sous 3 h d'écran par jour", rank: 'bronze' },
      { title: "30 jours sous 3 h d'écran par jour", rank: 'argent' },
      { title: "30 jours sous 2 h d'écran par jour", rank: 'or' },
    ],
  },
  {
    title: 'Lecture',
    description: 'Retrouver le réflexe de lire au lieu de scroller.',
    emoji: '📚',
    tiers: [
      { title: '1 livre terminé', rank: 'bronze' },
      { title: '3 livres terminés', rank: 'argent' },
      { title: '6 livres terminés', rank: 'or' },
      { title: '12 livres terminés', rank: 'diamant' },
      { title: '20 livres terminés', rank: 'challenger' },
    ],
  },
];
