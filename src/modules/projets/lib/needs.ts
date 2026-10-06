/**
 * Le questionnaire de besoins (docs/etude-projets.md §3.4) — bibliothèque pure.
 *
 * Fixe et écrit dans le code (décision de Jules, 05/10/2026) : on l'enrichit
 * au fil des versions. Chaque question a une CLÉ STABLE — c'est elle qui
 * range la réponse dans le projet. Renommer une question est sans risque ;
 * changer sa clé ferait perdre de vue les réponses déjà données.
 */
import type { ProjectNeeds } from './types';

export interface NeedQuestion {
  key: string;
  label: string;
  /** `text` : une réponse libre ; `choices` : plusieurs cases à cocher. */
  kind: 'text' | 'choices';
  choices?: readonly string[];
  placeholder?: string;
}

export interface NeedSection {
  title: string;
  questions: readonly NeedQuestion[];
}

export const NEEDS_SECTIONS: readonly NeedSection[] = [
  {
    title: 'L’activité',
    questions: [
      { key: 'activity', label: 'Ce qu’il vend, à qui', kind: 'text', placeholder: 'Bouquets de saison, mariages et deuil ; clientèle du quartier' },
      { key: 'difference', label: 'Ce qui le distingue', kind: 'text' },
      { key: 'competitors', label: 'Des concurrents ou des sites qu’il aime', kind: 'text' },
    ],
  },
  {
    title: 'Le but du site',
    questions: [
      {
        key: 'goals',
        label: 'À quoi doit servir le site',
        kind: 'choices',
        choices: ['Être trouvé sur Google', 'Montrer la carte ou les tarifs', 'Montrer ses réalisations', 'Prendre des réservations', 'Prendre des commandes', 'Rassurer avant une visite'],
      },
    ],
  },
  {
    title: 'Les pages',
    questions: [
      {
        key: 'pages',
        label: 'Les pages voulues',
        kind: 'choices',
        choices: ['Accueil', 'Présentation', 'Carte, prestations ou tarifs', 'Galerie', 'Horaires et accès', 'Contact', 'Emplacements (food truck)', 'Blog ou actualités', 'Mentions légales'],
      },
      { key: 'pages_more', label: 'D’autres pages', kind: 'text' },
    ],
  },
  {
    title: 'Les fonctions',
    questions: [
      {
        key: 'features',
        label: 'Ce que le site doit savoir faire',
        kind: 'choices',
        choices: ['Formulaire de contact', 'Réservation en ligne', 'Commande en ligne', 'Carte Google', 'Lien vers Instagram', 'Avis Google', 'Newsletter'],
      },
      { key: 'booking_tool', label: 'Un outil de réservation ou de caisse déjà utilisé', kind: 'text', placeholder: 'Planity, Zenchef, SumUp…' },
    ],
  },
  {
    title: 'Les contenus',
    questions: [
      { key: 'texts', label: 'Qui écrit les textes, et pour quand', kind: 'text' },
      { key: 'photos', label: 'Qui fournit les photos, et pour quand', kind: 'text' },
    ],
  },
  {
    title: 'L’identité',
    questions: [
      { key: 'logo', label: 'Un logo existe-t-il ?', kind: 'text', placeholder: 'Oui, en SVG / non, à créer / seulement une photo' },
      { key: 'colors', label: 'Couleurs et ambiance souhaitées', kind: 'text' },
      { key: 'inspirations', label: 'Des sites qu’il aime', kind: 'text' },
    ],
  },
  {
    title: 'Le technique',
    questions: [
      { key: 'domain', label: 'Nom de domaine : en a-t-il un, chez qui ?', kind: 'text' },
      { key: 'hosting', label: 'Hébergement actuel', kind: 'text' },
      { key: 'email', label: 'Adresse e-mail professionnelle', kind: 'text' },
      { key: 'maintainer', label: 'Qui modifiera le site ensuite', kind: 'text' },
    ],
  },
  {
    title: 'Le cadre',
    questions: [
      { key: 'budget', label: 'Budget', kind: 'text' },
      { key: 'deadline', label: 'Date souhaitée, et pourquoi', kind: 'text', placeholder: 'Avant la Toussaint, forte période' },
      { key: 'constraints', label: 'Contraintes', kind: 'text' },
    ],
  },
];

