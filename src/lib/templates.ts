import { MEASURE_PP } from './quantities';
import type { ActionInput, Direction, TargetMode, TierKind } from './types';

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
 *
 * ─────────────────────────────────────────────────────────────────────────
 * CHAQUE ÉTAPE DÉCLARE COMMENT ELLE SE COMPTE.
 *
 * Sans ça, le quotidien et les paliers restent deux systèmes qui ne se
 * parlent pas : on coche tous les soirs et le palier « 30 jours » n'en sait
 * rien. Cinq natures, parce que la même grammaire recouvre cinq choses très
 * différentes :
 *
 *   compte(...)      « 30 jours sans écran »   jours distincts
 *   cumul(...)       « 100 km »                somme des quantités
 *   serie(...)       « 30 jours sans fumer »   jours CONSÉCUTIFS
 *   perf(...)        « Courir 10 km »          une seule séance
 *   mesure(...)      « Perdre 5 kg »           une grandeur suivie
 *   (rien)           « Offre signée »          coché à la main
 *
 * Le piège à ne jamais rouvrir : `perf('Courir 10 km', 10, 'km')` et
 * `cumul('Courir 100 km', 100, 'km')` s'écrivent presque pareil et n'ont rien
 * à voir. Deux sorties de 5 km ne font pas un 10 km.
 *
 * Sur les séries : le cumul est le défaut, même quand on dit « de suite ».
 * Un jour manqué qui efface quarante jours d'efforts est le mode d'échec le
 * mieux documenté des traqueurs d'habitudes. `serie()` est réservé aux cas où
 * la consécutivité EST ce qu'on mesure — arrêter de fumer, arrêter de boire —
 * et l'édulcorer serait malhonnête.
 * ─────────────────────────────────────────────────────────────────────────
 */

export interface TierSpec {
  title: string;
  kind?: TierKind;
  target?: number;
  unit?: string;
  direction?: Direction;
  mode?: TargetMode;
}

/** Jours distincts où l'action a été faite. Un jour manqué ne retire rien. */
const compte = (title: string, target: number, unit = 'jours'): TierSpec => ({
  title,
  kind: 'compte',
  target,
  unit,
});

/** Somme des quantités relevées : kilomètres, euros, mots. */
const cumul = (title: string, target: number, unit: string): TierSpec => ({
  title,
  kind: 'cumul',
  target,
  unit,
});

/** Jours consécutifs. Réservé aux paliers dont c'est le sens même. */
const serie = (title: string, target: number, unit = 'jours'): TierSpec => ({
  title,
  kind: 'serie',
  target,
  unit,
});

/** Meilleure valeur d'une SEULE séance — jamais une somme. */
const perf = (
  title: string,
  target: number,
  unit: string,
  direction: Direction = 'hausse',
): TierSpec => ({ title, kind: 'performance', target, unit, direction });

/** Une grandeur suivie dans le temps, relative au premier relevé. */
const mesure = (
  title: string,
  target: number,
  unit: string,
  direction: Direction = 'baisse',
): TierSpec => ({ title, kind: 'mesure', target, unit, direction, mode: 'delta' });

/**
 * Action quantifiée : un appui enregistre `defaultValue` sans ouvrir de
 * clavier, et la pastille l'annonce (« 8 km »). C'est ce qui relie un modèle
 * à ses paliers en kilomètres ou en euros — sans ça, un palier « 100 km »
 * reste bloqué à zéro quoi qu'on coche.
 *
 * On n'en met que là où la valeur de l'action EST ce que le palier mesure :
 * une « dépense évitée » ne fait pas grossir un compte d'épargne, une
 * « session de tri » ne sort pas d'objets.
 */
const qte = (title: string, pp: number, defaultValue: number, unit: string): ActionInput => ({
  title,
  pp,
  unit,
  defaultValue,
});

/**
 * Relevé : la saisie est le geste (on ne « coche » pas une pesée). Peu de PP,
 * pour qu'on ne farme pas des points sur une balance — et sans lui, un palier
 * de type mesure n'aurait aucune façon d'être atteint.
 */
