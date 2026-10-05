/**
 * Les statuts et les métiers, dits en français — et les groupes de statuts
 * dont les vues ont besoin (docs/etude-projets.md §3.2, §12).
 */
import type { ClientTrade, ProjectStatus } from './types';

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  lead: 'Piste',
  quoted: 'Devis envoyé',
  signed: 'Signé',
  production: 'En production',
  delivered: 'Livré',
  maintenance: 'Maintenance',
  done: 'Terminé',
  lost: 'Perdu',
};

export const TRADE_LABELS: Record<ClientTrade, string> = {
  foodtruck: 'Food truck',
  restaurant: 'Restaurant',
  coiffure: 'Coiffure',
  fleuriste: 'Fleuriste',
  boulangerie: 'Boulangerie',
  artisan: 'Artisan',
  commerce: 'Commerce',
  autre: 'Autre',
};

/** Archivés : hors du tableau de bord et du pipeline. */
export const CLOSED_STATUSES: readonly ProjectStatus[] = ['done', 'lost'];

/** Ceux sur lesquels on travaille : les cartes « Projets actifs » du tableau de bord. */
export const WORK_STATUSES: readonly ProjectStatus[] = ['signed', 'production'];

export const isClosed = (status: ProjectStatus) => CLOSED_STATUSES.includes(status);
export const isInWork = (status: ProjectStatus) => WORK_STATUSES.includes(status);
