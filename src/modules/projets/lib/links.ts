/**
 * Les liens et les accès (docs/etude-projets.md §3.6, §3.7) — bibliothèque pure.
 */
import { LINK_KINDS, LINK_LABEL_MAX, LINK_URL_MAX, type LinkKind, type ProjectLink, type ProjectLinkInput } from './types';

export const LINK_KIND_LABELS: Record<LinkKind, string> = {
  maquette: 'Maquette',
  dossier: 'Dossier partagé',
  preprod: 'Préproduction',
  site: 'Site en ligne',
  domaine: 'Nom de domaine',
  hebergement: 'Hébergement',
  backoffice: 'Back-office',
  compte: 'Autre compte',
  devis: 'Devis ou facture',
  autre: 'Autre',
};

export const LINK_KIND_ICONS: Record<LinkKind, string> = {
  maquette: '🎨',
  dossier: '📁',
  preprod: '🧪',
  site: '🌐',
  domaine: '🏷️',
  hebergement: '🖥️',
  backoffice: '🔧',
  compte: '👤',
  devis: '🧾',
  autre: '🔗',
};

/** Les sortes qui sont des accès : on y note l'identifiant. */
export const ACCESS_KINDS: readonly LinkKind[] = ['domaine', 'hebergement', 'backoffice', 'compte'];

/** Les liens d'un projet, rangés par sorte (dans l'ordre de `LINK_KINDS`) puis par position. */
export function sortLinks(links: readonly ProjectLink[]): ProjectLink[] {
  return [...links].sort((a, b) => LINK_KINDS.indexOf(a.kind) - LINK_KINDS.indexOf(b.kind) || a.position - b.position);
}

/**
 * Une adresse qu'on peut ouvrir : « fleursdelou.fr » devient
 * « https://fleursdelou.fr ». Seuls http(s) et mailto sont permis : un lien
 * `javascript:` glissé dans une sauvegarde ne doit rien exécuter au clic.
 */
export function safeHref(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^(https?:|mailto:)/i.test(trimmed)) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;
  return `https://${trimmed}`;
}

/** L'adresse dite sans son protocole, pour l'affichage. */
export function displayUrl(url: string): string {
  return url.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

/**
 * Le texte ressemble-t-il à un mot de passe noté ? « mdp : … »,
 * « mot de passe = … », « password: … ». Il faut les deux-points ou le
 * signe égal : « mot de passe dans Bitwarden » est exactement ce qu'on
 * veut lire. Pas une détection infaillible, un garde-fou contre le réflexe
 * (§3.7).
 */
export function looksLikePassword(text: string): boolean {
  return /\b(mdp|mot\s+de\s+passe|password|passwd|pwd)\s*[:=]\s*\S/i.test(text);
}

export function validateLink(input: Omit<ProjectLinkInput, 'projectId'>): string | null {
  if (!LINK_KINDS.includes(input.kind)) return 'Sorte de lien inconnue.';
  const label = input.label.trim();
  if (!label) return 'Donne un nom au lien.';
  if (label.length > LINK_LABEL_MAX) return `Le nom est trop long (${LINK_LABEL_MAX} caractères au plus).`;
  const url = input.url?.trim() ?? '';
  if (url.length > LINK_URL_MAX) return 'L’adresse est trop longue.';
  if (url && safeHref(url) === null) return 'Seules les adresses web (https://…) et mailto: sont acceptées.';
  for (const field of [input.label, input.login ?? '', input.note ?? '']) {
    if (looksLikePassword(field)) {
      return 'Pas de mot de passe ici : Atlas n’est pas un coffre-fort. Note plutôt où il est rangé (« dans Bitwarden »).';
    }
  }
  return null;
}