const releve = (title: string, unit: string): ActionInput => ({
  title,
  pp: MEASURE_PP,
  unit,
  isMeasure: true,
});

/**
 * L'échelle d'une habitude — toujours la même : une semaine, un mois, un
 * trimestre, une année.
 *
 * `compte` et non `serie`, délibérément. Une habitude se tient sur des années ;
 * un compteur qui retombe à zéro après quarante jours est le mode d'échec le
 * mieux documenté du domaine, et il frappe précisément les gens qui tenaient.
 * La consécutivité n'est pas abandonnée pour autant : elle vit dans le streak
 * et dans la règle des deux jours, qui signalent le danger sans effacer le
 * travail. D'où « jours réussis » plutôt que « jours d'affilée » — l'intitulé
 * dit exactement ce qui est compté.
 */
const habitude = (): TierSpec[] => [
  compte('7 jours réussis', 7),
  compte('30 jours réussis', 30),
  compte('90 jours réussis', 90),
  compte('365 jours réussis', 365),
];

export interface GoalTemplate {
  id: string;
  category: string;
  /**
   * Ce modèle est-il une habitude ?
   *
   * Volontairement un drapeau et pas une catégorie : « habitude » n'est pas un
   * domaine de vie, c'est une **forme**. Méditer relève de l'esprit, arrêter de
   * fumer relève de l'arrêt, boire de l'eau relève de la santé — et les trois
   * sont des habitudes. Les ranger dans une neuvième case obligerait soit à les
   * dupliquer, soit à vider les catégories dont ils viennent.
   *
   * Ce qu'une habitude a en commun : un geste quotidien, une échelle qui se
   * compte en jours, et pas de fin — d'où l'état « entretien ».
   */
  habit?: boolean;
  emoji: string;
  title: string;
  description: string;
  tiers: TierSpec[];
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
    tiers: [
      perf("Courir 5 km sans m'arrêter", 5, 'km'),
      perf('Courir 10 km', 10, 'km'),
      perf('Courir 15 km', 15, 'km'),
      perf('Courir 21,1 km', 21.1, 'km'),
    ],
    actions: [
      qte('Sortie longue', 20, 12, 'km'),
      qte('Sortie course', 15, 6, 'km'),
      qte('Sortie de 15 min', 5, 2, 'km'),
    ],
  },
  {
    id: 'marathon',
    category: 'Sport',
    emoji: '🏅',
    title: 'Courir un marathon',
    description: 'Les 42,195 km, une étape à la fois.',
    tiers: [
      perf('Courir 10 km', 10, 'km'),
      perf('Courir un semi-marathon', 21.1, 'km'),
      perf('Courir 30 km', 30, 'km'),
      perf('Courir 42,2 km', 42.2, 'km'),
    ],
    actions: [
      qte('Sortie longue', 20, 15, 'km'),
      qte('Sortie course', 15, 8, 'km'),
      // Le renforcement n'est pas de la course : sans unité, il rapporte des
      // PP sans fausser la meilleure distance.
      { title: 'Renforcement', pp: 10 },
    ],
  },
  {
    id: 'sport-regulier',
    category: 'Sport',
    emoji: '💪',
    title: 'Me remettre au sport',
    description: 'Reconstruire une régularité qui tient dans le temps.',
    // Les fenêtres « dans la semaine », « dans le mois » n'étaient pas
    // tenables : rien ne les mesurait. On compte simplement les séances.
    tiers: [
      compte('3 séances', 3, 'séances'),
      compte('12 séances', 12, 'séances'),
      compte('50 séances', 50, 'séances'),
      compte('150 séances', 150, 'séances'),
    ],
    actions: [
      { title: 'Séance complète', pp: 15 },
      { title: 'Séance de 15 min', pp: 5 },
    ],
  },
  {
    id: 'pas',
    habit: true,
    category: 'Sport',
    emoji: '🚶',
    title: 'Marcher 10 000 pas par jour',
    description: 'Le sport le plus simple du monde, mais tenu.',
    tiers: [
      compte('7 jours à 10 000 pas', 7),
      compte('30 jours à 10 000 pas', 30),
      perf('Une randonnée de 15 km', 15, 'km'),
      perf('Une randonnée de 25 km', 25, 'km'),
    ],
    actions: [
      { title: '10 000 pas atteints', pp: 15 },
      { title: 'Marche de 15 min', pp: 5 },
      // Les deux derniers paliers se comptent en kilomètres : sans une action
      // qui en porte, ils resteraient à zéro pour toujours.
      qte('Randonnée', 20, 12, 'km'),
    ],
  },
  {
    id: 'pompes',
    category: 'Sport',
    emoji: '🤸',
    title: "Faire 30 pompes d'affilée",
    description: 'Un chiffre, pas une impression.',
    tiers: [
      perf("5 pompes d'affilée", 5, 'pompes'),
      perf("15 pompes d'affilée", 15, 'pompes'),
      perf("25 pompes d'affilée", 25, 'pompes'),
      perf("30 pompes d'affilée", 30, 'pompes'),
    ],
    actions: [
      // Le palier dit « d'affilée » : l'action doit dire la même chose. Avec
      // « Série du jour », 30 pompes en trois fois se seraient saisies comme
      // 30 — et auraient validé Challenger sans jamais en faire 30 d'affilée.
      qte('Ma meilleure série', 10, 10, 'pompes'),
      qte('Une série de 5', 5, 5, 'pompes'),
    ],
  },
  {
    id: 'natation',
    category: 'Sport',
    emoji: '🏊',
    title: 'Nager 1 km sans pause',
    description: 'Longueur après longueur.',
    tiers: [
      perf('Nager 200 m sans pause', 200, 'm'),
      perf('Nager 500 m sans pause', 500, 'm'),
      perf('Nager 1 km sans pause', 1000, 'm'),
    ],
    actions: [
      // Une séance de piscine est un total de longueurs, pas une nage sans
      // pause : elle rapporte des PP et ne prétend à aucune distance.
      { title: 'Séance piscine', pp: 15 },
      qte('Ma plus longue nage', 10, 250, 'm'),
    ],
  },
  {
    id: 'velo',
    category: 'Sport',
    emoji: '🚲',
    title: 'Rouler 100 km à vélo',
    description: "D'une traite, dans la journée.",
    tiers: [
      perf("20 km d'une traite", 20, 'km'),
      perf("40 km d'une traite", 40, 'km'),
      perf("70 km d'une traite", 70, 'km'),
      perf("100 km d'une traite", 100, 'km'),
    ],
    actions: [
      qte('Sortie vélo', 15, 25, 'km'),
      qte('Trajet à vélo', 5, 8, 'km'),
    ],
  },

  // ================================================================= Santé
  {
    id: 'poids',
    category: 'Santé',
    emoji: '⚖️',
    title: 'Perdre du poids',
    description: 'Ajuste les kilos de chaque étape à ton objectif — le principe reste le même.',
    tiers: [
      mesure('Perdre 2 kg', -2, 'kg'),
      mesure('Perdre 5 kg', -5, 'kg'),
      mesure('Perdre 8 kg', -8, 'kg'),
      mesure('Perdre 12 kg', -12, 'kg'),
    ],
    actions: [
      { title: 'Journée sans écart', pp: 15 },
      { title: 'Repas équilibré', pp: 5 },
      releve('Pesée', 'kg'),
    ],
  },
  {
    id: 'legumes',
    habit: true,
    category: 'Santé',
    emoji: '🥗',
    title: 'Manger 5 fruits et légumes par jour',
    description: 'La recommandation, appliquée pour de bon.',
    tiers: [compte('7 jours', 7), compte('30 jours', 30), compte('90 jours', 90)],
    actions: [
      { title: '5 portions atteintes', pp: 15 },
      { title: 'Un fruit de plus', pp: 5 },
    ],
  },
  {
    id: 'eau',
    habit: true,
    category: 'Santé',
    emoji: '💧',
    title: 'Boire 1,5 L d’eau par jour',
    description: 'Le changement le plus bête et le plus efficace.',
    tiers: [compte('7 jours', 7), compte('30 jours', 30), compte('90 jours', 90)],
    actions: [
      { title: '1,5 L atteint', pp: 10 },
      { title: 'Un grand verre de plus', pp: 5 },
    ],
  },
  {
    id: 'sommeil',
    habit: true,
    category: 'Santé',
    emoji: '😴',
    title: 'Dormir 7 h par nuit',
    description: 'Des horaires réguliers, mesurés nuit après nuit.',
    tiers: [
      compte('7 nuits à 7 h', 7, 'nuits'),
      compte('30 nuits à 7 h', 30, 'nuits'),
      compte('90 nuits à 7 h', 90, 'nuits'),
    ],
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
      compte('5 repas cuisinés', 5, 'repas'),
      compte('20 repas cuisinés', 20, 'repas'),
      compte('30 jours sans plat préparé', 30),
      { title: '15 recettes maîtrisées sans recette écrite' },
    ],
    actions: [
      { title: 'Repas cuisiné', pp: 10 },
      { title: 'Courses de la semaine', pp: 10 },
    ],
  },

  // =============================================================== Arrêter
  {
    id: 'tabac',
    habit: true,
    category: 'Arrêter',
    emoji: '🚭',
    title: 'Arrêter de fumer',
    description: 'Un jour sans, puis un autre.',
    // Le seul domaine où la consécutivité EST ce qu'on mesure : reprendre
    // une cigarette remet vraiment le compteur à zéro, et prétendre le
    // contraire serait malhonnête. Le record atteint, lui, reste affiché.
    tiers: [
      serie('1 jour sans fumer', 1),
      serie('7 jours sans fumer', 7),
      serie('30 jours sans fumer', 30),
      serie('90 jours sans fumer', 90),
      serie('365 jours sans fumer', 365),
    ],
    actions: [
      { title: 'Journée sans fumer', pp: 15 },
      { title: 'Une envie surmontée', pp: 5 },
    ],
  },
  {
    id: 'alcool',
    habit: true,
    category: 'Arrêter',
    emoji: '🥤',
    title: 'Boire moins d’alcool',
    description: 'Des jours sans, comptés.',
    tiers: [
      serie('7 jours sans alcool', 7),
      serie('30 jours sans alcool', 30),
      serie('90 jours sans alcool', 90),
      serie('180 jours sans alcool', 180),
    ],
    actions: [
      { title: 'Journée sans alcool', pp: 15 },
      { title: 'Soirée sans boire', pp: 20 },
    ],
  },
  {
    id: 'ongles',
    habit: true,
    category: 'Arrêter',
    emoji: '💅',
    title: 'Arrêter de me ronger les ongles',
    description: 'Un jour à la fois. Rater une fois n’efface rien.',
    tiers: habitude(),
    actions: [{ title: 'Journée sans me ronger les ongles', pp: 10 }],
  },
  {
    id: 'doigts',
    habit: true,
    category: 'Arrêter',
    emoji: '🤞',
    title: 'Arrêter de me craquer les doigts',
    description: 'Le genre de geste qu’on fait sans y penser — donc qu’on suit pour y penser.',
    tiers: habitude(),
    actions: [{ title: 'Journée sans me craquer les doigts', pp: 10 }],
  },
  {
    id: 'ecrans-soir',
    habit: true,
    category: 'Arrêter',
    emoji: '🌙',
    title: 'Pas d’écran avant de dormir',
    description: 'Le téléphone hors de la chambre, une heure avant le coucher.',
    tiers: habitude(),
    actions: [{ title: 'Soirée sans écran avant de dormir', pp: 10 }],
  },
  {
    id: 'ecrans',
    habit: true,
    category: 'Arrêter',
    emoji: '📵',
    title: 'Réduire mon temps d’écran',
    description: 'Chiffres relevés par ton téléphone — rien de subjectif.',
    tiers: [
      compte("7 jours sous 3 h d'écran", 7),
      compte("30 jours sous 3 h d'écran", 30),
      compte("30 jours sous 2 h d'écran", 30),
      compte("90 jours sous 2 h d'écran", 90),
    ],
    actions: [
      { title: 'Journée sous la limite', pp: 15 },
      { title: 'Soirée sans téléphone', pp: 20 },
    ],
  },
  {
    id: 'reseaux-matin',
    habit: true,
    category: 'Arrêter',
    emoji: '📱',
    title: 'Plus de réseaux sociaux le matin',
    description: 'Rien avant midi.',
    tiers: [
      compte('7 jours sans réseaux avant midi', 7),
      compte('30 jours sans réseaux avant midi', 30),
      compte('90 jours sans réseaux avant midi', 90),
    ],
    actions: [
      { title: 'Matinée sans réseaux', pp: 15 },
      { title: 'Téléphone hors de la chambre', pp: 10 },
    ],
  },
  {
    id: 'sucre',
    habit: true,
    category: 'Arrêter',
    emoji: '🍫',
    title: 'Arrêter de grignoter',
    description: 'Rien entre les repas.',
    tiers: [
      compte('7 jours sans grignotage', 7),
      compte('30 jours sans grignotage', 30),
      compte('90 jours sans grignotage', 90),
    ],
    actions: [
      { title: 'Journée sans grignotage', pp: 15 },
      { title: 'Une envie remplacée par un fruit', pp: 5 },
    ],
  },

  // ================================================================ Esprit
  {
    id: 'meditation',
    habit: true,
    category: 'Esprit',
    emoji: '🧘',
    title: 'Méditer tous les jours',
    description: 'Des séances comptées, pas une ambiance.',
    tiers: [
      compte('7 séances', 7, 'séances'),
      compte('30 séances', 30, 'séances'),
      compte('100 séances', 100, 'séances'),
      compte('365 séances', 365, 'séances'),
    ],
    actions: [
      { title: 'Séance de 10 min', pp: 15 },
      { title: 'Séance de 2 min', pp: 5 },
    ],
  },
  {
    id: 'journal',
    habit: true,
    category: 'Esprit',
    emoji: '📓',
    title: 'Tenir un journal',
    description: 'Quelques lignes par jour, pour y voir clair.',
    tiers: [
      compte('7 jours d’écriture', 7),
      compte('30 jours d’écriture', 30),
      { title: 'Un carnet entier rempli' },
      compte('365 jours d’écriture', 365),
    ],
    actions: [
      { title: 'Page du jour', pp: 15 },
      { title: 'Trois lignes', pp: 5 },
    ],
  },
  {
    id: 'gratitude',
    habit: true,
    category: 'Esprit',
    emoji: '🙏',
    title: 'Noter 3 gratitudes par jour',
    description: 'Trois lignes, chaque soir.',
    tiers: [compte('7 jours', 7), compte('30 jours', 30), compte('100 jours', 100)],
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
      cumul('Épargner 500 €', 500, '€'),
      cumul('Épargner 2 000 €', 2000, '€'),
      cumul('Épargner 5 000 €', 5000, '€'),
      // Dépend de tes dépenses : personne d'autre que toi ne sait quand
      // c'est atteint.
      { title: '3 mois de dépenses de côté' },
    ],
    actions: [
      qte('Virement vers l’épargne', 20, 100, '€'),
      // Une dépense évitée est une bonne habitude, pas de l'argent sur le
      // compte : elle rapporte des PP et ne gonfle pas le palier.
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
      compte('7 jours de dépenses notées', 7),
      compte('30 jours de dépenses notées', 30),
      { title: '3 mois sans découvert' },
      { title: '6 mois sans découvert' },
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
      cumul('Rembourser 500 €', 500, '€'),
      cumul('Rembourser 2 000 €', 2000, '€'),
      cumul('Rembourser 5 000 €', 5000, '€'),
      { title: 'Solde intégralement remboursé' },
    ],
    actions: [
      qte('Remboursement effectué', 20, 100, '€'),
      { title: 'Dépense évitée', pp: 5 },
    ],
  },
  {
    id: 'investir',
    category: 'Argent',
    emoji: '📈',
    title: 'Investir chaque mois',
    description: 'Un versement par mois, sans exception.',
    tiers: [
      compte('1er versement effectué', 1, 'versements'),
      compte('6 versements', 6, 'versements'),
      compte('12 versements', 12, 'versements'),
      compte('24 versements', 24, 'versements'),
    ],
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
    // Un livre fini n'est pas une action quotidienne : on coche à la main,
    // pendant que « Lire 20 pages » nourrit le streak au jour le jour.
    tiers: [
      { title: '1 livre terminé' },
      { title: '3 livres terminés' },
      { title: '6 livres terminés' },
      { title: '12 livres terminés' },
    ],
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
      compte('30 jours de pratique', 30),
      compte('100 jours de pratique', 100),
      { title: 'Tenir 10 min de conversation' },
      { title: 'Lire un livre entier dans la langue' },
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
      { title: 'Jouer 1 morceau court en entier' },
      { title: 'Jouer 3 morceaux en entier' },
      { title: 'Jouer 30 min sans partition' },
      { title: 'Jouer devant du public' },
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
      { title: 'Terminer un premier cours complet' },
      { title: '3 projets terminés' },
      { title: 'Un projet publié en ligne' },
      { title: 'Une contribution acceptée sur un projet open source' },
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
      cumul('5 000 mots écrits', 5000, 'mots'),
      cumul('20 000 mots écrits', 20000, 'mots'),
      cumul('50 000 mots écrits', 50000, 'mots'),
      { title: 'Manuscrit terminé' },
    ],
    actions: [
      qte('Session d’écriture', 20, 500, 'mots'),
      qte('200 mots', 10, 200, 'mots'),
    ],
  },
  {
    id: 'photo',
    category: 'Créer',
    emoji: '📷',
    title: 'Publier mes photos',
    description: 'Des photos sorties du téléphone.',
    tiers: [
      compte('5 photos publiées', 5, 'photos'),
      compte('20 photos publiées', 20, 'photos'),
      compte('50 photos publiées', 50, 'photos'),
    ],
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
      { title: 'Cahier des charges écrit' },
      { title: 'Première version fonctionnelle' },
      { title: 'Projet mis en ligne' },
      { title: '10 utilisateurs' },
      { title: '100 utilisateurs' },
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
      { title: '1 pièce entièrement triée' },
      { title: '3 pièces entièrement triées' },
      { title: 'Tout le logement trié' },
      cumul('100 objets donnés ou vendus', 100, 'objets'),
    ],
    actions: [
      // Une session de tri ne se compte pas en objets : seule la seconde
      // action alimente le palier « 100 objets ».
      { title: 'Session de tri', pp: 15 },
      qte('5 objets sortis', 5, 5, 'objets'),
    ],
  },
  {
    id: 'ranger',
    habit: true,
    category: 'Vie',
    emoji: '🧹',
    title: 'Ranger tous les jours',
    description: '15 minutes par jour, comptées.',
    tiers: [compte('7 jours', 7), compte('30 jours', 30), compte('90 jours', 90)],
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
      compte('4 rendez-vous', 4, 'rendez-vous'),
      compte('12 rendez-vous', 12, 'rendez-vous'),
      compte('30 rendez-vous', 30, 'rendez-vous'),
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
    tiers: [
      compte('4 appels', 4, 'appels'),
      compte('12 appels', 12, 'appels'),
      compte('26 appels', 26, 'appels'),
      compte('52 appels', 52, 'appels'),
    ],
    actions: [{ title: 'Appel passé', pp: 15 }],
  },
  {
    id: 'job',
    category: 'Vie',
    emoji: '💼',
    title: 'Trouver un nouveau travail',
    description: 'Des candidatures et des entretiens, comptés.',
    tiers: [
      { title: 'CV et profil à jour' },
      compte('10 candidatures envoyées', 10, 'candidatures'),
      compte('30 candidatures envoyées', 30, 'candidatures'),
      { title: '5 entretiens passés' },
      { title: 'Offre signée' },
    ],
    actions: [
      { title: 'Candidature envoyée', pp: 15 },
      { title: '30 min de recherche', pp: 5 },
    ],
  },
];
