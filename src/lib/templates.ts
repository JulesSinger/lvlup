import type { ActionInput } from './types';

/**
 * Bibliothèque d'objectifs prêts à l'emploi.
 *
 * Elle existe pour une raison simple, remontée des tests utilisateurs :
 * l'objectif pré-rempli de l'inscription enchante, la page blanche du deuxième
 * objectif décourage. Partir d'un modèle qu'on ajuste coûte infiniment moins
 * cher que d'inventer une échelle depuis zéro.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * RÈGLE ABSOLUE POUR TOUTE ÉTAPE AJOUTÉE ICI : elle doit être MESURABLE.
 *
 * On doit pouvoir répondre « oui » ou « non » sans discuter, sans juger, sans
 * interprétation. Un chiffre, une durée, un compte — jamais une impression.
 *
 *   ✅ « 30 jours sans fumer »          ❌ « Fumer moins »
 *   ✅ « 7 jours sous 2 h d'écran »     ❌ « Ne plus scroller sans intention »
 *   ✅ « Nager 1 km d'affilée »          ❌ « Être à l'aise dans l'eau »
 *
 * Une étape floue ne se coche jamais : on repousse indéfiniment faute de
 * savoir si c'est fait. C'est le meilleur moyen de tuer un objectif.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Les rangs ne sont pas définis ici : `suggestRanks` les attribue selon le
 * nombre d'étapes, et restent modifiables objectif par objectif.
 */

export interface GoalTemplate {
  id: string;
  category: string;
  emoji: string;
  title: string;
  description: string;
  tiers: string[];
  actions: ActionInput[];
}

export const TEMPLATE_CATEGORIES = [
  'Sport',
  'Santé',
  'Arrêter',
  'Esprit',
  'Argent',
  'Apprendre',
  'Créer',
  'Vie',
] as const;

