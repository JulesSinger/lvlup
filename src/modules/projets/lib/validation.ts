/**
 * Validation — bibliothèque pure. Les règles de la base (migration du
 * 05/10/2026) dites en français, avant l'envoi, pour qu'un refus de
 * Postgres ne soit jamais la première nouvelle.
 */
import {
  CLIENT_NAME_MAX,
  CLIENT_TRADES,
  NOTE_TEXT_MAX,
  PROJECT_STATUSES,
  PROJECT_TITLE_MAX,
  TASK_TITLE_MAX,
  WORKSTREAM_TITLE_MAX,
  type ClientInput,
  type ProjectInput,
  type ProjectTaskInput,
} from './types';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Un message pour la première règle enfreinte, ou `null`. */
export function validateClient(input: ClientInput): string | null {
  const name = input.name.trim();
  if (!name) return 'Donne un nom au client.';
  if (name.length > CLIENT_NAME_MAX) return `Le nom est trop long (${CLIENT_NAME_MAX} caractères au plus).`;
  if (!CLIENT_TRADES.includes(input.trade)) return 'Métier inconnu.';
  const email = input.email?.trim() ?? '';
  if (email && !/^[^\s@]+@[^\s@]+$/.test(email)) return 'Adresse e-mail invalide.';
  return null;
}

export function validateProject(input: ProjectInput): string | null {
  const title = input.title.trim();
  if (!title) return 'Donne un titre au projet.';
  if (title.length > PROJECT_TITLE_MAX) return `Le titre est trop long (${PROJECT_TITLE_MAX} caractères au plus).`;
  if (!input.clientId) return 'Choisis un client.';
  if (input.status !== undefined && !PROJECT_STATUSES.includes(input.status)) return 'Statut inconnu.';
  if (input.startDay && !DAY.test(input.startDay)) return 'Date de début invalide.';
  if (input.dueDay && !DAY.test(input.dueDay)) return 'Échéance invalide.';
  if (input.startDay && input.dueDay && input.dueDay < input.startDay) return 'L’échéance tombe avant le début.';
  if (input.priceCents !== undefined && input.priceCents !== null) {
    if (!Number.isInteger(input.priceCents) || input.priceCents < 0) return 'Le prix doit être un montant positif.';
  }
  return null;
}

/** Ce qu'on attend du client : un texte court, ou rien. */
export function validateWaiting(what: string | null): string | null {
  if (what === null) return null;
  if (!what.trim()) return 'Dis ce que tu attends du client.';
  if (what.trim().length > 200) return 'Trop long (200 caractères au plus).';
  return null;
}

export function validateWorkstreamTitle(title: string): string | null {
  if (!title.trim()) return 'Donne un nom au chantier.';
  if (title.trim().length > WORKSTREAM_TITLE_MAX) return `Le nom est trop long (${WORKSTREAM_TITLE_MAX} caractères au plus).`;
  return null;
}

export function validateTask(input: ProjectTaskInput): string | null {
  const title = input.title.trim();
  if (!title) return 'Donne un titre à la tâche.';
  if (title.length > TASK_TITLE_MAX) return `Le titre est trop long (${TASK_TITLE_MAX} caractères au plus).`;
  if (input.plannedDay && !DAY.test(input.plannedDay)) return 'Jour prévu invalide.';
  if (input.dueDay && !DAY.test(input.dueDay)) return 'Échéance invalide.';
  return null;
}

export function validateNote(text: string): string | null {
  if (!text.trim()) return 'La note est vide.';
  if (text.trim().length > NOTE_TEXT_MAX) return `La note est trop longue (${NOTE_TEXT_MAX} caractères au plus).`;
  return null;
}
