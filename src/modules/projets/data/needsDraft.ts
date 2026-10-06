import type { ProjectNeeds } from '../lib/types';

/**
 * Le brouillon du questionnaire de besoins, sur cet appareil (§5) : le
 * rendez-vous a souvent lieu dans une boutique sans réseau, et une page
 * rechargée ne doit pas effacer ce qui a été noté. Effacé dès que le
 * questionnaire est enregistré.
 *
 * Clé `projets.needs-draft.v1:<projet>` — un identifiant, pas un libellé
 * (CLAUDE.md §4) : la renommer ferait perdre les brouillons en cours.
 */
const key = (projectId: string) => `projets.needs-draft.v1:${projectId}`;

export function readNeedsDraft(projectId: string): ProjectNeeds | null {
  try {
    const raw = localStorage.getItem(key(projectId));
    return raw ? (JSON.parse(raw) as ProjectNeeds) : null;
  } catch {
    return null;
  }
}

export function writeNeedsDraft(projectId: string, needs: ProjectNeeds) {
  try {
    localStorage.setItem(key(projectId), JSON.stringify(needs));
  } catch {
    // Stockage plein ou refusé : le formulaire garde la saisie tant qu'il est ouvert.
  }
}

export function clearNeedsDraft(projectId: string) {
  try {
    localStorage.removeItem(key(projectId));
  } catch {
    // Rien à faire : au pire, un brouillon identique au questionnaire enregistré.
  }
}