export const GOAL_TEMPLATES: GoalTemplate[] = [
  // ================================================================= Sport
  {
    id: 'semi',
    category: 'Sport',
    emoji: '🏃',
    title: 'Courir un semi-marathon',
    description: 'Passer de coureur du dimanche à finisher.',
    tiers: ["Courir 5 km sans m'arrêter", 'Courir 10 km', 'Courir 15 km', 'Courir 21,1 km'],
    actions: [
      { title: 'Sortie longue', pp: 20 },
      { title: 'Sortie course', pp: 15 },
      { title: 'Sortie de 15 min', pp: 5 },
    ],
  },
  {
    id: 'marathon',
    category: 'Sport',
    emoji: '🏅',
    title: 'Courir un marathon',
    description: 'Les 42,195 km, une étape à la fois.',
    tiers: ['Courir 10 km', 'Courir un semi-marathon', 'Courir 30 km', 'Courir 42,2 km'],
    actions: [
      { title: 'Sortie longue', pp: 20 },
      { title: 'Sortie course', pp: 15 },
      { title: 'Renforcement', pp: 10 },
    ],
  },
  {
    id: 'sport-regulier',
    category: 'Sport',
    emoji: '💪',
    title: 'Me remettre au sport',
    description: 'Reconstruire une régularité qui tient dans le temps.',
    tiers: [
      '3 séances dans la même semaine',
      '12 séances dans le mois',
      '50 séances au total',
      '150 séances au total',
    ],
    actions: [
      { title: 'Séance complète', pp: 15 },
      { title: 'Séance de 15 min', pp: 5 },
    ],
  },
  {
    id: 'pas',
    category: 'Sport',
    emoji: '🚶',
    title: 'Marcher 10 000 pas par jour',
    description: 'Le sport le plus simple du monde, mais tenu.',
    tiers: [
      '7 jours de suite à 10 000 pas',
      '30 jours à 10 000 pas',
      'Une randonnée de 15 km',
      'Une randonnée de 25 km',
    ],
    actions: [
      { title: '10 000 pas atteints', pp: 15 },
      { title: 'Marche de 15 min', pp: 5 },
    ],
  },
  {
    id: 'pompes',
    category: 'Sport',
    emoji: '🤸',
    title: "Faire 30 pompes d'affilée",
    description: 'Un chiffre, pas une impression.',
    tiers: [
      "5 pompes d'affilée",
      "15 pompes d'affilée",
      "25 pompes d'affilée",
      "30 pompes d'affilée",
    ],
    actions: [
      { title: 'Série du jour', pp: 10 },
      { title: 'Une série de 5', pp: 5 },
    ],
  },
  {
    id: 'natation',
    category: 'Sport',
    emoji: '🏊',
    title: 'Nager 1 km sans pause',
    description: 'Longueur après longueur.',
    tiers: ['Nager 200 m sans pause', 'Nager 500 m sans pause', 'Nager 1 km sans pause'],
    actions: [
      { title: 'Séance piscine', pp: 15 },
      { title: '10 longueurs', pp: 10 },
    ],
  },
  {
    id: 'velo',
    category: 'Sport',
    emoji: '🚲',
    title: 'Rouler 100 km à vélo',
    description: "D'une traite, dans la journée.",
    tiers: ["20 km d'une traite", "40 km d'une traite", "70 km d'une traite", "100 km d'une traite"],
    actions: [
      { title: 'Sortie vélo', pp: 15 },
      { title: 'Trajet à vélo', pp: 5 },
    ],
  },

  // ================================================================= Santé
  {
    id: 'poids',
    category: 'Santé',
    emoji: '⚖️',
    title: 'Perdre du poids',
    description: 'Ajuste les kilos de chaque étape à ton objectif — le principe reste le même.',
    tiers: ['Perdre 2 kg', 'Perdre 5 kg', 'Perdre 8 kg', 'Perdre 12 kg'],
    actions: [
      { title: 'Journée sans écart', pp: 15 },
      { title: 'Repas équilibré', pp: 5 },
      { title: 'Pesée hebdomadaire', pp: 10 },
    ],
  },
  {
    id: 'legumes',
    category: 'Santé',
    emoji: '🥗',
    title: 'Manger 5 fruits et légumes par jour',
    description: 'La recommandation, appliquée pour de bon.',
    tiers: ['7 jours de suite', '30 jours de suite', '90 jours de suite'],
    actions: [
      { title: '5 portions atteintes', pp: 15 },
      { title: 'Un fruit de plus', pp: 5 },
    ],
  },
  {
    id: 'eau',
    category: 'Santé',
    emoji: '💧',
    title: 'Boire 1,5 L d’eau par jour',
    description: 'Le changement le plus bête et le plus efficace.',
    tiers: ['7 jours de suite', '30 jours de suite', '90 jours de suite'],
    actions: [
      { title: '1,5 L atteint', pp: 10 },
      { title: 'Un grand verre de plus', pp: 5 },
    ],
  },
  {
    id: 'sommeil',
    category: 'Santé',
    emoji: '😴',
    title: 'Dormir 7 h par nuit',
    description: 'Des horaires réguliers, mesurés nuit après nuit.',
    tiers: ['7 nuits de suite à 7 h', '30 nuits à 7 h', '90 nuits à 7 h'],
    actions: [
      { title: 'Couché avant 23 h', pp: 15 },
      { title: "Pas d'écran la dernière heure", pp: 10 },
    ],
  },
  {
    id: 'cuisine',
    category: 'Santé',
    emoji: '🍳',
    title: 'Cuisiner moi-même',
    description: 'Moins de plats préparés, plus de vraie cuisine.',
    tiers: [
      '5 repas cuisinés dans la semaine',
      '20 repas cuisinés dans le mois',
      '30 jours sans plat préparé',
      '15 recettes maîtrisées sans recette écrite',
    ],
    actions: [
      { title: 'Repas cuisiné', pp: 10 },
      { title: 'Courses de la semaine', pp: 10 },
    ],
  },

  // =============================================================== Arrêter
  {
    id: 'tabac',
    category: 'Arrêter',
    emoji: '🚭',
    title: 'Arrêter de fumer',
    description: 'Un jour sans, puis un autre.',
    tiers: [
      '1 jour sans fumer',
      '7 jours sans fumer',
      '30 jours sans fumer',
      '90 jours sans fumer',
      '365 jours sans fumer',
    ],
    actions: [
      { title: 'Journée sans fumer', pp: 15 },
      { title: 'Une envie surmontée', pp: 5 },
    ],
  },
  {
    id: 'alcool',
    category: 'Arrêter',
    emoji: '🥤',
    title: 'Boire moins d’alcool',
    description: 'Des jours sans, comptés.',
    tiers: [
      '7 jours sans alcool',
      '30 jours sans alcool',
      '90 jours sans alcool',
      '180 jours sans alcool',
    ],
    actions: [
      { title: 'Journée sans alcool', pp: 15 },
      { title: 'Soirée sans boire', pp: 20 },
    ],
  },
  {
    id: 'ecrans',
    category: 'Arrêter',
    emoji: '📵',
    title: 'Réduire mon temps d’écran',
    description: 'Chiffres relevés par ton téléphone — rien de subjectif.',
    tiers: [
      "7 jours sous 3 h d'écran par jour",
      "30 jours sous 3 h d'écran par jour",
      "30 jours sous 2 h d'écran par jour",
      "90 jours sous 2 h d'écran par jour",
    ],
    actions: [
      { title: 'Journée sous la limite', pp: 15 },
      { title: 'Soirée sans téléphone', pp: 20 },
    ],
  },
  {
    id: 'reseaux-matin',
    category: 'Arrêter',
    emoji: '📱',
    title: 'Plus de réseaux sociaux le matin',
    description: 'Rien avant midi.',
    tiers: ['7 jours sans réseaux avant midi', '30 jours de suite', '90 jours de suite'],
    actions: [
      { title: 'Matinée sans réseaux', pp: 15 },
      { title: 'Téléphone hors de la chambre', pp: 10 },
    ],
  },
  {
    id: 'sucre',
    category: 'Arrêter',
    emoji: '🍫',
    title: 'Arrêter de grignoter',
    description: 'Rien entre les repas.',
    tiers: ['7 jours sans grignotage', '30 jours sans grignotage', '90 jours sans grignotage'],
    actions: [
      { title: 'Journée sans grignotage', pp: 15 },
      { title: 'Une envie remplacée par un fruit', pp: 5 },
    ],
  },

  // ================================================================ Esprit
  {
    id: 'meditation',
    category: 'Esprit',
    emoji: '🧘',
    title: 'Méditer tous les jours',
    description: 'Des séances comptées, pas une ambiance.',
    tiers: ['7 séances', '30 séances', '100 séances', '365 séances'],
    actions: [
      { title: 'Séance de 10 min', pp: 15 },
      { title: 'Séance de 2 min', pp: 5 },
    ],
  },
  {
    id: 'journal',
    category: 'Esprit',
    emoji: '📓',
    title: 'Tenir un journal',
    description: 'Quelques lignes par jour, pour y voir clair.',
    tiers: [
      '7 jours d’écriture de suite',
      '30 jours d’écriture',
      'Un carnet entier rempli',
      '365 jours d’écriture',
    ],
    actions: [
      { title: 'Page du jour', pp: 15 },
      { title: 'Trois lignes', pp: 5 },
    ],
  },
  {
    id: 'gratitude',
    category: 'Esprit',
    emoji: '🙏',
    title: 'Noter 3 gratitudes par jour',
    description: 'Trois lignes, chaque soir.',
    tiers: ['7 jours de suite', '30 jours de suite', '100 jours de suite'],
    actions: [{ title: 'Trois gratitudes notées', pp: 10 }],
  },

  // ================================================================ Argent
  {
    id: 'epargne',
    category: 'Argent',
    emoji: '💰',
    title: 'Me constituer une épargne',
    description: 'Ajuste les montants à ta situation.',
    tiers: [
      'Épargner 500 €',
      'Épargner 2 000 €',
      'Épargner 5 000 €',
      '3 mois de dépenses de côté',
    ],
    actions: [
      { title: 'Virement vers l’épargne', pp: 20 },
      { title: 'Dépense évitée', pp: 5 },
    ],
  },
  {
    id: 'budget',
    category: 'Argent',
    emoji: '📊',
    title: 'Tenir mon budget',
    description: 'Savoir où part l’argent, chiffres à l’appui.',
    tiers: [
      '7 jours de dépenses notées',
      '30 jours de dépenses notées',
      '3 mois sans découvert',
      '6 mois sans découvert',
    ],
    actions: [
      { title: 'Dépenses du jour notées', pp: 10 },
      { title: 'Point budget hebdomadaire', pp: 15 },
    ],
  },
  {
    id: 'dettes',
    category: 'Argent',
    emoji: '🧾',
    title: 'Rembourser mes dettes',
    description: 'Ajuste les montants à ce que tu dois.',
    tiers: [
      'Rembourser 500 €',
      'Rembourser 2 000 €',
      'Rembourser 5 000 €',
      'Solde intégralement remboursé',
    ],
    actions: [
      { title: 'Remboursement effectué', pp: 20 },
      { title: 'Dépense évitée', pp: 5 },
    ],
  },
  {
    id: 'investir',
    category: 'Argent',
    emoji: '📈',
    title: 'Investir chaque mois',
    description: 'Un versement par mois, sans exception.',
    tiers: ['1er versement effectué', '6 versements mensuels', '12 versements', '24 versements'],
    actions: [
      { title: 'Versement du mois', pp: 20 },
      { title: '15 min à me former', pp: 10 },
    ],
  },

  // ============================================================= Apprendre
  {
    id: 'lecture',
    category: 'Apprendre',
    emoji: '📚',
    title: 'Me remettre à lire',
    description: 'Des livres finis, pas des livres commencés.',
    tiers: ['1 livre terminé', '3 livres terminés', '6 livres terminés', '12 livres terminés'],
    actions: [
      { title: 'Lire 20 pages', pp: 15 },
      { title: 'Lire 5 minutes', pp: 5 },
    ],
  },
  {
    id: 'langue',
    category: 'Apprendre',
    emoji: '🗣️',
    title: 'Apprendre une langue',
    description: 'Jusqu’à tenir une vraie conversation.',
    tiers: [
      '30 jours de pratique',
      '100 jours de pratique',
      'Tenir 10 min de conversation',
      'Lire un livre entier dans la langue',
    ],
    actions: [
      { title: 'Session de 20 min', pp: 15 },
      { title: '5 min de révision', pp: 5 },
    ],
  },
  {
    id: 'instrument',
    category: 'Apprendre',
    emoji: '🎸',
    title: 'Apprendre un instrument',
    description: 'Des morceaux joués en entier, comptés.',
    tiers: [
      'Jouer 1 morceau court en entier',
      'Jouer 3 morceaux en entier',
      'Jouer 30 min sans partition',
      'Jouer devant du public',
    ],
    actions: [
      { title: 'Session de travail', pp: 15 },
      { title: '10 min de gammes', pp: 5 },
    ],
  },
  {
    id: 'code',
    category: 'Apprendre',
    emoji: '💻',
    title: 'Apprendre à coder',
    description: 'Des projets terminés, pas des tutoriels commencés.',
    tiers: [
      'Terminer un premier cours complet',
      '3 projets terminés',
      'Un projet publié en ligne',
      'Une contribution acceptée sur un projet open source',
    ],
    actions: [
      { title: 'Session de code', pp: 15 },
      { title: '15 min de pratique', pp: 5 },
    ],
  },

  // ================================================================= Créer
  {
    id: 'ecrire',
    category: 'Créer',
    emoji: '✍️',
    title: 'Écrire un livre',
    description: 'Compté en mots, pas en intentions.',
    tiers: [
      '5 000 mots écrits',
      '20 000 mots écrits',
      '50 000 mots écrits',
      'Manuscrit terminé',
    ],
    actions: [
      { title: 'Session d’écriture', pp: 20 },
      { title: '200 mots', pp: 10 },
    ],
  },
  {
    id: 'photo',
    category: 'Créer',
    emoji: '📷',
    title: 'Publier mes photos',
    description: 'Des photos sorties du téléphone.',
    tiers: ['5 photos publiées', '20 photos publiées', '50 photos publiées'],
    actions: [
      { title: 'Séance photo', pp: 15 },
      { title: 'Une photo publiée', pp: 10 },
    ],
  },
  {
    id: 'projet',
    category: 'Créer',
    emoji: '🚀',
    title: 'Lancer mon projet',
    description: 'Du cahier des charges aux premiers utilisateurs.',
    tiers: [
      'Cahier des charges écrit',
      'Première version fonctionnelle',
      'Projet mis en ligne',
      '10 utilisateurs',
      '100 utilisateurs',
    ],
    actions: [
      { title: 'Session de travail', pp: 20 },
      { title: '30 min sur le projet', pp: 10 },
    ],
  },

  // =================================================================== Vie
  {
    id: 'desencombrer',
    category: 'Vie',
    emoji: '🏠',
    title: 'Désencombrer mon logement',
    description: 'Pièce par pièce, objet par objet.',
    tiers: [
      '1 pièce entièrement triée',
      '3 pièces entièrement triées',
      'Tout le logement trié',
      '100 objets donnés ou vendus',
    ],
    actions: [
      { title: 'Session de tri', pp: 15 },
      { title: '5 objets sortis', pp: 5 },
    ],
  },
  {
    id: 'ranger',
    category: 'Vie',
    emoji: '🧹',
    title: 'Ranger tous les jours',
    description: '15 minutes par jour, comptées.',
    tiers: ['7 jours de suite', '30 jours de suite', '90 jours de suite'],
    actions: [
      { title: '15 min de rangement', pp: 10 },
      { title: 'Une surface dégagée', pp: 5 },
    ],
  },
  {
    id: 'proches',
    category: 'Vie',
    emoji: '👥',
    title: 'Voir mes proches plus souvent',
    description: 'Des rendez-vous comptés, pas des bonnes intentions.',
    tiers: [
      '4 rendez-vous dans le mois',
      '12 rendez-vous dans le trimestre',
      '30 rendez-vous dans le semestre',
    ],
    actions: [
      { title: 'Rendez-vous honoré', pp: 20 },
      { title: 'Un message envoyé', pp: 5 },
    ],
  },
  {
    id: 'famille',
    category: 'Vie',
    emoji: '📞',
    title: 'Appeler ma famille chaque semaine',
    description: 'Un appel par semaine, sur l’année.',
    tiers: ['4 appels', '12 appels', '26 appels', '52 appels'],
    actions: [{ title: 'Appel passé', pp: 15 }],
  },
  {
    id: 'job',
    category: 'Vie',
    emoji: '💼',
    title: 'Trouver un nouveau travail',
    description: 'Des candidatures et des entretiens, comptés.',
    tiers: [
      'CV et profil à jour',
      '10 candidatures envoyées',
      '30 candidatures envoyées',
      '5 entretiens passés',
      'Offre signée',
    ],
    actions: [
      { title: 'Candidature envoyée', pp: 15 },
      { title: '30 min de recherche', pp: 5 },
    ],
  },
];
