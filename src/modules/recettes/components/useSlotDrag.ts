import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

/**
 * Glisser un repas sur une autre case du menu ou de la semaine type
 * (docs/etude-recettes.md §22), aux événements de pointeur — souris, doigt et
 * stylet par le même chemin, sans bibliothèque, sur le motif de Tier lists :
 *
 *  · à la souris, le repas part après 5 px ; un simple clic ouvre la recette ;
 *  · au doigt, il faut le tenir un instant (280 ms) : glisser tout de suite
 *    fait défiler la page, comme partout ailleurs dans Atlas ;
 *  · la case visée est celle sous le pointeur (`[data-meal-slot]`) ;
 *  · près du haut ou du bas de l'écran, la page défile toute seule.
 *
 * Le geste échange deux cases entières (`swapSlots`) : il suffit de savoir
 * d'où l'on part et où l'on lâche.
 */

export interface SlotDrag {
  /** La case de départ (`data-meal-slot`). */
  from: string;
  /** Ce qu'on montre sous le doigt. */
  label: string;
  x: number;
  y: number;
  /** La case survolée, s'il y en a une autre que celle de départ. */
  over: string | null;
}

const HOLD_MS = 280;
const MOUSE_SLOP = 5;
const TOUCH_SLOP = 8;
const EDGE = 72;

function slotAt(x: number, y: number): string | null {
  return document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-meal-slot]')?.dataset.mealSlot ?? null;
}

export function useSlotDrag(onDrop: (from: string, to: string) => void) {
  const [drag, setDrag] = useState<SlotDrag | null>(null);
  const dragRef = useRef<SlotDrag | null>(null);
  /** Le clic qui suit un glisser n'ouvre pas la recette. */
  const justDragged = useRef(false);
  const cleanupRef = useRef<(() => void) | null>(null);
  const onDropRef = useRef(onDrop);
  useEffect(() => {
    onDropRef.current = onDrop;
  }, [onDrop]);

  useEffect(() => () => cleanupRef.current?.(), []);

  const start = useCallback((e: ReactPointerEvent<HTMLElement>, from: string, label: string) => {
    if (e.button !== 0 || dragRef.current) return;
    const origin = { x: e.clientX, y: e.clientY };
    const touch = e.pointerType !== 'mouse';
    let last = { ...origin };
    let started = false;
    let hold: number | undefined;
    let scroller: number | undefined;

    const update = () => {
      if (!dragRef.current) return;
      const over = slotAt(last.x, last.y);
      const next = { ...dragRef.current, x: last.x, y: last.y, over: over && over !== from ? over : null };
      dragRef.current = next;
      setDrag(next);
    };

    const begin = () => {
      started = true;
      justDragged.current = true;
      dragRef.current = { from, label, x: last.x, y: last.y, over: null };
      update();
      if (touch) navigator.vibrate?.(8);
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
      if (drop && state?.over) onDropRef.current(state.from, state.over);
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
    // Une fois le repas pris, le doigt ne fait plus défiler la page.
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
