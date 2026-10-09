/**
 * Les noms de l'archive des photos — bibliothèque pure (étape 6) : un dossier
 * par haut fait, nommé par sa date (aussi précise qu'on la connaît) et son
 * titre, pour que l'archive se range d'elle-même dans l'ordre de la vie.
 */
import { formatFeatDate } from './dates';
import type { Feat } from './types';

export function archiveName(feat: Feat): string {
  const date = feat.datePrecision === 'year' ? feat.dateStart.slice(0, 4) : feat.datePrecision === 'month' ? feat.dateStart.slice(0, 7) : feat.dateStart;
  // Les caractères qu'un système de fichiers refuse deviennent des espaces.
  const title = feat.title.replace(/[\\/:*?"<>|\p{Cc}]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
  return `${date} ${title || formatFeatDate(feat.dateStart, feat.datePrecision)}`.trim();
}

/** Un dossier par haut fait ; deux hauts faits au même nom le même jour : « (2) », « (3) »… */
export function archiveFolders(feats: readonly Feat[]): Map<string, string> {
  const folders = new Map<string, string>();
  const taken = new Set<string>();
  for (const feat of feats) {
    const base = archiveName(feat);
    let name = base;
    for (let n = 2; taken.has(name); n++) name = `${base} (${n})`;
    taken.add(name);
    folders.set(feat.id, name);
  }
  return folders;
}

