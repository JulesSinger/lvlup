import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { dropIndex } from '../lib/board';
import type { TierItem } from '../lib/types';

/**
 * Le glisser-déposer des tuiles, aux événements de pointeur — souris, doigt et
 * stylet par le même chemin, sans bibliothèque :
 *
 *  · à la souris, la tuile part après 5 px ; un simple clic l'ouvre ;
 *  · au doigt, il faut la tenir un instant (280 ms) : glisser tout de suite
 *    fait défiler la page, comme partout ailleurs ;
 *  · la zone visée est celle sous le doigt (`[data-tier-drop]`), la place
 *    dedans se calcule sur les tuiles déjà là (`dropIndex`) ;
 *  · près du haut ou du bas de l'écran, la page défile toute seule.
 */

export interface DropTarget {
  tierId: string | null;
  index: number;
  /** Le trait qui montre où l'élément tombera, en coordonnées de l'écran. */
  bar: { x: number; y: number; h: number };
}

export interface DragState {
  item: TierItem;
  x: number;
  y: number;
  /** Où on a pris la tuile, pour que le fantôme ne saute pas sous le doigt. */
  dx: number;
  dy: number;
  width: number;
  height: number;
  target: DropTarget | null;
}

const HOLD_MS = 280;
const MOUSE_SLOP = 5;
const TOUCH_SLOP = 8;
const EDGE = 72;

function locate(x: number, y: number, draggedId: string): DropTarget | null {
  const zone = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-tier-drop]');
  if (!zone) return null;
  const key = zone.dataset.tierDrop ?? 'reserve';
  const tiles = [...zone.querySelectorAll<HTMLElement>('[data-item-id]')].filter((t) => t.dataset.itemId !== draggedId);
  const rects = tiles.map((t) => t.getBoundingClientRect());
  const index = dropIndex(rects, x, y);
  let bar: DropTarget['bar'];
  if (rects.length === 0) {
    const box = (zone.querySelector<HTMLElement>('[data-tier-items]') ?? zone).getBoundingClientRect();
    bar = { x: box.left + 8, y: box.top + 8, h: Math.max(24, Math.min(64, box.height - 16)) };
  } else if (index < rects.length) {
    const r = rects[index];
    bar = { x: r.left - 4, y: r.top, h: r.height };
  } else {
    const r = rects[rects.length - 1];
    bar = { x: r.right + 2, y: r.top, h: r.height };
  }
  return { tierId: key === 'reserve' ? null : key, index, bar };
}

export function useDrag(onDrop: (item: TierItem, tierId: string | null, index: number) => void) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  /** Un clic qui suit un glisser n'ouvre pas la tuile. */
  const justDragged = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const onDropRef = useRef(onDrop);
  useEffect(() => {
    onDropRef.current = onDrop;
  }, [onDrop]);

  useEffect(() => () => cleanupRef.current?.(), []);

  const start = useCallback((e: ReactPointerEvent<HTMLElement>, item: TierItem) => {
    if (e.button !== 0 || dragRef.current) return;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const origin = { x: e.clientX, y: e.clientY };
    const touch = e.pointerType !== 'mouse';
    let last = { ...origin };
    let started = false;
    let hold: number | undefined;
    let scroller: number | undefined;

    const update = () => {
      const current = dragRef.current;
      if (!current) return;
      const next = { ...current, x: last.x, y: last.y, target: locate(last.x, last.y, item.id) };
      dragRef.current = next;
      setDrag(next);
    };

    const begin = () => {
      started = true;
      justDragged.current = true;
      const state: DragState = {
        item,
        x: last.x,
        y: last.y,
        dx: origin.x - rect.left,
        dy: origin.y - rect.top,
        width: rect.width,
        height: rect.height,
        target: null,
      };
      dragRef.current = state;
      update();
      if (touch) navigator.vibrate?.(8);
      // Défilement au bord, même immobile : un doigt tenu en bas d'écran fait descendre la page.
      scroller = window.setInterval(() => {
        const step = last.y < EDGE ? -14 : last.y > window.innerHeight - EDGE ? 14 : 0;
        if (step) {
          window.scrollBy(0, step);
          update();
        }
      }, 30);
    };

    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      last = { x: ev.clientX, y: ev.clientY };
      if (!started) {
        const distance = Math.hypot(last.x - origin.x, last.y - origin.y);
        if (touch) {
          // Le doigt a bougé avant la fin de l'appui : c'est un défilement.
          if (distance > TOUCH_SLOP) cleanup();
          return;
        }
        if (distance < MOUSE_SLOP) return;
        begin();
        return;
      }
      update();
    };

    const finish = (drop: boolean) => {
      const state = dragRef.current;
      cleanup();
      if (drop && state?.target) onDropRef.current(state.item, state.target.tierId, state.target.index);
      // Le clic qui suit le relâcher arrive juste après : on l'ignore, puis on oublie.
      window.setTimeout(() => {
        justDragged.current = false;
      }, 0);
    };

    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== e.pointerId) return;
      if (started) finish(true);
      else cleanup();
    };
    const cancel = (ev: PointerEvent) => {
      if (ev.pointerId === e.pointerId) finish(false);
    };
    // Une fois la tuile prise, le doigt ne fait plus défiler la page.
    const blockScroll = (ev: TouchEvent) => {
      if (started && ev.cancelable) ev.preventDefault();
    };
    const escape = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') finish(false);
    };

    function cleanup() {
      window.clearTimeout(hold);
      window.clearInterval(scroller);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('touchmove', blockScroll);
      window.removeEventListener('keydown', escape);
      cleanupRef.current = null;
      dragRef.current = null;
      setDrag(null);
    }

    cleanupRef.current?.();
    cleanupRef.current = cleanup;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('touchmove', blockScroll, { passive: false });
    window.addEventListener('keydown', escape);
    if (touch) hold = window.setTimeout(begin, HOLD_MS);
  }, []);

  return { drag, start, justDragged };
}
