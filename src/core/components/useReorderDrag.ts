import { useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent, type RefObject } from 'react';
import { dropIndex } from '../lib/moduleOrder';
import { moveItem } from '../lib/order';

/** Au-delà de cette distance, un appui de souris devient un glisser (et plus un clic). */
const MOUSE_THRESHOLD = 6;
/** Au doigt, un appui long démarre le glisser : un geste plus court reste un défilement ou un toucher. */
const TOUCH_HOLD_MS = 350;
/** Bouger le doigt de plus que ça avant la fin de l'appui long : c'est un défilement. */
const TOUCH_SLOP = 10;

interface Press {
  id: string;
  x: number;
  y: number;
  touch: boolean;
  timer: number | null;
}

/**
 * Réordonner des boutons en les glissant (les modules, 13/10/2026), sans
 * leur retirer leur clic : à la souris le glisser commence après quelques
 * pixels, au doigt après un appui long — un toucher simple ouvre toujours le
 * module, un geste rapide fait toujours défiler. Au clavier, Alt + flèches.
 *
 * Les éléments portent `data-reorder-id` dans `container` ; l'ordre affiché
 * pendant le glisser est `order`, et `onCommit` reçoit l'ordre final, une fois
 * le pointeur relâché, seulement s'il a changé.
 */
export function useReorderDrag(
  ids: readonly string[],
  container: RefObject<HTMLElement | null>,
  onCommit: (order: string[]) => void,
) {
  const [live, setLive] = useState<string[] | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const press = useRef<Press | null>(null);
  const order = useRef<string[]>([]);
  /** Un glisser vient de finir : le clic qui suit ne doit pas ouvrir le module. */
  const swallowClick = useRef(false);
  const commit = useRef(onCommit);
  commit.current = onCommit;
  /** Le glisser en cours, lu par les écouteurs sans attendre un nouveau rendu. */
  const draggingRef = useRef<string | null>(null);

  function start(id: string) {
    draggingRef.current = id;
    order.current = [...ids];
    setLive(order.current);
    setDraggingId(id);
  }

  useEffect(() => {
    const move = (e: globalThis.PointerEvent) => {
      const p = press.current;
      if (!p) return;
      if (!draggingRef.current) {
        const distance = Math.hypot(e.clientX - p.x, e.clientY - p.y);
        if (p.touch) {
          // Le doigt a bougé avant l'appui long : c'est un défilement, on lâche.
          if (distance > TOUCH_SLOP) cancel();
          return;
        }
        if (distance < MOUSE_THRESHOLD) return;
        start(p.id);
      }
      const root = container.current;
      if (!root) return;
      const others = [...root.querySelectorAll<HTMLElement>('[data-reorder-id]')].filter((el) => el.dataset.reorderId !== p.id);
      const to = dropIndex(
        others.map((el) => el.getBoundingClientRect()),
        e.clientX,
        e.clientY,
      );
      const from = order.current.indexOf(p.id);
      if (from < 0 || to === from) return;
      order.current = moveItem(order.current, from, to);
      setLive(order.current);
    };
    const up = () => {
      const p = press.current;
      if (!p) return;
      const dragged = draggingRef.current;
      cancel();
      if (!dragged) return;
      swallowClick.current = true;
      const final = order.current;
      if (final.some((id, i) => id !== ids[i])) commit.current(final);
    };
    // Pendant un glisser au doigt, la page ne doit pas défiler sous le doigt.
    const touchMove = (e: TouchEvent) => {
      if (draggingRef.current) e.preventDefault();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('touchmove', touchMove, { passive: false });
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('touchmove', touchMove);
    };
  });

  function cancel() {
    const p = press.current;
    if (p?.timer) window.clearTimeout(p.timer);
    press.current = null;
    draggingRef.current = null;
    setDraggingId(null);
    setLive(null);
  }

  /** Ce qu'il faut poser sur chaque bouton qu'on peut glisser. */
  function itemProps(id: string) {
    return {
      'data-reorder-id': id,
      onPointerDown: (e: PointerEvent<HTMLElement>) => {
        if (e.button !== 0) return;
        swallowClick.current = false;
        const touch = e.pointerType === 'touch';
        const p: Press = { id, x: e.clientX, y: e.clientY, touch, timer: null };
        if (touch) {
          p.timer = window.setTimeout(() => {
            if (press.current !== p) return;
            start(id);
            navigator.vibrate?.(10);
          }, TOUCH_HOLD_MS);
        }
        press.current = p;
      },
      onClickCapture: (e: MouseEvent<HTMLElement>) => {
        if (!swallowClick.current) return;
        swallowClick.current = false;
        e.preventDefault();
        e.stopPropagation();
      },
      // L'appui long ouvrirait le menu du navigateur sur téléphone.
      onContextMenu: (e: MouseEvent<HTMLElement>) => {
        if (press.current?.touch) e.preventDefault();
      },
      onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
        if (!e.altKey) return;
        const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key];
        if (!step) return;
        e.preventDefault();
        const from = ids.indexOf(id);
        const to = from + step;
        if (from < 0 || to < 0 || to >= ids.length) return;
        commit.current(moveItem(ids, from, to));
        // Le focus suit le bouton déplacé, pour enchaîner les flèches.
        requestAnimationFrame(() => container.current?.querySelector<HTMLElement>(`[data-reorder-id="${id}"]`)?.focus());
      },
    };
  }

  return { order: live ?? ids, draggingId, itemProps };
}
