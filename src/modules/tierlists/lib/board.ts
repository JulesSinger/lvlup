import type { ItemMove, Tier, TierColor, TierItem } from './types';

/**
 * Les règles du plateau, pures et testées : les rangées par défaut, l'ordre
 * des éléments, ce que change un glisser-déposer, où tombe un élément lâché.
 */

/** Les rangées d'une nouvelle tier list : S à D, du rouge au bleu. */
export const DEFAULT_TIERS: readonly { label: string; color: TierColor }[] = [
  { label: 'S', color: 'red' },
  { label: 'A', color: 'orange' },
  { label: 'B', color: 'yellow' },
  { label: 'C', color: 'green' },
  { label: 'D', color: 'blue' },
];

/** Couleur proposée pour une rangée ajoutée : la suivante de l'arc-en-ciel après la dernière. */
const NEXT_COLORS: TierColor[] = ['red', 'orange', 'yellow', 'green', 'blue', 'violet', 'pink', 'gray'];
export function nextTierColor(tiers: Tier[]): TierColor {
  const last = sortTiers(tiers).at(-1)?.color;
  const at = last ? NEXT_COLORS.indexOf(last) : -1;
  return NEXT_COLORS[(at + 1) % NEXT_COLORS.length];
}

export const sortTiers = (tiers: Tier[]): Tier[] => tiers.slice().sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));

const byPlace = (a: TierItem, b: TierItem) => a.position - b.position || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

/** Les éléments d'une rangée (ou de la réserve, `null`), dans l'ordre. */
export function itemsIn(items: TierItem[], tierId: string | null): TierItem[] {
  return items.filter((i) => i.tierId === tierId).sort(byPlace);
}

/**
 * Une rangée qui n'existe plus (supprimée ailleurs) : ses éléments sont lus
 * comme étant dans la réserve, plutôt que de disparaître de l'écran.
 */
export function placeOrphans(items: TierItem[], tiers: Tier[]): TierItem[] {
  const known = new Set(tiers.map((t) => t.id));
  return items.map((i) => (i.tierId !== null && !known.has(i.tierId) ? { ...i, tierId: null } : i));
}

/** Après la dernière : la place d'un élément ajouté au bout d'une rangée. */
export function endPosition(items: TierItem[], tierId: string | null): number {
  const inTier = items.filter((i) => i.tierId === tierId);
  return inTier.length === 0 ? 0 : Math.max(...inTier.map((i) => i.position)) + 1;
}

/**
 * Déplacer `itemId` dans `toTier`, à la place `toIndex` (comptée sans lui).
 * Rend les seuls éléments dont la rangée ou la place change : la rangée
 * d'arrivée est renumérotée 0, 1, 2… ; celle de départ garde ses trous, qui
 * ne gênent pas l'ordre.
 */
export function movePlan(items: TierItem[], itemId: string, toTier: string | null, toIndex: number): ItemMove[] {
  const moving = items.find((i) => i.id === itemId);
  if (!moving) return [];
  const target = itemsIn(items, toTier).filter((i) => i.id !== itemId);
  const index = Math.max(0, Math.min(Math.round(toIndex), target.length));
  target.splice(index, 0, moving);
  const moves: ItemMove[] = [];
  target.forEach((item, position) => {
    if (item.tierId !== toTier || item.position !== position) moves.push({ id: item.id, tierId: toTier, position });
  });
  return moves;
}

/** Applique des déplacements à la liste en mémoire (l'écran change avant la réponse du serveur). */
export function applyMoves(items: TierItem[], moves: ItemMove[]): TierItem[] {
  const byId = new Map(moves.map((m) => [m.id, m]));
  return items.map((i) => {
    const m = byId.get(i.id);
    return m ? { ...i, tierId: m.tierId, position: m.position } : i;
  });
}

/** Tout remettre dans la réserve, dans l'ordre du classement (S d'abord). */
export function resetPlan(items: TierItem[], tiers: Tier[]): ItemMove[] {
  const order = [...sortTiers(tiers).flatMap((t) => itemsIn(items, t.id)), ...itemsIn(items, null)];
  return order.map((item, position) => ({ id: item.id, tierId: null, position })).filter((m, k) => {
    const item = order[k];
    return item.tierId !== null || item.position !== m.position;
  });
}

/** Les éléments d'une rangée qu'on supprime partent au bout de la réserve. */
export function evacuatePlan(items: TierItem[], tierId: string): ItemMove[] {
  const start = endPosition(items, null);
  return itemsIn(items, tierId).map((item, k) => ({ id: item.id, tierId: null, position: start + k }));
}

/** Monter (-1) ou descendre (+1) une rangée : les places de toutes, renumérotées. */
export function tierMovePlan(tiers: Tier[], tierId: string, direction: -1 | 1): { id: string; position: number }[] {
  const order = sortTiers(tiers);
  const from = order.findIndex((t) => t.id === tierId);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= order.length) return [];
  [order[from], order[to]] = [order[to], order[from]];
  return order.map((t, position) => ({ id: t.id, position })).filter((p, k) => order[k].position !== p.position);
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Où tombe un élément lâché au point (x, y) d'une rangée dont les tuiles
 * (sans celle qu'on porte) ont ces rectangles, dans l'ordre : avant la
 * première tuile dont on est au-dessus de la ligne, ou à gauche du milieu sur
 * la même ligne ; sinon au bout. Les tuiles passent à la ligne, d'où les deux cas.
 */
export function dropIndex(rects: Rect[], x: number, y: number): number {
  for (let k = 0; k < rects.length; k++) {
    const r = rects[k];
    if (y < r.top) return k;
    if (y < r.top + r.height && x < r.left + r.width / 2) return k;
  }
  return rects.length;
}

/**
 * Le nom proposé pour une image ajoutée : celui du fichier (« Ahri.png » →
 * « Ahri »), sauf un nom d'appareil photo ou de capture qui ne dit rien.
 */
export function labelFromFileName(name: string): string {
  const base = name.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_]+/g, ' ').trim();
  if (!base) return '';
  if (/^(img|dsc|dscn|pxl|photo|image|screenshot|capture|whatsapp|signal)[\s-]*[\d-]/i.test(base)) return '';
  if (/^[\d\s-]+$/.test(base) || /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(base)) return '';
  return base.slice(0, 120);
}