export const NEED_QUESTIONS: readonly NeedQuestion[] = NEEDS_SECTIONS.flatMap((s) => s.questions);

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Le questionnaire tel qu'on peut s'y fier, quoi que contienne la base : une
 * ligne écrite à la main ou par une version future ne doit pas casser l'écran.
 */
export function normalizeNeeds(raw: unknown): Required<ProjectNeeds> {
  const value = isObject(raw) ? raw : {};
  const answers: Record<string, string | string[]> = {};
  if (isObject(value.answers)) {
    for (const [k, v] of Object.entries(value.answers)) {
      if (typeof v === 'string') answers[k] = v;
      else if (Array.isArray(v)) answers[k] = v.filter((x): x is string => typeof x === 'string');
    }
  }
  const ask = Array.isArray(value.ask) ? [...new Set(value.ask.filter((x): x is string => typeof x === 'string'))] : [];
  return { answers, ask };
}

export function isAnswered(value: string | string[] | undefined): boolean {
  if (value === undefined) return false;
  return Array.isArray(value) ? value.length > 0 : value.trim() !== '';
}

/** Combien de questions du questionnaire actuel ont une réponse. */
export function needsProgress(needs: ProjectNeeds): { answered: number; total: number } {
  const { answers } = normalizeNeeds(needs);
  return { answered: NEED_QUESTIONS.filter((q) => isAnswered(answers[q.key])).length, total: NEED_QUESTIONS.length };
}

/** Une réponse posée ; vide, elle disparaît (pour qu'une question effacée ne compte plus). */
export function setAnswer(needs: ProjectNeeds, key: string, value: string | string[]): Required<ProjectNeeds> {
  const n = normalizeNeeds(needs);
  const answers = { ...n.answers };
  if (isAnswered(value)) answers[key] = value;
  else delete answers[key];
  return { ...n, answers };
}

/** Coche ou décoche un choix d'une question à choix multiples, dans l'ordre du questionnaire. */
export function toggleChoice(needs: ProjectNeeds, question: NeedQuestion, choice: string): Required<ProjectNeeds> {
  const current = normalizeNeeds(needs).answers[question.key];
  const list = Array.isArray(current) ? current : [];
  const next = list.includes(choice) ? list.filter((c) => c !== choice) : [...list, choice];
  const order = question.choices ?? [];
  next.sort((a, b) => (order.indexOf(a) + 1 || order.length + 1) - (order.indexOf(b) + 1 || order.length + 1));
  return setAnswer(needs, question.key, next);
}

/** Marque ou démarque une question « à demander au client ». */
export function toggleAsk(needs: ProjectNeeds, key: string): Required<ProjectNeeds> {
  const n = normalizeNeeds(needs);
  return { ...n, ask: n.ask.includes(key) ? n.ask.filter((k) => k !== key) : [...n.ask, key] };
}

/**
 * Les questions à demander au client, dans l'ordre du questionnaire. Une
 * question qui a reçu sa réponse depuis n'est plus à demander, même si la
 * marque est restée.
 */
export function askedQuestions(needs: ProjectNeeds): NeedQuestion[] {
  const { answers, ask } = normalizeNeeds(needs);
  return NEED_QUESTIONS.filter((q) => ask.includes(q.key) && !isAnswered(answers[q.key]));
}

/** Deux états du questionnaire disent-ils la même chose ? (pour « modifications non enregistrées ») */
export function sameNeeds(a: ProjectNeeds, b: ProjectNeeds): boolean {
  const x = normalizeNeeds(a);
  const y = normalizeNeeds(b);
  const keys = new Set([...Object.keys(x.answers), ...Object.keys(y.answers)]);
  for (const k of keys) if (JSON.stringify(x.answers[k]) !== JSON.stringify(y.answers[k])) return false;
  return [...x.ask].sort().join() === [...y.ask].sort().join();
}
