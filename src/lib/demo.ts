import type { GoalInput, TierInput } from './types';

/** Exemples chargeables en un clic depuis l'écran vide. */
export const DEMO_GOALS: (GoalInput & { tiers: TierInput[] })[] = [
  {
    title: 'Courir un marathon',
    description: 'Passer de coureur du dimanche à finisher.',
    emoji: '🏃',
    tiers: [
      { title: 'Courir 10 km', rank: 'bronze' },
      { title: 'Courir 15 km', rank: 'argent' },
      { title: 'Courir un semi-marathon', rank: 'or' },
      { title: 'Courir 30 km', rank: 'diamant' },
      { title: 'Courir un marathon', rank: 'challenger' },
    ],
  },
  {
    title: "Réduire mon temps d'écran",
    description: 'Reprendre la main sur mes soirées.',
    emoji: '📵',
    tiers: [
      { title: 'Ne plus scroller sans intention', rank: 'bronze' },
      { title: "Arrêter de m'endormir avec une vidéo YouTube", rank: 'or' },
      { title: "Plus d'écran après le travail", rank: 'maitre' },
    ],
  },
  {
    title: 'Lecture',
    description: 'Retrouver le réflexe de lire au lieu de scroller.',
    emoji: '📚',
    tiers: [
      { title: 'Rattraper mon retard sur Sciences et Avenir', rank: 'fer' },
      { title: "Finir le livre que j'avais commencé", rank: 'bronze' },
      { title: 'Lire 1 nouveau livre entier', rank: 'or' },
      { title: 'Lire 3 livres entiers', rank: 'diamant' },
      { title: 'Lire 5 livres entiers', rank: 'grand-maitre' },
    ],
  },
];
